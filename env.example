const crypto = require("crypto");
const Iyzipay = require("iyzipay");

function getIyzipay() {
  const apiKey = process.env.IYZICO_API_KEY;
  const secretKey = process.env.IYZICO_SECRET_KEY;
  const uri =
    process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com";

  if (!apiKey || !secretKey) {
    throw new Error("IYZICO_API_KEY veya IYZICO_SECRET_KEY eksik.");
  }

  return new Iyzipay({ apiKey, secretKey, uri });
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return Object.fromEntries(new URLSearchParams(req.body));
    }
  }

  return {};
}

function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  const origins = allowedOrigins();

  if (origin && origins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function requireAllowedOrigin(req) {
  const origin = req.headers.origin;
  const origins = allowedOrigins();

  // Sunucudan sunucuya callback isteğinde Origin gelmeyebilir.
  if (!origin) return true;
  return origins.includes(origin);
}

function createSignedState(orderId) {
  const secret = process.env.CALLBACK_SIGNING_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("CALLBACK_SIGNING_SECRET en az 32 karakter olmalı.");
  }

  return crypto.createHmac("sha256", secret).update(orderId).digest("hex");
}

function verifySignedState(orderId, signature) {
  const expected = createSignedState(orderId);
  const supplied = String(signature || "");

  if (expected.length !== supplied.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(expected, "utf8"),
    Buffer.from(supplied, "utf8")
  );
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }

  return req.socket?.remoteAddress || "127.0.0.1";
}

function toTry(kurus) {
  return (kurus / 100).toFixed(2);
}

function redirectWithParams(res, baseUrl, params) {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  res.statusCode = 303;
  res.setHeader("Location", url.toString());
  res.end();
}

module.exports = {
  Iyzipay,
  getIyzipay,
  parseBody,
  applyCors,
  requireAllowedOrigin,
  createSignedState,
  verifySignedState,
  getClientIp,
  toTry,
  redirectWithParams,
};
