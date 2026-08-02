# LMNOR iyzico Backend v2 — Sipariş Veritabanı

Bu sürüm mevcut iyzico Sandbox ödeme akışına Neon Postgres sipariş kaydı ekler.

## Eklenenler

- Ödeme başlatılmadan önce sipariş veritabanına `pending_payment` olarak kaydedilir.
- iyzico sonucu doğrulanır ve sipariş `paid` veya `payment_failed` olarak güncellenir.
- Başarı URL'sine `orderId` eklenir.
- `/api/order-status?orderId=...&email=...` sipariş takip altyapısı hazırdır.
- `/api/health` veritabanı bağlantısını kontrol eder ve tabloyu ilk çağrıda otomatik oluşturur.

## Vercel değişkeni

Neon entegrasyonundan gelen `DATABASE_URL` Production ve Preview ortamlarında bulunmalıdır.

## Güncelleme

Bu paketteki dosyaları GitHub reposundaki aynı dosyaların üzerine yükleyin. Vercel GitHub değişikliğini algılayıp yeni deployment başlatır.

Deploy bittikten sonra:

```text
https://lmnor-iyzico-backend.vercel.app/api/health
```

Yanıtta şunlar görünmelidir:

```json
{
  "ok": true,
  "mode": "sandbox",
  "database": "connected"
}
```

## Güvenlik

- API ve Secret Key yalnızca Vercel Environment Variables içindedir.
- Kart bilgileri LMNOR backend'ine gelmez.
- Fiyatlar yalnızca `lib/catalog.js` içinden hesaplanır.
- Sipariş takip sorgusu sipariş numarası ve e-posta eşleşmesi ister.
