# 56 — Canvas sağ tık menüsü yeniden düzenlendi

**Ne yaptım:** Boş canvas'a sağ tıklayınca:

- **Yeni Shell / Claude / Codex / Gemini / Lazygit** — agent'ların yanında
  kendi renkleriyle nokta.
- **Yeni Orkestratör ▸** Claude · Codex · Gemini
- **AI Modeli Ekle ▸** Claude · Gemini · ChatGPT ── DeepSeek · Grok ·
  Mistral · Perplexity · OpenRouter · Groq · Ollama · LM Studio · Custom.
  Yanlarında "API · CLI" / "yerel" ipucu. Eklenen düğüm API anahtarı yoksa ama
  CLI kuruluysa (ör. Google girişli Gemini CLI) doğrudan CLI yolunda başlar;
  canvas'ta tek orkestratör varsa ona bağlanır.
- **Kaynak Ekle ▸** Google Sheet · n8n Webhook · HTTP API · Yerel Dosya · Not

Menü metinleri çeviriye hazır (i18n anahtarları); eski düz İngilizce
etiketlerin yerini aldı. Yeni eylem: `addAiNodeInScene`.

**Dosyalar:** `src/canvas/XyFlowCanvas.tsx`,
`src/actions/orchestrationSceneActions.ts`, `src/i18n/en.ts`
