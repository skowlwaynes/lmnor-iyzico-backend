const { applyCors, requireAllowedOrigin, parseBody } = require("../lib/common");
const { requireAdmin } = require("../lib/admin-auth");
const { updateProductPricing } = require("../lib/db");

function clean(value, maxLength = 100) {
  return String(value || "").trim().slice(0, maxLength);
}

function parsePositiveKurus(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 100 || number > 100000000) {
    throw new Error(`${label} en az 1 TL olmalı.`);
  }
  return number;
}

function parseOptionalDate(value, label) {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} geçerli bir tarih olmalı.`);
  }
  return date.toISOString();
}

module.exports = async function handler(req, res) {
  applyCors(req, res);
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  if (!requireAllowedOrigin(req)) {
    return res.status(403).json({ ok: false, error: "Origin not allowed" });
  }

  if (!requireAdmin(req, res)) return;

  try {
    const body = parseBody(req);
    const productId = clean(body.productId, 80);
    const regularPriceKurus = parsePositiveKurus(
      body.regularPriceKurus,
      "Normal fiyat"
    );
    const campaignEnabled = body.campaignEnabled === true;
    const campaignPriceKurus =
      body.campaignPriceKurus === null ||
      body.campaignPriceKurus === undefined ||
      body.campaignPriceKurus === ""
        ? null
        : parsePositiveKurus(body.campaignPriceKurus, "Kampanyalı fiyat");
    const campaignStartsAt = parseOptionalDate(
      body.campaignStartsAt,
      "Kampanya başlangıcı"
    );
    const campaignEndsAt = parseOptionalDate(
      body.campaignEndsAt,
      "Kampanya bitişi"
    );

    if (!productId) {
      throw new Error("Ürün kimliği eksik.");
    }

    if (campaignEnabled) {
      if (campaignPriceKurus === null) {
        throw new Error("Kampanya açıkken kampanyalı fiyat zorunludur.");
      }
      if (campaignPriceKurus >= regularPriceKurus) {
        throw new Error("Kampanyalı fiyat normal fiyattan düşük olmalı.");
      }
    }

    if (
      campaignStartsAt &&
      campaignEndsAt &&
      new Date(campaignEndsAt).getTime() <= new Date(campaignStartsAt).getTime()
    ) {
      throw new Error("Kampanya bitişi başlangıçtan sonra olmalı.");
    }

    const product = await updateProductPricing({
      productId,
      regularPriceKurus,
      campaignPriceKurus,
      campaignEnabled,
      campaignStartsAt,
      campaignEndsAt,
    });

    if (!product) {
      return res.status(404).json({ ok: false, error: "Ürün bulunamadı." });
    }

    return res.status(200).json({ ok: true, productId: product.id });
  } catch (error) {
    console.error("admin product update error", error);
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Fiyat güncellenemedi.",
    });
  }
};
