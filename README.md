# LMNOR iyzico Backend v6 — Kargo ve Ücretsiz Kargo

Bu sürüm v5 dinamik fiyat ve kampanya sistemini korur; kargo ücretini backend tarafında güvenli biçimde hesaplar.

## Kargo ayarları

- Kargo firması: Aras Kargo
- Sabit kargo ücreti: 170 TL
- Ücretsiz kargo sınırı: 3.000 TL
- Hazırlık süresi: 2–4 iş günü

Ürün ara toplamı 3.000 TL ve üzerindeyse kargo 0 TL olur. Altındaysa 170 TL eklenir. Checkout'a gönderilen müşteri verisindeki fiyatlara güvenilmez; ürün ve kargo tutarı backend tarafından hesaplanır.

## Yeni API

- `GET /api/store-config` — kargo, ücretsiz kargo sınırı ve hazırlık süresini verir.
- `GET /api/products` yanıtında ayrıca `storeConfig` alanı bulunur.

## Sipariş verileri

Siparişlerde ürün ara toplamı, kargo ve genel toplam ayrı tutulur:

- `subtotalKurus`
- `shippingKurus`
- `totalKurus`

## Kurulum

Paketteki dosyaları mevcut GitHub reposunun üzerine yükleyip commit edin. Vercel otomatik deployment oluşturur. Yeni environment variable gerekmez.

Bu sürüm hâlâ `IYZICO_MODE=sandbox` güvenlik kilidini korur.
