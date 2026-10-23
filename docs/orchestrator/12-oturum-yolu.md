# 12 — Düzeltme: Claude oturum yolu

**Sorun:** TermCanvas, Claude oturum dosyasının klasör adını üretirken sadece
`/ \ . :` karakterlerini `-` yapıyordu. Claude Code ise harf ve rakam dışındaki
**her** karakteri `-` yapıyor. Boşluk, `_` veya Türkçe harf içeren projelerde
(ör. `Repolar calismalar/Coldmalil_n8n-Whıdırcan`) oturum dosyası hiç
bulunamıyordu; agent cevapları okunamıyordu.

**Düzeltme:** `toClaudeProjectKey` artık `[^a-zA-Z0-9]` karakterlerini `-`
yapıyor. Bunun için bir test eklendi.

**Dosyalar:** `electron/session-watcher.ts`, `tests/session-watcher.test.ts`
