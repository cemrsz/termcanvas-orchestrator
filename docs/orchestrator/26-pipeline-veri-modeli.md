# 26 — Veri modeli: pipeline'lar ve AI düğümleri

**Ne yaptım:** Orkestrasyon grafiğine iki şey ekledim:

- **Pipeline** (`OrchestrationPipe { id, a, b }`): iki düğüm arasında
  **yönsüz** kablo. Uçlardan en az biri agent terminali (Claude, Gemini,
  Codex…); diğeri başka bir agent, bir kaynak veya bir AI modeli olabilir.
  İki uç da birbiriyle konuşabilir. Orkestratörler pipeline ucu olmaz; onların
  kabloları eskisi gibi "link".
- **AI düğümü**: yeni kaynak türü `ai`. Hangi bağlayıcının (Claude, Gemini,
  ChatGPT…), hangi modelle ve hangi yoldan (API / CLI) cevap vereceğini tutar.
  Notlar alanı modelin rolü/personası olur.

API'nin agent'lara verdiği özet genelleşti: `BridgeManifest { self, agents,
models, sources }`. Orkestratörün eski `orchestrator` alanı uyumluluk için
duruyor.

**Dosyalar:** `src/types/orchestration.ts` (+ derlenmesi için küçük
uyarlamalar: store, sahne okuma, kaynak düğümü renkleri, manifest)
