# 29 — Kalıcılık: pipeline'lar ve AI düğümleri

**Ne yaptım:** Pipeline'lar ve AI düğümlerinin ayarları canvas kaydına
yazılıyor ve açılışta geri yükleniyor.

- Diskten okurken her pipeline doğrulanıyor: kimliği/uçları metin değilse,
  iki ucu aynıysa veya aynı kablo ters yönde ikinci kez kayıtlıysa atlanıyor.
- AI düğümünün bağlayıcısı tanınmıyorsa düğüm atlanıyor; tanınmayan taşıma
  yolu `api`'ye düşüyor.
- Kaydederken ucu artık canvas'ta olmayan pipeline'lar ayıklanıyor.
- Pipeline'dan önce kaydedilmiş sahneler değişmeden açılıyor (`pipes: []`).

**Dosyalar:** `src/snapshotBridge.ts`, `src/stores/orchestrationStore.ts`
