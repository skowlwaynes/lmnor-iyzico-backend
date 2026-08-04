/**
 * SANDBOX TEST KATALOĞU
 *
 * Güvenlik için fiyatlar tarayıcıdan alınmaz; burada sunucu tarafında belirlenir.
 * Şimdilik her ürünün TEST fiyatı 1,00 TL'dir.
 * Canlıya geçmeden önce gerçek fiyatları kuruş cinsinden yazın ve testOnly: false yapın.
 */
const PRODUCTS = Object.freeze({
  "lucky-family-old": {
    id: "lucky-family-old",
    name: "LUCKY FAMILY OLD",
    priceKurus: 100,
    category1: "Tişört",
    category2: "LMNOR DROP 01",
    testOnly: true,
  },
  "lmnor-jj": {
    id: "lmnor-jj",
    name: "LMNOR JJ",
    priceKurus: 100,
    category1: "Tişört",
    category2: "LMNOR DROP 01",
    testOnly: true,
  },
  "lmnor-main": {
    id: "lmnor-main",
    name: "LMNOR MAIN",
    priceKurus: 100,
    category1: "Tişört",
    category2: "LMNOR DROP 01",
    testOnly: true,
  },
  "lmnor-waynes-culture": {
    id: "lmnor-waynes-culture",
    name: "LMNOR WAYNES CULTURE",
    priceKurus: 100,
    category1: "Tişört",
    category2: "LMNOR DROP 01",
    testOnly: true,
  },
  "lmnor-legacy-tee": {
    id: "lmnor-legacy-tee",
    name: "LMNOR LEGACY TEE",
    priceKurus: 100,
    category1: "Tişört",
    category2: "LMNOR DROP 01",
    testOnly: true,
  },
});

const ALLOWED_SIZES = new Set(["XS", "S", "M", "L", "XL", "XXL"]);

module.exports = { PRODUCTS, ALLOWED_SIZES };
