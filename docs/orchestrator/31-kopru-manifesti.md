# 31 — Köprü manifesti: her agent neye erişebilir

**Ne yaptım:** `buildBridgeManifest(terminalId)` — bir agent'ın API üzerinden
görebildiği her şeyi tek yerde toplar:

- **Orkestratör:** link'le bağlı işçiler, kaynaklar ve modeller (eskisi gibi).
- **Her agent:** pipeline ile bağlı olduğu agent'lar (Claude ↔ Gemini ↔
  Codex…), AI modelleri ve kaynaklar.
- Modeller (AI düğümleri) ayrı listede: bağlayıcı, model, taşıma yolu ve
  persona ile.
- **Kabuk terminalleri asla eş olamaz:** bir kabuğa yapıştırılan mesaj komut
  olarak çalışırdı.

`buildOrchestratorManifest` artık bunun üstüne kurulu; eski `orchestrator`
alanı korunuyor. Renderer `window.__tcApi.getBridgeManifest` ile ana sürece
açıyor.

**Dosyalar:** `src/actions/orchestrationSceneActions.ts`, `src/App.tsx`,
`tests/bridge-manifest.test.ts`
