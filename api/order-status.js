const {
  applyCors,
  requireAllowedOrigin,
} = require("../lib/common");
const { getPublicOrder } = require("../lib/db");

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

  try {
    const orderId = clean(req.query?.orderId, 80);
    const email = clean(req.query?.email, 120);

    if (!orderId || !email) {
      return res.status(400).json({
        ok: false,
        error: "Sipariş numarası ve e-posta adresi gerekli.",
      });
    }

    const order = await getPublicOrder(orderId, email);
    if (!order) {
      return res.status(404).json({
        ok: false,
        error: "Bu bilgilerle eşleşen sipariş bulunamadı.",
      });
    }

    return res.status(200).json({
      ok: true,
      order: {
        orderId: order.id,
        status: order.status,
        statusLabel: STATUS_LABELS[order.status] || "Sipariş İşleniyor",
        paymentStatus: order.payment_status,
        subtotalKurus: Number(order.subtotal_kurus ?? order.total_kurus),
        shippingKurus: Number(order.shipping_kurus || 0),
        totalKurus: Number(order.total_kurus),
        currency: order.currency,
        items: order.items,
        shippingCompany: order.shipping_company,
        trackingNumber: order.tracking_number,
        createdAt: order.created_at,
        paidAt: order.paid_at,
        updatedAt: order.updated_at,
      },
    });
  } catch (error) {
    console.error("order status error", error);
    return res.status(500).json({
      ok: false,
      error: "Sipariş bilgisi şu anda alınamıyor.",
    });
  }
};
