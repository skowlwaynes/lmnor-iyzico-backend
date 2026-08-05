# LMNOR iyzico Backend v4.2 — Sipariş Durum E-postaları

Bu sürüm; ödeme, Neon sipariş veritabanı, sipariş takibi ve güvenli yönetici paneline otomatik sipariş durum e-postaları ekler.

## Yeni API'ler

- `POST /api/admin-login` — yönetici şifresiyle 8 saatlik imzalı oturum tokenı üretir.
- `GET /api/admin-orders` — doğrulanmış yönetici oturumuyla siparişleri listeler ve arar.
- `POST /api/admin-order-update` — sipariş durumunu, kargo firmasını ve takip numarasını günceller.

## Güvenlik

- Yönetici şifresi Framer koduna veya GitHub'a yazılmaz.
- Yönetici, panelde şifreyi kendisi girer.
- Girişten sonra kısa ömürlü imzalı token kullanılır.
- Token tarayıcıda yalnızca `sessionStorage` içinde tutulmalıdır.
- API yalnızca `ALLOWED_ORIGINS` içindeki sitelerden gelen isteklere izin verir.
- Ödeme başarısız siparişler yönetici panelinden yanlışlıkla `paid` yapılamaz.
- `shipped` durumunda kargo firması ve takip numarası zorunludur.

## Yeni Vercel Environment Variables

- `ADMIN_PASSWORD`: En az 12 karakterlik güçlü yönetici şifresi.
- `ADMIN_SESSION_SECRET`: En az 32 karakterlik, şifreden farklı rastgele gizli değer.

Gerçek değerleri GitHub'a veya Framer'a koymayın.

## Kurulum

Bu paketteki dosyaları mevcut GitHub reposundaki aynı dosyaların üzerine yükleyin. Commit sonrası Vercel yeni deployment oluşturur.

Sonra Vercel Production ortamına `ADMIN_PASSWORD` ve `ADMIN_SESSION_SECRET` ekleyip Redeploy yapın.

## Sipariş durumları

- `paid` — Sipariş Alındı
- `preparing` — Hazırlanıyor
- `shipped` — Kargoya Verildi
- `delivered` — Teslim Edildi
- `cancelled` — İptal Edildi

Mevcut `/api/order-status` endpoint'i güncellenen durumu müşteriye otomatik gösterir.

## v4.1 CORS düzeltmesi
- `lmnorofficial.com`, `www.lmnorofficial.com` ve eski Framer alan adı backend içinde güvenli biçimde izinli hale getirildi.
- Ortam değişkenindeki sonda eğik çizgi/büyük-küçük harf gibi farklılıklar normalize edilir.


## v4.2 Durum e-postaları

Yönetici panelinden aşağıdaki durumlar kaydedildiğinde müşteriye Resend üzerinden otomatik e-posta gönderilir:

- `preparing` — Siparişiniz hazırlanıyor
- `shipped` — Siparişiniz kargoya verildi (kargo firması ve takip numarası dahil)
- `delivered` — Siparişiniz teslim edildi
- `cancelled` — Siparişiniz iptal edildi

Aynı sipariş için aynı durum e-postası yalnızca bir kez gönderilir. E-posta gönderimi başarısız olursa aynı durumu tekrar kaydederek yeniden denenebilir. İlk `paid` sipariş onay e-postası mevcut sistemdeki gibi ödeme callback'i üzerinden gönderilmeye devam eder.
