# 50 — Canvas: pipeline kablosu (⇄)

**Ne yaptım:** Pipeline'lar canvas'ta çiziliyor:

- Kablo iki ucun renkleri arasında **geçişli**: Claude turuncusundan Gemini
  mavisine, Codex morundan ChatGPT yeşiline… Hangi AI'ların konuştuğu bir
  bakışta görünüyor.
- Ortada `⇄` işareti (iki yönlü olduğunu söyler); üzerine gelince `×` olur,
  tıklayınca kablo kesilir.
- Uçlardan biri çıktı üretirken kablo kesik çizgiyle akar (orkestratör
  kablolarındaki gibi).
- Kablo her zaman agent ucundan başlar, düğümlerin birbirine bakan
  kenarlarından çıkar; ucu silinmiş pipeline'lar çizilmez.

**Dosyalar:** `src/canvas/orchestrationFlow.tsx`, `src/canvas/XyFlowCanvas.tsx`,
`tests/wire-intent.test.ts`
