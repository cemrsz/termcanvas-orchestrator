# 47 — Orkestratör Claude, Codex veya Gemini olabilir

**Ne yaptım:** `createOrchestratorInScene` artık bir `type` alıyor:
`"claude"` (varsayılan), `"codex"` veya `"gemini"`. Üçü de kabuk komutu
çalıştırabildiği için köprü CLI'ını kullanabiliyor. Gemini orkestratör, bir
önceki düzeltme sayesinde başlangıç talimatıyla açık kalıyor.

Canvas menüsündeki seçim bir sonraki arayüz adımlarında geliyor.

**Dosyalar:** `src/actions/orchestrationSceneActions.ts`
