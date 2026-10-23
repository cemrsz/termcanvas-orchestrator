# 13 — Düzeltme: agent isimleri korunuyor

**Sorun:** TermCanvas, terminalin Claude oturumu değişince başlığını siliyor
(başlıkları oturum özeti sayıyor). Hiç konuşma yapmamış agent'lar her açılışta
yeni oturum aldığı için rol adları ("Copywriter" gibi) kayboluyordu; orkestratör
de işi bu isimlere göre dağıtıyor.

**Düzeltme:** Orkestratörler ve onlara bağlı agent'lar oturum değişse de
başlıklarını koruyor; otomatik özet de onları yeniden adlandırmıyor. Diğer
terminaller eskisi gibi davranıyor.

**Dosyalar:** `src/terminal/terminalRuntimeStore.ts`,
`src/terminal/summaryScheduler.ts`
