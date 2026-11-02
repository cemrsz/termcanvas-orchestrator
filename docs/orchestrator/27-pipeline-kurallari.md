# 27 — Store: pipeline kuralları

**Ne yaptım:** `useOrchestrationStore`'a `connectPipe(a, b)` ve
`disconnectPipe(id)` eklendi. Kurallar:

- Bir düğüm kendine bağlanamaz; aynı pipeline iki kez çekilemez (yön fark
  etmez).
- Orkestratörler pipeline ucu olamaz; iki kaynak/AI düğümü birbirine
  bağlanamaz (aralarında konuşacak bir agent yok).
- Bir agent **orkestratöre çevrilince** pipeline'ları kaybolmaz: bağlı olduğu
  agent'lar ve kaynaklar onun işçisi/kaynağı (link) olur.
- Kaynak silinince ona giden pipeline'lar da silinir.
- Pipeline'daki agent'ların başlıkları da korunur (otomatik özet
  yeniden adlandırmaz), çünkü diğer agent'lar onlara bu isimle yazar.

Yardımcılar: `pipeOtherEnd`, `findPipe`, `pipePeers`.

**Dosyalar:** `src/stores/orchestrationStore.ts`
