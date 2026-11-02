# 46 — Düzeltme: Gemini terminali ilk prompt'la kapanıyordu

**Sorun:** TermCanvas başlangıç prompt'u olan bir terminali CLI'a prompt'u
konumsal argüman olarak vererek açıyor. Gemini CLI'da konumsal prompt **tek
seferlik** moddur: cevap verir ve çıkar. Bu yüzden prompt'la açılan (ör.
`termcanvas terminal create --type gemini --prompt …` ya da Gemini
orkestratör) bir Gemini terminali hemen kapanıyor, pipeline'da kalamıyordu.

**Düzeltme:** Gemini için başlangıç prompt'u `--prompt-interactive` ile
veriliyor; oturum açık kalıyor. Ayrıca "otomatik onay" seçili Gemini
terminalleri `--yolo` ile açılıyor (Claude ve Codex'teki karşılıkları gibi).

**Dosyalar:** `src/terminal/cliConfig.ts`, `tests/terminal-adapters.test.ts`
