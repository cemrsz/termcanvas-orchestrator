# 07 — Sahne eylemleri

**Ne yaptım:**

- `createOrchestratorInScene` — yeni bir Claude terminali açar, köprü
  dosyalarını hazırlar, onu orkestratör yapar ve projedeki agent'ları bağlar.
- `makeTerminalOrchestrator` — çalışan bir agent'ı orkestratöre çevirir ve
  talimatını o oturuma yapıştırır.
- `addOrchestrationSourceInScene` — kaynak düğümü ekler (tek orkestratör varsa
  ona bağlar).
- `buildOrchestratorManifest` / `listOrchestrators` — API'nin kullandığı,
  sadece bağlı düğümleri içeren özet.

`App.tsx` bu özetleri ana sürecin okuyabilmesi için `window.__tcApi`'ye ekliyor.

**Dosyalar:** `src/actions/orchestrationSceneActions.ts`, `src/App.tsx`
