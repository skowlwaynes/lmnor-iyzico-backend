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

function cleanText(value, maxLength = 180) {
  return String(value || "").trim().slice(0, maxLength);
}

function validateBuyer(buyer) {
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
    if (!cleanText(buyer?.[field])) {
      throw new Error(`Eksik müşteri bilgisi: ${field}`);
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText(buyer.email))) {
    throw new Error("Geçerli bir e-posta adresi girin.");
  }

  if (!/^\d{11}$/.test(cleanText(buyer.identityNumber))) {
    throw new Error("Kimlik numarası 11 haneli olmalı.");
  }
}

function buildBasket(cart) {
  if (!Array.isArray(cart) || cart.length === 0) {
    throw new Error("Sepet boş.");
  }

  let totalKurus = 0;

  const basketItems = cart.map((item, index) => {
    const product = PRODUCTS[cleanText(item.productId, 80)];
    if (!product) {
      throw new Error(`Geçersiz ürün: ${cleanText(item.productId, 80)}`);
    }

    const size = cleanText(item.size, 5).toUpperCase();
    if (!ALLOWED_SIZES.has(size)) {
      throw new Error(`${product.name} için geçerli beden seçin.`);
    }

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
      throw new Error(`${product.name} için adet 1–5 arasında olmalı.`);
    }

    const lineKurus = product.priceKurus * quantity;
    totalKurus += lineKurus;

    return {
      id: `${product.id}-${size}-${index + 1}`,
      name: `${product.name} / ${size} / ${quantity} adet`,
      category1: product.category1,
      category2: product.category2,
      itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,
      price: toTry(lineKurus),
    };
  });

  return { basketItems, totalKurus };
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

  try {
    if ((process.env.IYZICO_MODE || "sandbox") !== "sandbox") {
      return res.status(503).json({
        ok: false,
        error:
          "Bu başlangıç paketi yalnızca sandbox içindir. Canlı fiyat kataloğu ve sipariş veritabanı kurulmadan live moda geçmeyin.",
      });
    }

    const body = parseBody(req);
    const buyer = body.buyer || {};
    validateBuyer(buyer);

    const { basketItems, totalKurus } = buildBasket(body.cart);
    const orderId = `LMNOR-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const signature = createSignedState(orderId);

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
        name: cleanText(buyer.name, 60),
        surname: cleanText(buyer.surname, 60),
        gsmNumber: cleanText(buyer.gsmNumber, 20),
        email: cleanText(buyer.email, 120),
        identityNumber: cleanText(buyer.identityNumber, 11),
        registrationAddress: cleanText(buyer.address, 250),
        ip: getClientIp(req),
        city: cleanText(buyer.city, 80),
        country: cleanText(buyer.country || "Türkiye", 80),
        zipCode: cleanText(buyer.zipCode, 20),
      },
      shippingAddress: {
        contactName: `${cleanText(buyer.name, 60)} ${cleanText(
          buyer.surname,
          60
        )}`.trim(),
        city: cleanText(buyer.city, 80),
        country: cleanText(buyer.country || "Türkiye", 80),
        address: cleanText(buyer.address, 250),
        zipCode: cleanText(buyer.zipCode, 20),
      },
      billingAddress: {
        contactName: `${cleanText(buyer.name, 60)} ${cleanText(
          buyer.surname,
          60
        )}`.trim(),
        city: cleanText(buyer.billingCity || buyer.city, 80),
        country: cleanText(
          buyer.billingCountry || buyer.country || "Türkiye",
          80
        ),
        address: cleanText(buyer.billingAddress || buyer.address, 250),
        zipCode: cleanText(buyer.billingZipCode || buyer.zipCode, 20),
      },
      basketItems,
    };

    const iyzipay = getIyzipay();

    iyzipay.checkoutFormInitialize.create(request, (error, result) => {
      if (error) {
        console.error("iyzico initialize error", error);
        return res.status(502).json({
          ok: false,
          error: "iyzico ödeme oturumu başlatılamadı.",
        });
      }

      if (!result || result.status !== "success" || !result.paymentPageUrl) {
        console.error("iyzico initialize failure", result);
        return res.status(400).json({
          ok: false,
          error: result?.errorMessage || "Ödeme oturumu oluşturulamadı.",
          errorCode: result?.errorCode,
        });
      }

      return res.status(200).json({
        ok: true,
        orderId,
        paymentPageUrl: result.paymentPageUrl,
        token: result.token,
      });
    });
  } catch (error) {
    console.error("checkout error", error);
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Geçersiz istek.",
    });
  }
};
