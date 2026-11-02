# 36 — Akışa kayıt: mesajlar, cevaplar, kaynaklar

**Ne yaptım:** AI'lar arasındaki her alışveriş artık akışta görünüyor:

- `send` → "Claude → Gemini: mesaj" (çerçevesiz, okunur hâliyle).
- `reply` / `wait` → "Gemini → Claude: cevap". Aynı cevap tekrar okunursa
  ikinci kez kaydedilmiyor.
- Köprü CLI'ı kaynak okumalarını (`source`) ve tetiklemeleri (`trigger`)
  yeni `POST /bridge/:id/event` ucuna bildiriyor; akışta "Claude → n8n:
  tetik (HTTP 200)" gibi görünüyor. Bildirim başarısız olsa bile komut
  bozulmuyor.

**Dosyalar:** `electron/api-server.ts`, `electron/bridge-script.ts`
