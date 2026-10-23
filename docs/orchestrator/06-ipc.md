# 06 — IPC ve preload

**Ne yaptım:** Arayüzün ana süreçten orkestratör dosyalarını hazırlamasını
isteyebilmesi için `orchestrator:prepare` IPC kanalını ekledim
(`window.termcanvas.orchestrator.prepare`). Dosyaları yazıyor ve orkestratörün
ilk prompt'unu döndürüyor ("ORCHESTRATOR.md'yi oku, bağlantılarını söyle,
komut bekle").

**Dosyalar:** `electron/main.ts`, `electron/preload.ts`, `src/types/index.ts`
