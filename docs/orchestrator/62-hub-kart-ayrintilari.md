# 62 — AI Hub: CLI, model, test, canvas'a ekle

**Ne yaptım:** Her bağlayıcı kartı artık bağlantının tamamını yönetiyor:

- **CLI satırı:** "claude -p · 2.1.0", "gemini (headless) · 0.21.0",
  "codex exec · …" ya da "kurulu değil: npm install -g @google/gemini-cli";
  ↻ ile yeniden kontrol. Kart ilk açıldığında kendiliğinden kontrol edilir.
- **URL satırı** (Ollama, LM Studio, Custom): sunucu adresi; Enter/odak
  kaybında kaydedilir.
- **Model satırı:** bağlayıcının varsayılan modeli (öneri listeli); ☰ ile
  sağlayıcının güncel model listesi çekilir ("24 model var").
- **Test API / Test CLI:** kısa bir soru gönderir; cevap, süre ve model
  kartın altında, hata kırmızı. Akışa da düşer.
- **Canvas'a ekle:** o sağlayıcının AI düğümünü ekranın ortasına koyar ve
  Hub'ı kapatır (anahtar yoksa ama CLI varsa CLI yolunda başlar).

**Dosyalar:** `src/components/AiHub/ConnectorsTab.tsx`,
`src/actions/orchestrationSceneActions.ts`, `src/i18n/en.ts`
