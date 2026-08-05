const { applyCors, requireAllowedOrigin } = require("../lib/common");
const { listProducts } = require("../lib/db");
const { serializeStoreConfig } = require("../lib/store-config");

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
    updatedAt: product.updated_at,
  };
}

module.exports = async function handler(req, res) {
  applyCors(req, res);
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  if (!requireAllowedOrigin(req)) {
    return res.status(403).json({ ok: false, error: "Origin not allowed" });
  }

  try {
    const products = await listProducts();
    return res.status(200).json({
      ok: true,
      products: products.map(serializeProduct),
      storeConfig: serializeStoreConfig(),
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("products error", error);
    return res.status(500).json({
      ok: false,
      error: "Ürün fiyatları şu anda alınamıyor.",
    });
  }
};
