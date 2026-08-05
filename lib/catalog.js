/**
 * LMNOR ürün kataloğu başlangıç verileri.
 *
 * Bu değerler yalnızca products tablosu ilk kez oluşturulurken kullanılır.
 * Sonraki fiyat değişiklikleri yönetim panelinden veritabanına kaydedilir;
 * deployment veya kod güncellemesi mevcut fiyatların üzerine yazmaz.
 */
const PRODUCT_SEEDS = Object.freeze([
  {
    id: "lucky-family-old",
    name: "LUCKY FAMILY OLD",
    regularPriceKurus: 99900,
    category1: "Tişört",
    category2: "LMNOR DROP 01",
    sortOrder: 10,
  },
  {
    id: "lmnor-jj",
    name: "LMNOR JJ",
    regularPriceKurus: 109900,
    category1: "Tişört",
    category2: "LMNOR DROP 01",
    sortOrder: 20,
  },
  {
    id: "lmnor-main",
    name: "LMNOR MAIN",
    regularPriceKurus: 109900,
    category1: "Tişört",
    category2: "LMNOR DROP 01",
    sortOrder: 30,
  },
  {
    id: "lmnor-waynes-culture",
    name: "LMNOR WAYNES CULTURE",
    regularPriceKurus: 109900,
    category1: "Tişört",
    category2: "LMNOR DROP 01",
    sortOrder: 40,
  },
  {
    id: "lmnor-legacy-tee",
    name: "LMNOR LEGACY TEE",
    regularPriceKurus: 109900,
    category1: "Tişört",
    category2: "LMNOR DROP 01",
    sortOrder: 50,
  },
]);

const ALLOWED_SIZES = new Set(["XS", "S", "M", "L", "XL", "XXL"]);

module.exports = { PRODUCT_SEEDS, ALLOWED_SIZES };
