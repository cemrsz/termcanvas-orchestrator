# 02 — Orkestrasyon store'u

**Ne yaptım:** `useOrchestrationStore` ekledim. Bir terminali orkestratör olarak
işaretleme, kaynak ekleme/güncelleme/silme, bağlama/kesme ve geri yükleme
işlemlerini tutuyor. Kurallar: bir orkestratör başka bir orkestratörün işçisi
olamaz, aynı kablo iki kez çekilemez.

**Ek yardımcılar:** `isAgentTerminalType` (hangi terminaller agent sayılır),
`isOrchestratedTerminal` (orkestratör veya bağlı agent mı), `captureOrchestration`
(kayıtta artık var olmayan terminallere giden kabloları ayıklar; grafik boşsa
sahneye hiç yazmaz).

**Dosyalar:** `src/stores/orchestrationStore.ts`
