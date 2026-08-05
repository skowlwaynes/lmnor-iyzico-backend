function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTry(kurus) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(Number(kurus || 0) / 100);
}

function getTrackingUrl(orderId) {
  const successUrl = process.env.FRAMER_SUCCESS_URL;
  const siteUrl = process.env.FRAMER_SITE_URL;

  let baseUrl = siteUrl;
  if (!baseUrl && successUrl) {
    try {
      baseUrl = new URL(successUrl).origin;
    } catch (_) {
      baseUrl = undefined;
    }
  }

  baseUrl ||= "https://lmnorofficial.com";

  const url = new URL("/order-tracking", baseUrl);
  url.searchParams.set("orderId", orderId);
  return url.toString();
}

function renderItemsHtml(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const name = escapeHtml(item.productName || item.productId || "Ürün");
      const size = escapeHtml(item.size || "-");
      const quantity = Number(item.quantity || 0);
      const lineTotal = formatTry(item.lineTotalKurus || 0);

      return `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #2b2b2b;color:#ffffff;">
            <strong>${name}</strong><br>
            <span style="color:#a9a9a9;font-size:13px;">Beden: ${size} · Adet: ${quantity}</span>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid #2b2b2b;color:#ffffff;text-align:right;white-space:nowrap;">
            ${lineTotal}
          </td>
        </tr>`;
    })
    .join("");
}

function renderItemsText(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const name = item.productName || item.productId || "Ürün";
      return `- ${name} / Beden: ${item.size || "-"} / Adet: ${Number(
        item.quantity || 0
      )} / ${formatTry(item.lineTotalKurus || 0)}`;
    })
    .join("\n");
}

function getOrderAmounts(order) {
  const totalKurus = Number(order?.total_kurus || 0);
  const shippingKurus = Number(order?.shipping_kurus || 0);
  const subtotalKurus = Number(
    order?.subtotal_kurus ?? Math.max(0, totalKurus - shippingKurus)
  );

  return {
    subtotalKurus,
    shippingKurus,
    totalKurus,
  };
}

function renderTotalsHtml(order) {
  const { subtotalKurus, shippingKurus, totalKurus } = getOrderAmounts(order);
  const shippingLabel = shippingKurus > 0 ? formatTry(shippingKurus) : "Ücretsiz";

  return `
    <tr>
      <td style="padding-top:16px;color:#a9a9a9;">ARA TOPLAM</td>
      <td style="padding-top:16px;color:#ffffff;text-align:right;white-space:nowrap;">${formatTry(subtotalKurus)}</td>
    </tr>
    <tr>
      <td style="padding-top:10px;color:#a9a9a9;">KARGO</td>
      <td style="padding-top:10px;color:#ffffff;text-align:right;white-space:nowrap;">${shippingLabel}</td>
    </tr>
    <tr>
      <td style="padding-top:18px;color:#bdbdbd;font-weight:700;">TOPLAM</td>
      <td style="padding-top:18px;color:#ffffff;font-weight:700;text-align:right;white-space:nowrap;">${formatTry(totalKurus)}</td>
    </tr>`;
}

function renderTotalsText(order) {
  const { subtotalKurus, shippingKurus, totalKurus } = getOrderAmounts(order);
  const shippingLabel = shippingKurus > 0 ? formatTry(shippingKurus) : "Ücretsiz";
  return `Ara toplam: ${formatTry(subtotalKurus)}\nKargo: ${shippingLabel}\nToplam: ${formatTry(totalKurus)}`;
}

function buildOrderConfirmation(order) {
  const orderId = String(order.id || "");
  const customerName = escapeHtml(order.buyer_name || "");
  const trackingUrl = getTrackingUrl(orderId);

  const subject = `Siparişiniz alındı — ${orderId}`;

  const html = `<!doctype html>
<html lang="tr">
  <body style="margin:0;background:#000000;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:32px 18px;">
      <div style="border:1px solid #252525;border-radius:18px;padding:32px;background:#080808;">
        <div style="font-size:13px;letter-spacing:3px;color:#bdbdbd;margin-bottom:24px;">LMNOR</div>
        <h1 style="font-size:34px;line-height:1.05;margin:0 0 18px;color:#ffffff;">Siparişiniz başarıyla alındı.</h1>
        <p style="font-size:16px;line-height:1.65;color:#c7c7c7;margin:0 0 26px;">
          ${customerName ? `Merhaba ${customerName}, ` : ""}LMNOR'u tercih ettiğiniz için teşekkürler. Siparişinizi hazırlamaya başlıyoruz.
        </p>

        <div style="background:#111111;border:1px solid #2c2c2c;border-radius:12px;padding:18px;margin-bottom:24px;">
          <div style="font-size:12px;letter-spacing:1.5px;color:#a9a9a9;margin-bottom:8px;">SİPARİŞ NUMARANIZ</div>
          <div style="font-size:17px;font-weight:700;color:#ffffff;word-break:break-word;">${escapeHtml(orderId)}</div>
        </div>

        <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:18px;">
          ${renderItemsHtml(order.items)}
${renderTotalsHtml(order)}
        </table>

        <a href="${escapeHtml(trackingUrl)}" style="display:block;text-align:center;background:#ffffff;color:#000000;text-decoration:none;font-weight:700;padding:16px 18px;border-radius:10px;margin-top:28px;">
          SİPARİŞİMİ TAKİP ET
        </a>

        <p style="font-size:12px;line-height:1.6;color:#777777;margin:24px 0 0;">
          Sipariş durumunu görüntülemek için sipariş numaranızın yanında, ödeme sırasında kullandığınız e-posta adresini girmeniz gerekir.
        </p>
      </div>
    </div>
  </body>
</html>`;

  const text = `${customerName ? `Merhaba ${order.buyer_name},\n\n` : ""}LMNOR'u tercih ettiğiniz için teşekkürler. Siparişiniz başarıyla alındı.\n\nSipariş numaranız: ${orderId}\n\n${renderItemsText(order.items)}\n\n${renderTotalsText(order)}\n\nSiparişinizi takip edin: ${trackingUrl}`;

  return { subject, html, text };
}

const STATUS_EMAIL_CONTENT = {
  preparing: {
    label: "HAZIRLANIYOR",
    title: "Siparişiniz hazırlanıyor.",
    message:
      "Siparişiniz ekibimiz tarafından hazırlanıyor. Kargoya verildiğinde takip bilgilerinizi ayrıca paylaşacağız.",
    subjectPrefix: "Siparişiniz hazırlanıyor",
    accentBackground: "#362b0c",
    accentColor: "#ffd76f",
  },
  shipped: {
    label: "KARGOYA VERİLDİ",
    title: "Siparişiniz kargoya verildi.",
    message:
      "Paketiniz kargo firmasına teslim edildi. Aşağıdaki takip bilgileriyle gönderinizi kontrol edebilirsiniz.",
    subjectPrefix: "Siparişiniz kargoya verildi",
    accentBackground: "#102942",
    accentColor: "#8fc8ff",
  },
  delivered: {
    label: "TESLİM EDİLDİ",
    title: "Siparişiniz teslim edildi.",
    message:
      "Siparişiniz teslim edildi olarak güncellendi. LMNOR'u tercih ettiğiniz için teşekkür ederiz. Güle güle kullanın.",
    subjectPrefix: "Siparişiniz teslim edildi",
    accentBackground: "#102c18",
    accentColor: "#8ff5aa",
  },
  cancelled: {
    label: "İPTAL EDİLDİ",
    title: "Siparişiniz iptal edildi.",
    message:
      "Siparişiniz iptal edildi olarak güncellendi. Ödeme iadesi gerekiyorsa süreç ödeme sağlayıcısının işlem süresine göre hesabınıza yansıyabilir.",
    subjectPrefix: "Siparişiniz iptal edildi",
    accentBackground: "#351313",
    accentColor: "#ff9696",
  },
};

function buildOrderStatusUpdate(order, status) {
  const content = STATUS_EMAIL_CONTENT[status];
  if (!content) {
    throw new Error("Bu sipariş durumu için e-posta şablonu bulunamadı.");
  }

  const orderId = String(order.id || "");
  const customerName = escapeHtml(order.buyer_name || "");
  const trackingUrl = getTrackingUrl(orderId);
  const shippingCompany = escapeHtml(order.shipping_company || "");
  const trackingNumber = escapeHtml(order.tracking_number || "");
  const showShipping = status === "shipped" && shippingCompany && trackingNumber;

  const subject = `${content.subjectPrefix} — ${orderId}`;

  const shippingHtml = showShipping
    ? `
      <div style="background:#111111;border:1px solid #2c2c2c;border-radius:12px;padding:18px;margin:0 0 24px;">
        <div style="font-size:12px;letter-spacing:1.5px;color:#a9a9a9;margin-bottom:12px;">KARGO BİLGİLERİ</div>
        <div style="color:#ffffff;font-size:14px;line-height:1.8;">
          <strong>Kargo firması:</strong> ${shippingCompany}<br>
          <strong>Takip numarası:</strong> ${trackingNumber}
        </div>
      </div>`
    : "";

  const html = `<!doctype html>
<html lang="tr">
  <body style="margin:0;background:#000000;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:32px 18px;">
      <div style="border:1px solid #252525;border-radius:18px;padding:32px;background:#080808;">
        <div style="font-size:13px;letter-spacing:3px;color:#bdbdbd;margin-bottom:24px;">LMNOR</div>

        <div style="display:inline-block;background:${content.accentBackground};color:${content.accentColor};font-size:11px;font-weight:700;letter-spacing:1.4px;padding:9px 12px;border-radius:999px;margin-bottom:18px;">
          ${content.label}
        </div>

        <h1 style="font-size:34px;line-height:1.05;margin:0 0 18px;color:#ffffff;">${content.title}</h1>

        <p style="font-size:16px;line-height:1.65;color:#c7c7c7;margin:0 0 26px;">
          ${customerName ? `Merhaba ${customerName}, ` : ""}${content.message}
        </p>

        <div style="background:#111111;border:1px solid #2c2c2c;border-radius:12px;padding:18px;margin-bottom:24px;">
          <div style="font-size:12px;letter-spacing:1.5px;color:#a9a9a9;margin-bottom:8px;">SİPARİŞ NUMARANIZ</div>
          <div style="font-size:17px;font-weight:700;color:#ffffff;word-break:break-word;">${escapeHtml(orderId)}</div>
        </div>

        ${shippingHtml}

        <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:18px;">
          ${renderItemsHtml(order.items)}
${renderTotalsHtml(order)}
        </table>

        <a href="${escapeHtml(trackingUrl)}" style="display:block;text-align:center;background:#ffffff;color:#000000;text-decoration:none;font-weight:700;padding:16px 18px;border-radius:10px;margin-top:28px;">
          SİPARİŞİMİ TAKİP ET
        </a>

        <p style="font-size:12px;line-height:1.6;color:#777777;margin:24px 0 0;">
          Sipariş durumunu görüntülemek için sipariş numaranızın yanında, ödeme sırasında kullandığınız e-posta adresini girmeniz gerekir.
        </p>
      </div>
    </div>
  </body>
</html>`;

  const shippingText = showShipping
    ? `\n\nKargo firması: ${order.shipping_company}\nTakip numarası: ${order.tracking_number}`
    : "";

  const text = `${customerName ? `Merhaba ${order.buyer_name},\n\n` : ""}${content.title}\n\n${content.message}\n\nSipariş numaranız: ${orderId}${shippingText}\n\n${renderItemsText(order.items)}\n\n${renderTotalsText(order)}\n\nSiparişinizi takip edin: ${trackingUrl}`;

  return { subject, html, text };
}

async function sendResendEmail({ to, subject, html, text, idempotencyKey }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY tanımlı değil.");
  }

  if (!to) {
    throw new Error("Sipariş e-posta adresi bulunamadı.");
  }

  const from = process.env.RESEND_FROM || "LMNOR <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.error) {
    const message =
      payload?.message ||
      payload?.error?.message ||
      `Resend isteği başarısız (${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    error.details = payload;
    throw error;
  }

  return { id: payload.id || null };
}

async function sendOrderConfirmation(order) {
  const { subject, html, text } = buildOrderConfirmation(order);
  return sendResendEmail({
    to: order?.buyer_email,
    subject,
    html,
    text,
    idempotencyKey: `lmnor-order-confirmation-${order.id}`,
  });
}

async function sendOrderStatusUpdate(order, status) {
  const { subject, html, text } = buildOrderStatusUpdate(order, status);
  return sendResendEmail({
    to: order?.buyer_email,
    subject,
    html,
    text,
    idempotencyKey: `lmnor-order-status-${order.id}-${status}`,
  });
}

module.exports = {
  sendOrderConfirmation,
  buildOrderConfirmation,
  sendOrderStatusUpdate,
  buildOrderStatusUpdate,
};
