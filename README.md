# LMNOR + iyzico Sandbox Backend

Bu proje LMNOR Framer sitesindeki sepeti iyzico **Checkout Form Sandbox** ödeme sayfasına yönlendirmek için hazırlanmıştır.

## Güvenlik

- Kart numarası, son kullanma tarihi ve CVV Framer'a veya bu backend'e gönderilmez.
- iyzico API Key / Secret Key yalnızca Vercel Environment Variables içinde tutulur.
- Ürün fiyatları tarayıcıdan kabul edilmez; `lib/catalog.js` içindeki sunucu kataloğundan hesaplanır.
- Bu başlangıç paketi **yalnızca sandbox testleri** için kilitlidir.
- Canlıya geçmeden önce gerçek fiyat kataloğu, sipariş veritabanı, stok düşme, e-posta ve webhook doğrulaması tamamlanmalıdır.

## Vercel kurulumu

1. Bu klasörü GitHub'da yeni bir repoya yükleyin.
2. Vercel Dashboard → **Add New → Project**.
3. GitHub reposunu seçip **Import**.
4. Deploy öncesi veya sonrasında Project → Settings → Environment Variables bölümüne `.env.example` içindeki anahtarları ekleyin.
5. `BACKEND_URL`, ilk deploy adresiniz belli olduktan sonra `https://proje-adiniz.vercel.app` şeklinde ayarlanmalıdır.
6. Environment Variable değişikliğinden sonra yeniden deploy edin.

## Kontrol

Tarayıcıdan:

```text
https://PROJENIZ.vercel.app/api/health
```

Aşağıdaki gibi yanıt almalısınız:

```json
{"ok":true,"service":"lmnor-iyzico-backend","mode":"sandbox"}
```

## Checkout isteği

Framer'daki checkout component'ı şu biçimde `POST /api/checkout` çağıracak:

```json
{
  "cart": [
    {
      "productId": "lucky-family-old",
      "size": "M",
      "quantity": 1
    }
  ],
  "buyer": {
    "name": "Test",
    "surname": "Kullanıcı",
    "email": "test@example.com",
    "gsmNumber": "+905555555555",
    "identityNumber": "11111111111",
    "address": "Test adresi",
    "city": "Ankara",
    "country": "Türkiye",
    "zipCode": "06000"
  }
}
```

Başarılı yanıtta `paymentPageUrl` döner. Framer bu adrese yönlendirme yapmalıdır.

## Ürün kimlikleri

- `lucky-family-old`
- `lmnor-jj`
- `lmnor-main`
- `lmnor-waynes-culture`
- `lmnor-legacy-tee`

Şimdilik tüm ürünler sandbox'ta **1,00 TL test fiyatına** ayarlanmıştır.
