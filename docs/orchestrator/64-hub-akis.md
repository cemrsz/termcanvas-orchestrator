# 64 — AI Hub: Akış

**Ne yaptım:** Hub'a **Akış** sekmesi: AI'ların birbirine söylediği her şeyin
canlı zaman çizelgesi.

- Her satır: saat · gönderen → alıcı (agent'lar kendi renginde, modeller
  sağlayıcı renginde, kaynaklar tür renginde) · tür etiketi (bilgilendirme,
  mesaj, cevap, soru, cevap, hata, okuma, tetik) · süre, token, model, yol,
  HTTP durumu · metin (3 satır; tıklayınca tamamı, seçilip kopyalanabilir).
- Filtreler: Tümü · Agent'lar ⇄ · Modeller · Kaynaklar · Hatalar; mesajlarda
  ve isimlerde arama; Temizle.
- Sohbet gibi: yeni mesaj gelince en alttaysan kendiliğinden kayar.
- Akış açıkken gelenler okunmuş sayılır; kapalıyken gelenler sekmede
  "Akış (3)" diye görünür.
- Boşken ne yapılacağını anlatıyor (iki agent'ı bağla ya da üçlü şablonunu
  kullan).

**Dosyalar:** `src/components/AiHub/FeedTab.tsx`,
`src/components/AiHub/AiHubModal.tsx`, `src/i18n/en.ts`
