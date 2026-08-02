const {
  Iyzipay,
  getIyzipay,
  parseBody,
  verifySignedState,
  redirectWithParams,
} = require("../lib/common");
const {
  getOrderById,
  markOrderFailed,
  markOrderPaid,
} = require("../lib/db");

function retrieveCheckoutForm(iyzipay, request) {
  return new Promise((resolve, reject) => {
    iyzipay.checkoutForm.retrieve(request, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
}

function toKurus(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : null;
}

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

  let orderId = "";

  try {
    const body = parseBody(req);
    const token = String(body.token || req.query?.token || "");
    orderId = String(req.query?.orderId || "");
    const signature = String(req.query?.signature || "");

    if (!token || !orderId || !verifySignedState(orderId, signature)) {
      return redirectWithParams(res, failureUrl, {
        status: "invalid_callback",
        orderId,
      });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return redirectWithParams(res, failureUrl, {
        status: "order_not_found",
        orderId,
      });
    }

    const iyzipay = getIyzipay();
    const result = await retrieveCheckoutForm(iyzipay, {
      locale: Iyzipay.LOCALE.TR,
      conversationId: orderId,
      token,
    });

    const paid =
      result?.status === "success" && result?.paymentStatus === "SUCCESS";

    if (!paid) {
      console.error("iyzico payment failure", result);
      await markOrderFailed(orderId, {
        errorCode: result?.errorCode || `md_status_${result?.mdStatus ?? "unknown"}`,
        errorMessage: result?.errorMessage || "Ödeme tamamlanamadı.",
      });
      return redirectWithParams(res, failureUrl, {
        status: "payment_failed",
        orderId,
        errorCode: result?.errorCode,
      });
    }

    const conversationMatches = String(result.conversationId || "") === orderId;
    const basketMatches = String(result.basketId || "") === orderId;
    const amountMatches = toKurus(result.paidPrice) === Number(order.total_kurus);

    if (!conversationMatches || !basketMatches || !amountMatches) {
      console.error("iyzico payment verification mismatch", {
        orderId,
        conversationId: result?.conversationId,
        basketId: result?.basketId,
        paidPrice: result?.paidPrice,
        expectedKurus: order.total_kurus,
      });
      await markOrderFailed(orderId, {
        errorCode: "payment_verification_mismatch",
        errorMessage: "Ödeme doğrulaması eşleşmedi.",
      });
      return redirectWithParams(res, failureUrl, {
        status: "verification_failed",
        orderId,
      });
    }

    await markOrderPaid(orderId, result);

    return redirectWithParams(res, successUrl, {
      status: "success",
      orderId,
      paymentId: result.paymentId,
    });
  } catch (error) {
    console.error("callback error", error);

    if (orderId) {
      try {
        await markOrderFailed(orderId, {
          errorCode: "callback_server_error",
          errorMessage: "Ödeme sonucu işlenemedi.",
        });
      } catch (databaseError) {
        console.error("callback failure could not be saved", databaseError);
      }
    }

    return redirectWithParams(res, failureUrl, {
      status: "server_error",
      orderId,
    });
  }
};
