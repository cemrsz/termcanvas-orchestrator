# 24 — Haberleşme akışı: IPC ve canlı yayın

**Ne yaptım:** Ana süreçteki kayıt arayüze bağlandı:

- Her yeni kayıt pencereye `comms:entry` olayıyla anında gönderiliyor.
- `window.termcanvas.comms.list()` / `clear()` / `onEntry()` eklendi.
- Arayüzden yapılan model çağrıları (AI Hub, düğüm testi) da akışa düşüyor:
  `ai:invoke` isteğe bağlı ikinci parametreyle "Sen → Gemini" sorusunu ve
  cevabını (süre, token, model) kaydediyor; hata olursa `error` kaydı düşüyor.

**Dosyalar:** `electron/main.ts`, `electron/preload.ts`, `src/types/index.ts`
