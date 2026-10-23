# 10 — Canvas entegrasyonu

**Ne yaptım:** Kaynak düğümlerini ve kabloları canvas'a bağladım:

- Kaynak düğümleri terminallerle birlikte çiziliyor; sürükleyince konumları
  kaydediliyor.
- Kablo sürüklemek açık; yalnızca orkestratör çıkışından orkestratör olmayan bir
  girişe bağlanabiliyor.
- Boş canvas sağ tık menüsü: **New Orchestrator**, **Add Google Sheet / n8n
  Webhook / HTTP API / Local File / Note**.
- Açılışta her orkestratörün köprü dosyaları yeniden yazılıyor (API portu her
  açılışta değişir).

**Dosyalar:** `src/canvas/XyFlowCanvas.tsx`
