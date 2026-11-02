# 53 — Canvas: AI düğümü

**Ne yaptım:** Canvas'ta bir AI modelini temsil eden düğüm (Claude, Gemini,
ChatGPT, DeepSeek, Grok, Ollama…):

- **Başlık:** sağlayıcının renginde; ad düzenlenebilir, sağdan sağlayıcı
  seçilir (öne çıkanlar başta), × ile silinir.
- **Model:** serbest metin + öneri listesi (katalog + sağlayıcıdan çekilen
  liste). Boşsa ipucu varsayılanı gösterir ("default: gpt-5"; CLI'da "CLI'ın
  varsayılan modeli").
- **Yol:** `API | CLI` anahtarı. CLI'ı olmayan sağlayıcıda CLI kapalı.
  Yanında hazır olup olmadığı: "anahtar …9fQe", "GEMINI_API_KEY'den",
  "yerel sunucu", "API anahtarı yok" (kırmızı), "CLI 0.21.0", "CLI kurulu
  değil". CLI seçilince kurulu mu otomatik kontrol edilir.
- **Rol:** modelin personası ("katı kod inceleyicisi; maddeler hâlinde
  cevap ver").
- **Alt satır:** kimlere bağlı ("Planner, Coder'a bağlı") ya da nasıl
  bağlanacağı.
- Sürükleyince konumu kaydediliyor; açık ve koyu temada test edildi.

**Dosyalar:** `src/canvas/AiNode.tsx`, `src/canvas/orchestrationFlow.tsx`,
`src/canvas/xyflowNodes.tsx`, `src/canvas/XyFlowCanvas.tsx`, `src/i18n/en.ts`
