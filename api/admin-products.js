const { applyCors, requireAllowedOrigin } = require("../lib/common");
const { requireAdmin } = require("../lib/admin-auth");
const { listProducts } = require("../lib/db");

function serializeProduct(product) {
  return {
    id: product.id,
    name: product.name,
    category1: product.category1,
    category2: product.category2,
    regularPriceKurus: Number(product.regular_price_kurus),
    campaignPriceKurus:
      product.campaign_price_kurus === null
        ? null
        : Number(product.campaign_price_kurus),
    currentPriceKurus: Number(product.effective_price_kurus),
    campaignEnabled: Boolean(product.campaign_enabled),
    campaignActive: Boolean(product.campaign_active),
    campaignStartsAt: product.campaign_starts_at,
    campaignEndsAt: product.campaign_ends_at,
    active: Boolean(product.active),
    updatedAt: product.updated_at,
  };
}

module.exports = async function handler(req, res) {
  applyCors(req, res);
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  if (!requireAllowedOrigin(req)) {
    return res.status(403).json({ ok: false, error: "Origin not allowed" });
  }

  if (!requireAdmin(req, res)) return;

  try {
    const products = await listProducts({ includeInactive: true });
    return res.status(200).json({
      ok: true,
      products: products.map(serializeProduct),
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("admin products error", error);
    return res.status(500).json({
      ok: false,
      error: "Fiyatlar şu anda alınamıyor.",
    });
  }
};
