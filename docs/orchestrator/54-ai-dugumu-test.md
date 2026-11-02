# 54 — AI düğümü: test, "düşünüyor" ve son cevap

**Ne yaptım:**

- **Test** düğmesi: düğümün ayarlarıyla (sağlayıcı, model, yol, persona)
  kısa bir soru sorar ("kimsin, hangi modelde çalışıyorsun?"). Anahtar,
  model adı veya CLI girişi doğru mu, canvas'tan çıkmadan görülür. Soru ve
  cevap akışa "test" etiketiyle düşer.
- **Düşünüyor:** düğüme bir agent'tan ya da testten soru gittiğinde cevap
  gelene kadar çerçeve sağlayıcının renginde nabız gibi parlar, düğme
  "düşünüyor…" olur.
- **Son cevap:** düğümün en son cevabı (veya hatası, kırmızı) iki satırlık
  önizleme olarak görünür; süre ve token sayısıyla. Üzerine gelince tamamı.
- Hareketi azalt ayarında parlama animasyonu kapalı.

**Dosyalar:** `src/canvas/AiNode.tsx`, `src/index.css`, `src/i18n/en.ts`
