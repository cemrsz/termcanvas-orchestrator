# 17 — Bağlayıcılar: API isteği ve cevabı

**Ne yaptım:** Üç protokol için isteği kuran ve cevabı okuyan saf fonksiyonlar:

- Anthropic → `POST /v1/messages` (`x-api-key`, `anthropic-version`)
- Gemini → `POST /models/<model>:generateContent` (anahtar başlıkta,
  adreste değil; "thought" parçaları cevaba girmez)
- OpenAI ve uyumlular → `POST /chat/completions` (Perplexity kaynakları
  cevabın sonuna eklenir)

Hata mesajları sağlayıcının kendi açıklamasını ve bir ipucu gösterir
(401 → anahtarı kontrol et, 404 → model adını kontrol et, 429 → kota).
Model listesi uçları da burada (`/v1/models`, `/models`).

**Dosyalar:** `electron/ai-connector-http.ts`, `tests/ai-connector-http.test.ts`
