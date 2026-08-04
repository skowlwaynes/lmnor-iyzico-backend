const crypto = require("crypto");
const { PRODUCTS, ALLOWED_SIZES } = require("../lib/catalog");
const {
  Iyzipay,
  getIyzipay,
  parseBody,
  applyCors,
  requireAllowedOrigin,
  createSignedState,
  getClientIp,
  toTry,
} = require("../lib/common");
const {
  createPendingOrder,
  markCheckoutInitialized,
  markOrderFailed,
} = require("../lib/db");

function cleanText(value, maxLength = 180) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeBuyer(input) {
  const buyer = {
    name: cleanText(input?.name, 60),
    surname: cleanText(input?.surname, 60),
    email: cleanText(input?.email, 120),
    gsmNumber: cleanText(input?.gsmNumber, 20),
    identityNumber: cleanText(input?.identityNumber, 11),
    address: cleanText(input?.address, 250),
    city: cleanText(input?.city, 80),
    country: cleanText(input?.country || "Türkiye", 80),
    zipCode: cleanText(input?.zipCode, 20),
    billingAddress: cleanText(input?.billingAddress || input?.address, 250),
    billingCity: cleanText(input?.billingCity || input?.city, 80),
    billingCountry: cleanText(
      input?.billingCountry || input?.country || "Türkiye",
      80
    ),
    billingZipCode: cleanText(input?.billingZipCode || input?.zipCode, 20),
  };

  const required = [
    "name",
    "surname",
    "email",
    "gsmNumber",
    "identityNumber",
    "address",
    "city",
    "zipCode",
  ];

  for (const field of required) {
    if (!buyer[field]) {
      throw new Error(`Eksik müşteri bilgisi: ${field}`);
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email)) {
    throw new Error("Geçerli bir e-posta adresi girin.");
  }

  if (!/^\d{11}$/.test(buyer.identityNumber)) {
    throw new Error("Kimlik numarası 11 haneli olmalı.");
  }

  return buyer;
}

function buildBasket(cart) {
  if (!Array.isArray(cart) || cart.length === 0) {
    throw new Error("Sepet boş.");
  }

  const grouped = new Map();

  for (const rawItem of cart) {
    const productId = cleanText(rawItem?.productId, 80);
    const product = PRODUCTS[productId];
    if (!product) {
      throw new Error(`Geçersiz ürün: ${productId}`);
    }

    const size = cleanText(rawItem?.size, 5).toUpperCase();
    if (!ALLOWED_SIZES.has(size)) {
      throw new Error(`${product.name} için geçerli beden seçin.`);
    }

    const quantity = Number(rawItem?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
      throw new Error(`${product.name} için adet 1–5 arasında olmalı.`);
    }

    const key = `${product.id}:${size}`;
    const previous = grouped.get(key) || 0;
    const combinedQuantity = previous + quantity;
    if (combinedQuantity > 5) {
      throw new Error(`${product.name} / ${size} için toplam adet en fazla 5 olabilir.`);
    }
    grouped.set(key, combinedQuantity);
  }

  let totalKurus = 0;
  const items = [];
  const basketItems = [];

  for (const [key, quantity] of grouped.entries()) {
    const [productId, size] = key.split(":");
    const product = PRODUCTS[productId];
    const lineTotalKurus = product.priceKurus * quantity;
    totalKurus += lineTotalKurus;

    items.push({
      productId: product.id,
      productName: product.name,
      size,
      quantity,
      unitPriceKurus: product.priceKurus,
      lineTotalKurus,
    });

    basketItems.push({
      id: `${product.id}-${size}`,
      name: `${product.name} / ${size} / ${quantity} adet`,
      category1: product.category1,
      category2: product.category2,
      itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,
      price: toTry(lineTotalKurus),
    });
  }

  return { basketItems, items, totalKurus };
}

function initializeCheckout(iyzipay, request) {
  return new Promise((resolve, reject) => {
    iyzipay.checkoutFormInitialize.create(request, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
}

module.exports = async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  if (!requireAllowedOrigin(req)) {
    return res.status(403).json({ ok: false, error: "Origin not allowed" });
  }

  let orderId;

  try {
    if ((process.env.IYZICO_MODE || "sandbox") !== "sandbox") {
      return res.status(503).json({
        ok: false,
        error:
          "Bu sürüm sandbox içindir. Canlı fiyat ve canlı iyzico ayarları tamamlanmadan live moda geçmeyin.",
      });
    }

    const body = parseBody(req);
    const buyer = normalizeBuyer(body.buyer || {});
    const { basketItems, items, totalKurus } = buildBasket(body.cart);

    orderId = `LMNOR-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const signature = createSignedState(orderId);

    await createPendingOrder({
      id: orderId,
      totalKurus,
      items,
      buyer,
    });

    const backendUrl = process.env.BACKEND_URL;
    if (!backendUrl) {
      throw new Error("BACKEND_URL tanımlı değil.");
    }

    const callbackUrl = new URL("/api/callback", backendUrl);
    callbackUrl.searchParams.set("orderId", orderId);
    callbackUrl.searchParams.set("signature", signature);

    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: orderId,
      price: toTry(totalKurus),
      paidPrice: toTry(totalKurus),
      currency: Iyzipay.CURRENCY.TRY,
      basketId: orderId,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl: callbackUrl.toString(),
      enabledInstallments: [1],
      buyer: {
        id: orderId,
        name: buyer.name,
        surname: buyer.surname,
        gsmNumber: buyer.gsmNumber,
        email: buyer.email,
        identityNumber: buyer.identityNumber,
        registrationAddress: buyer.address,
        ip: getClientIp(req),
        city: buyer.city,
        country: buyer.country,
        zipCode: buyer.zipCode,
      },
      shippingAddress: {
        contactName: `${buyer.name} ${buyer.surname}`.trim(),
        city: buyer.city,
        country: buyer.country,
        address: buyer.address,
        zipCode: buyer.zipCode,
      },
      billingAddress: {
        contactName: `${buyer.name} ${buyer.surname}`.trim(),
        city: buyer.billingCity,
        country: buyer.billingCountry,
        address: buyer.billingAddress,
        zipCode: buyer.billingZipCode,
      },
      basketItems,
    };

    const iyzipay = getIyzipay();
    const result = await initializeCheckout(iyzipay, request);

    if (!result || result.status !== "success" || !result.paymentPageUrl) {
      console.error("iyzico initialize failure", result);
      await markOrderFailed(orderId, {
        errorCode: result?.errorCode || "initialize_failed",
        errorMessage: result?.errorMessage || "Ödeme oturumu oluşturulamadı.",
      });
      return res.status(400).json({
        ok: false,
        error: result?.errorMessage || "Ödeme oturumu oluşturulamadı.",
        errorCode: result?.errorCode,
      });
    }

    await markCheckoutInitialized(orderId, result.token);

    return res.status(200).json({
      ok: true,
      orderId,
      paymentPageUrl: result.paymentPageUrl,
      token: result.token,
    });
  } catch (error) {
    console.error("checkout error", error);

    if (orderId) {
      try {
        await markOrderFailed(orderId, {
          errorCode: "checkout_server_error",
          errorMessage: error instanceof Error ? error.message : "Geçersiz istek.",
        });
      } catch (databaseError) {
        console.error("checkout failure could not be saved", databaseError);
      }
    }

    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Geçersiz istek.",
    });
  }
};
