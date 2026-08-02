const {
  Iyzipay,
  getIyzipay,
  parseBody,
  verifySignedState,
  redirectWithParams,
} = require("../lib/common");

module.exports = async function handler(req, res) {
  if (!["POST", "GET"].includes(req.method)) {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const successUrl = process.env.FRAMER_SUCCESS_URL;
  const failureUrl = process.env.FRAMER_FAILURE_URL;

  if (!successUrl || !failureUrl) {
    return res
      .status(500)
      .json({ ok: false, error: "Sonuç sayfası URL'leri tanımlı değil." });
  }

  try {
    const body = parseBody(req);
    const token = String(body.token || req.query?.token || "");
    const orderId = String(req.query?.orderId || "");
    const signature = String(req.query?.signature || "");

    if (!token || !orderId || !verifySignedState(orderId, signature)) {
      return redirectWithParams(res, failureUrl, {
        status: "invalid_callback",
        orderId,
      });
    }

    const iyzipay = getIyzipay();
    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: orderId,
      token,
    };

    iyzipay.checkoutForm.retrieve(request, (error, result) => {
      if (error) {
        console.error("iyzico retrieve error", error);
        return redirectWithParams(res, failureUrl, {
          status: "retrieve_error",
          orderId,
        });
      }

      const paid =
        result?.status === "success" && result?.paymentStatus === "SUCCESS";

      if (!paid) {
        console.error("iyzico payment failure", result);
        return redirectWithParams(res, failureUrl, {
          status: "payment_failed",
          orderId,
          errorCode: result?.errorCode,
        });
      }

      // ÜRETİM NOTU:
      // Canlıya geçmeden önce bu noktada siparişi bir veritabanına kaydedin,
      // stok düşürün ve sipariş e-postası gönderin.
      return redirectWithParams(res, successUrl, {
        status: "success",
        orderId,
        paymentId: result.paymentId,
      });
    });
  } catch (error) {
    console.error("callback error", error);
    return redirectWithParams(res, failureUrl, {
      status: "server_error",
    });
  }
};
