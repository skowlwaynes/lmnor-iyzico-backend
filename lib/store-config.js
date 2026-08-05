const STORE_CONFIG = Object.freeze({
  shippingCarrier: "Aras Kargo",
  shippingFeeKurus: 17000,
  freeShippingThresholdKurus: 300000,
  preparationMinBusinessDays: 2,
  preparationMaxBusinessDays: 4,
});

function calculateShippingKurus(subtotalKurus) {
  const subtotal = Number(subtotalKurus);
  if (!Number.isInteger(subtotal) || subtotal < 0) {
    throw new Error("Geçersiz ürün ara toplamı.");
  }

  return subtotal >= STORE_CONFIG.freeShippingThresholdKurus
    ? 0
    : STORE_CONFIG.shippingFeeKurus;
}

function serializeStoreConfig() {
  return {
    shippingCarrier: STORE_CONFIG.shippingCarrier,
    shippingFeeKurus: STORE_CONFIG.shippingFeeKurus,
    freeShippingThresholdKurus: STORE_CONFIG.freeShippingThresholdKurus,
    preparationMinBusinessDays: STORE_CONFIG.preparationMinBusinessDays,
    preparationMaxBusinessDays: STORE_CONFIG.preparationMaxBusinessDays,
    preparationText: `Siparişiniz ${STORE_CONFIG.preparationMinBusinessDays}–${STORE_CONFIG.preparationMaxBusinessDays} iş günü içinde özenle hazırlanarak kargoya teslim edilir.`,
  };
}

module.exports = {
  STORE_CONFIG,
  calculateShippingKurus,
  serializeStoreConfig,
};
