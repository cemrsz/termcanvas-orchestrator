# 38 — Ekran okuma köprüye bağlandı

**Ne yaptım:**

- Renderer: `readTerminalText(id, satır)` — xterm'in **çizilmiş** ekranını
  düz metin olarak verir (kaydırılmış satırlar birleştirilir). Ham PTY
  çıktısından çok daha temiz: TUI'lerin imleç hareketleri, dönen
  göstergeler yok. `window.__tcApi.readTerminalText` ile ana sürece açık.
- `reply`: agent'ın oturum kaydı yoksa cevap ekrandan okunuyor; başlangıç
  noktası olarak o agent'a en son yapıştırılan mesaj kullanılıyor.
- `agent` durumu: tur bilgisi gelmeyen agent'larda (Gemini CLI) ekranda onay
  sorusu varsa `awaitingApproval: true` dönüyor; Claude/Codex'te bu zaten
  kancalardan geliyor.

**Dosyalar:** `src/terminal/terminalRegistry.ts`, `src/App.tsx`,
`electron/api-server.ts`
