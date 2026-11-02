# 58 — Şablon: Model konseyi

**Ne yaptım:** Sağ tık → **Şablonlar ▸ Model konseyi**:

- Tıkladığın yere bir orkestratör (Claude) açar,
- sağına alt alta **Claude, Gemini ve ChatGPT** AI düğümlerini koyar ve
  orkestratöre bağlar.
- Her düğüm, anahtarı yoksa ama CLI'ı kuruluysa CLI yolunda başlar.

Orkestratöre "bu üç modele aynı soruyu sor ve karşılaştır" ya da "Gemini ile
ChatGPT bu konuyu 2 tur tartışsın" demen yeterli (`council`, `discuss`).

**Dosyalar:** `src/actions/orchestrationSceneActions.ts`,
`src/canvas/XyFlowCanvas.tsx`, `src/i18n/en.ts`, `tests/bridge-manifest.test.ts`
