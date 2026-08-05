# LMNOR iyzico Backend v5 — Dinamik Fiyat ve Kampanya Yönetimi

Bu sürüm v4.2'nin ödeme, sipariş, takip, yönetim paneli ve durum e-postası özelliklerini korur; ürün fiyatlarını Neon veritabanına taşır.

## Başlangıç normal fiyatları

- Lucky Family Old: 999 TL
- LMNOR JJ: 1099 TL
- LMNOR Main: 1099 TL
- LMNOR Waynes Culture: 1099 TL
- LMNOR Legacy Tee: 1099 TL

Bu fiyatlar `products` tablosu ilk kez oluşturulurken eklenir. Sonraki deployment'lar panelden değiştirilmiş fiyatların üzerine yazmaz.

## Yeni API'ler

- `GET /api/products` — sitede kullanılacak güncel normal/kampanyalı fiyatları verir.
- `GET /api/admin-products` — yönetici paneli için tüm fiyat ve kampanya ayarlarını verir.
- `POST /api/admin-product-update` — normal fiyat, kampanyalı fiyat, başlangıç/bitiş ve açık/kapalı ayarını kaydeder.

## Kampanya çalışma mantığı

Kampanyanın uygulanması için:

- Kampanya açık olmalı.
- Kampanyalı fiyat normal fiyattan düşük olmalı.
- Başlangıç tarihi boşsa hemen başlayabilir; doluysa o tarih gelmiş olmalı.
- Bitiş tarihi boşsa süresiz devam eder; doluysa tarih geçince otomatik biter.

Checkout tutarı müşterinin tarayıcısından alınmaz. Backend ödeme anında veritabanındaki geçerli fiyatı hesaplar ve iyzico'ya onu gönderir.

## Kurulum

Paketteki dosyaları mevcut GitHub reposunun üzerine yükleyip commit edin. Vercel otomatik deployment oluşturur. Yeni environment variable gerekmez.

Deployment Ready olduktan sonra `/api/products` adresi ürünleri ve güncel fiyatları JSON olarak göstermelidir.

## Önemli

Bu sürüm hâlâ `IYZICO_MODE=sandbox` güvenlik kilidini korur. Gerçek satışa geçmeden canlı iyzico ayarları ve yasal checkout alanları ayrıca tamamlanmalıdır.
