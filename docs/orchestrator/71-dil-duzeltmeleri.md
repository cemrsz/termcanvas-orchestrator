# 71 — Düzeltme: sayfa dili ve "Sen"

**Sorunlar:**

1. Sayfanın `<html lang>` değeri hep `en` kalıyordu. CSS büyük harfe
   çevirirken dile göre kural uyguluyor; Türkçede "diğer" → "DIĞER", "bilgi"
   → "BILGI" gibi yanlış (noktasız I) çıkıyordu. Ekran okuyucular da yanlış
   dili seçiyordu.
2. Akışta kullanıcı her dilde "You" diye görünüyordu (adı ana süreçten
   geliyor).

**Düzeltme:** Arayüz dili değişince (ve açılışta) `<html lang>` da
güncelleniyor (`tr`, `en`, `zh-CN`); artık "DİĞER SAĞLAYICILAR", "BİLGİ",
"TETİK". Akışta kullanıcı arayüz dilinde gösteriliyor: Sen / You / 你.

**Dosyalar:** `src/stores/localeStore.ts`, `src/components/AiHub/FeedTab.tsx`,
`src/i18n/en.ts`, `src/i18n/zh.ts`, `src/i18n/tr.ts`
