const { applyCors, requireAllowedOrigin } = require("../lib/common");
const { requireAdmin } = require("../lib/admin-auth");
const { listAdminOrders } = require("../lib/db");

const STATUS_LABELS = {
  pending_payment: "Ödeme Bekleniyor",
  awaiting_payment: "Ödeme Bekleniyor",
  payment_failed: "Ödeme Başarısız",
  paid: "Sipariş Alındı",
  preparing: "Hazırlanıyor",
  shipped: "Kargoya Verildi",
  delivered: "Teslim Edildi",
  cancelled: "İptal Edildi",
};

function clean(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
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
    const status = clean(req.query?.status, 40);
    const search = clean(req.query?.search, 120);
    const requestedLimit = Number(req.query?.limit || 50);
    const limit = Math.max(1, Math.min(100, Number.isFinite(requestedLimit) ? requestedLimit : 50));

    const orders = await listAdminOrders({ status, search, limit });

    return res.status(200).json({
      ok: true,
      orders: orders.map((order) => ({
        orderId: order.id,
        status: order.status,
        statusLabel: STATUS_LABELS[order.status] || "Sipariş İşleniyor",
        paymentStatus: order.payment_status,
        subtotalKurus: Number(order.subtotal_kurus ?? order.total_kurus),
        shippingKurus: Number(order.shipping_kurus || 0),
        totalKurus: Number(order.total_kurus),
        currency: order.currency,
        items: order.items,
        buyer: {
          name: order.buyer_name,
          surname: order.buyer_surname,
          email: order.buyer_email,
          phone: order.buyer_phone,
        },
        delivery: {
          address: order.delivery_address,
          city: order.city,
          country: order.country,
          zipCode: order.zip_code,
        },
        shippingCompany: order.shipping_company,
        trackingNumber: order.tracking_number,
        paymentId: order.payment_id,
        createdAt: order.created_at,
        paidAt: order.paid_at,
        updatedAt: order.updated_at,
      })),
    });
  } catch (error) {
    console.error("admin orders error", error);
    return res.status(500).json({
      ok: false,
      error: "Siparişler şu anda alınamıyor.",
    });
  }
};
