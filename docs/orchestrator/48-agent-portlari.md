# 48 — Canvas: her agent'ta port

**Ne yaptım:** Eskiden agent terminallerinde bağlantı noktası (port) sadece
canvas'ta bir orkestratör varken görünüyordu. Artık **her agent terminalinde**
(Claude, Gemini, Codex, Kimi, OpenCode…) başlık hizasında iki yanda port var:

- Rengi agent'ın rengi (Claude turuncu, Gemini mavi, Codex mor…).
- Üzerine gelince ipucu: "Başka bir agent'a veya AI düğümüne sürükle,
  pipeline kur".
- Orkestratörler kendi mor çıkış portlarını kullanmaya devam ediyor; kabuk,
  lazygit, tmux terminallerinde port yok.

**Dosyalar:** `src/canvas/orchestrationFlow.tsx`, `src/canvas/xyflowNodes.tsx`
