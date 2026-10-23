# 01 — Veri modeli

**Ne yaptım:** Orkestrasyon grafiğinin tiplerini ekledim: kaynaklar
(`sheet`, `n8n`, `api`, `file`, `note`), orkestratör → hedef kabloları ve
API'nin orkestratöre gösterdiği özet (`OrchestratorManifest`). `SceneDocument`'a
isteğe bağlı `orchestration` alanı eklendi.

**Dosyalar:** `src/types/orchestration.ts`, `src/types/scene.ts`

**Neden:** Orkestratör, agent'lar ve kaynaklar normal sahne verisi olarak
saklanacak; her şey bu tiplerin üstüne kuruluyor.
