const crypto = require("crypto");

const TOKEN_TTL_SECONDS = 8 * 60 * 60;

function getAdminPassword() {
  const password = String(process.env.ADMIN_PASSWORD || "");
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD en az 12 karakter olmalı.");
  }
  return password;
}

function getAdminSecret() {
  const secret = String(process.env.ADMIN_SESSION_SECRET || "");
  if (secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET en az 32 karakter olmalı.");
  }
  return secret;
}

function safeEqualText(left, right) {
  const leftHash = crypto.createHash("sha256").update(String(left)).digest();
  const rightHash = crypto.createHash("sha256").update(String(right)).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function base64urlEncode(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64urlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value) {
  return crypto
    .createHmac("sha256", getAdminSecret())
    .update(value)
    .digest("base64url");
}

function createAdminToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: "lmnor-admin",
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
    nonce: crypto.randomBytes(12).toString("hex"),
  };

  const encoded = base64urlEncode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

function verifyAdminToken(token) {
  const raw = String(token || "");
  const [encoded, suppliedSignature] = raw.split(".");
  if (!encoded || !suppliedSignature) return null;

  const expectedSignature = sign(encoded);
  if (!safeEqualText(expectedSignature, suppliedSignature)) return null;

  try {
    const payload = JSON.parse(base64urlDecode(encoded));
    const now = Math.floor(Date.now() / 1000);
    if (payload.sub !== "lmnor-admin" || !payload.exp || payload.exp <= now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function verifyAdminPassword(password) {
  return safeEqualText(String(password || ""), getAdminPassword());
}

function getBearerToken(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function requireAdmin(req, res) {
  const token = getBearerToken(req);
  const payload = verifyAdminToken(token);
  if (!payload) {
    res.status(401).json({
      ok: false,
      error: "Oturum geçersiz veya süresi dolmuş. Tekrar giriş yapın.",
    });
    return null;
  }
  return payload;
}

module.exports = {
  TOKEN_TTL_SECONDS,
  createAdminToken,
  verifyAdminPassword,
  requireAdmin,
};
