# 63 — AI Hub: Konsey

**Ne yaptım:** Hub'a **Konsey** sekmesi: tek bir soruyu birden çok AI'a aynı
anda sorup cevapları yan yana görme.

- Üstte "Sor:" çipleri — o an kullanılabilen her sağlayıcı (anahtarı olan ya
  da CLI'ı kurulu). İlk açılışta hazır olan Claude, Gemini, ChatGPT seçili.
  İkisi de mümkünse çipin yanındaki `API` / `CLI` etiketine tıklayıp yol
  değiştirilir.
- Soru kutusu (⌘/Ctrl + Enter gönderir) → her AI'ın cevabı kendi renginde bir
  kartta; süre, model, kopyala düğmesi. Hata kırmızı.
- En az iki cevap gelince **"<AI> ile özetle"**: cevapları birine verip
  ortak noktaları, ayrışmaları ve en iyi birleşik cevabı yazdırır.
- Son konsey Hub kapatılıp açılınca kaybolmaz. Her çağrı akışa
  "konsey" etiketiyle düşer.

**Dosyalar:** `src/components/AiHub/CouncilTab.tsx`,
`src/components/AiHub/AiHubModal.tsx`, `src/i18n/en.ts`
