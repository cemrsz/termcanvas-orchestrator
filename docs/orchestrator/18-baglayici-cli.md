# 18 — Bağlayıcılar: CLI ile çağırma

**Ne yaptım:** Sağlayıcının kendi CLI'ını terminal açmadan, bir kez çalıştıran
yardımcılar. Böylece Claude / Google / ChatGPT aboneliğinle giriş yaptıysan
API anahtarı gerekmez:

| Bağlayıcı | Komut |
| --- | --- |
| Claude | `claude -p --output-format text [--model m]` |
| Gemini | `gemini [--model m]` (stdin'den, başsız mod) |
| ChatGPT | `codex exec --output-last-message <dosya> [--model m] -` |

Prompt her zaman **stdin**'den gider, komut satırına yazılmaz (tırnak sorunu
ve Windows'taki uzunluk sınırı yok). Süre aşılırsa süreç grubu tamamen
kapatılır; CLI arkasında MCP sunucusu bırakmaz.

**Dosyalar:** `electron/ai-connector-cli.ts`, `tests/ai-connector-cli.test.ts`
