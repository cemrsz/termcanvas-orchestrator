# 19 — Bağlayıcı servisi: anahtarlar ve durum

**Ne yaptım:** Ana süreçte çalışan `AiConnectorService`:

- API anahtarlarını `~/.termcanvas/ai-connectors.json` içinde tutar; işletim
  sisteminin anahtar zinciri varsa şifreli (`safeStorage`), yoksa düz ama
  `0600` izinli (arayüzde uyarı gösterilir).
- Kayıtlı anahtar yoksa giriş kabuğunun ortamındaki `*_API_KEY`
  değişkenlerine bakar.
- Bağlayıcı başına varsayılan model ve adres değiştirilebilir.
- `status()` her bağlayıcı için ne yapılabildiğini döndürür (anahtar var mı,
  son 4 karakteri, ortam değişkeni, CLI kurulu mu) — **anahtarın kendisi asla
  arayüze gitmez.**
- `checkCli()` CLI'ın kurulu olup olmadığını ve sürümünü bulur,
  `listModels()` sağlayıcıdan güncel model listesini çeker.

**Dosyalar:** `electron/ai-connector-service.ts`
