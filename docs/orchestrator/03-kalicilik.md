# 03 — Sahne kaydı

**Ne yaptım:** Orkestrasyon grafiği canvas kaydına (`scene.orchestration`)
yazılıyor ve uygulama açılırken geri yükleniyor. Diskten okurken alanlar tek tek
doğrulanıyor; bozuk kayıtlar atlanıyor.

**Dosyalar:** `src/canvas/sceneProjection.ts`, `src/snapshotBridge.ts`,
`src/canvas/canvasSceneIO.ts`

**Sonuç:** Uygulamayı kapatıp açınca orkestratör, kablolar ve kaynak düğümleri
yerinde duruyor. Orkestrasyonu olmayan sahnelerin kayıt biçimi değişmedi.
