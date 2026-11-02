# 60 — Rozetler: kim kime bağlı

**Ne yaptım:** Kutuların altındaki rozetler bağlantıları bir bakışta
gösteriyor:

- **Orkestratör:** `◆ ORCHESTRATOR · 2 agent · 3 model · 1 kaynak` —
  model sayısı ayrı gösteriliyor (model yoksa yazılmıyor).
- **Pipeline'lı agent:** agent'ın renginde `⇄ Gemini, Codex` rozeti;
  üzerine gelince "Pipeline: Gemini, Codex ile konuşabilir". AI düğümü yeniden
  adlandırılınca rozet hemen güncelleniyor.

**Dosyalar:** `src/canvas/xyflowNodes.tsx`, `src/i18n/en.ts`
