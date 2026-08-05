const { applyCors, requireAllowedOrigin } = require("../lib/common");
const { serializeStoreConfig } = require("../lib/store-config");

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

  return res.status(200).json({
    ok: true,
    ...serializeStoreConfig(),
    serverTime: new Date().toISOString(),
  });
};
