const { applyCors, requireAllowedOrigin, parseBody } = require("../lib/common");
const { requireAdmin } = require("../lib/admin-auth");
const { updateOrderByAdmin } = require("../lib/db");

const ALLOWED_STATUSES = new Set([
  "paid",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
]);

function clean(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
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
    const orderId = clean(body.orderId, 80);
    const status = clean(body.status, 40);
    const shippingCompany = clean(body.shippingCompany, 100);
    const trackingNumber = clean(body.trackingNumber, 120);

    if (!orderId || !ALLOWED_STATUSES.has(status)) {
      return res.status(400).json({
        ok: false,
        error: "Geçerli sipariş numarası ve durum seçin.",
      });
    }

    if (status === "shipped" && (!shippingCompany || !trackingNumber)) {
      return res.status(400).json({
        ok: false,
        error: "Kargoya verildi durumunda kargo firması ve takip numarası gereklidir.",
      });
    }

    const order = await updateOrderByAdmin({
      orderId,
      status,
      shippingCompany: shippingCompany || null,
      trackingNumber: trackingNumber || null,
    });

    if (!order) {
      return res.status(404).json({
        ok: false,
        error: "Güncellenebilecek ödenmiş sipariş bulunamadı.",
      });
    }

    return res.status(200).json({
      ok: true,
      order: {
        orderId: order.id,
        status: order.status,
        shippingCompany: order.shipping_company,
        trackingNumber: order.tracking_number,
        updatedAt: order.updated_at,
      },
    });
  } catch (error) {
    console.error("admin order update error", error);
    return res.status(500).json({
      ok: false,
      error: "Sipariş durumu şu anda güncellenemiyor.",
    });
  }
};
