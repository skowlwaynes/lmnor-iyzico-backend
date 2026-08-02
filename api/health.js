module.exports = async function handler(req, res) {
  res.status(200).json({
    ok: true,
    service: "lmnor-iyzico-backend",
    mode: process.env.IYZICO_MODE || "not-set",
    time: new Date().toISOString(),
  });
};
