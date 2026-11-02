# 22 — IPC: `ai:*` kanalları

**Ne yaptım:** Arayüzün bağlayıcılarla konuşabilmesi için ana süreçte
`AiConnectorService`'i kurdum ve `window.termcanvas.ai` köprüsünü ekledim:

| Kanal | Ne yapar |
| --- | --- |
| `ai:status` | Tüm bağlayıcıların durumu (anahtar var mı, CLI, model) |
| `ai:set-key` / `ai:clear-key` | Anahtarı kaydet / sil (şifreli) |
| `ai:set-config` | Varsayılan model ve adres |
| `ai:check-cli` | CLI kurulu mu, sürümü ne |
| `ai:list-models` | Sağlayıcıdan güncel model listesi |
| `ai:invoke` | Tek soru sor (API veya CLI) |

- API çağrıları Electron'un `net.fetch`'i ile yapılıyor; sistem proxy
  ayarlarına uyuyor.
- Anahtarlar ve CLI'lar için giriş kabuğunun ortamı kullanılıyor (Finder'dan
  açılan uygulama da `GEMINI_API_KEY`'i görür).
- Tek seferlik CLI'lar TermCanvas'ın kancalarına olay göndermesin diye
  `TERMCANVAS_SOCKET` / `TERMCANVAS_TERMINAL_ID` temizleniyor.
- Hatalar IPC üzerinden `{ ok: false, code, error }` olarak dönüyor.

**Dosyalar:** `electron/main.ts`, `electron/preload.ts`, `src/types/index.ts`
