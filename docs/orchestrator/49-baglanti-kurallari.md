# 49 — Canvas: kablo çekme kuralları

**Ne yaptım:** Canvas "gevşek bağlantı" moduna geçti: kablo herhangi bir
porttan başlayıp herhangi bir porta bırakılabiliyor, **yön önemli değil**.
Ne oluşacağına `resolveWireIntent` karar veriyor:

| Uçlar | Sonuç |
| --- | --- |
| orkestratör ↔ agent | orkestratörün işçisi (link) |
| orkestratör ↔ kaynak / AI düğümü | orkestratörün kaynağı (link) |
| agent ↔ agent | **pipeline** — ikisi de birbirine yazabilir |
| agent ↔ AI düğümü / kaynak | pipeline — agent ona danışabilir / okuyabilir |
| kabuk, iki kaynak, iki orkestratör, kendine | reddedilir |

Pipeline kurulunca iki uçtaki agent'lar otomatik bilgilendiriliyor (bkz. 45).
Sürüklerken çizilen kablo artık nötr vurgu renginde.

**Dosyalar:** `src/canvas/orchestrationFlow.tsx`, `src/canvas/XyFlowCanvas.tsx`,
`tests/wire-intent.test.ts`
