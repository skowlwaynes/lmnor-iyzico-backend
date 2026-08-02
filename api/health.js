const { checkDatabase } = require("../lib/db");

module.exports = async function handler(req, res) {
  try {
    const databaseTime = await checkDatabase();

    return res.status(200).json({
      ok: true,
      service: "lmnor-iyzico-backend",
      mode: process.env.IYZICO_MODE || "not-set",
      database: "connected",
      databaseTime,
      time: new Date().toISOString(),
    });
  } catch (error) {
    console.error("health database error", error);
    return res.status(500).json({
      ok: false,
      service: "lmnor-iyzico-backend",
      mode: process.env.IYZICO_MODE || "not-set",
      database: "error",
      error: "Veritabanı bağlantısı kurulamadı.",
      time: new Date().toISOString(),
    });
  }
};
