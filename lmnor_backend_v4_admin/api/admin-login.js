const { applyCors, requireAllowedOrigin, parseBody } = require("../lib/common");
const {
  TOKEN_TTL_SECONDS,
  createAdminToken,
  verifyAdminPassword,
} = require("../lib/admin-auth");

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

  try {
    const body = parseBody(req);
    const password = String(body.password || "");

    if (!verifyAdminPassword(password)) {
      return res.status(401).json({
        ok: false,
        error: "Yönetici şifresi hatalı.",
      });
    }

    return res.status(200).json({
      ok: true,
      token: createAdminToken(),
      expiresIn: TOKEN_TTL_SECONDS,
    });
  } catch (error) {
    console.error("admin login error", error);
    return res.status(500).json({
      ok: false,
      error: "Yönetici girişi şu anda kullanılamıyor.",
    });
  }
};
