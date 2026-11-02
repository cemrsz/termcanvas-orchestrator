# 43 — ORCHESTRATOR.md: modeller ve yeni komutlar

**Ne yaptım:** Orkestratörün çalışma talimatı güncellendi:

- Bağlı olabilecekler artık: Claude / Codex / **Gemini** agent'ları, **AI
  modelleri** (Claude, Gemini, ChatGPT… düğümleri) ve veri kaynakları.
- Komut tablosuna `ask <agent|model>`, `consult`, `council`, `discuss`,
  `broadcast` eklendi; agent türüyle (`gemini`) de seçilebiliyor.
- Yeni kural: **modeller düşünmek içindir, iş yapmak için değil** — ikinci
  görüş, yapıştırılan diff'in incelemesi, beyin fırtınası, çeviri, doğrulama.
  Tek seferde cevap verir, dosya göremez; gerekeni mesaja koy. Birden çok görüş
  istenirse `council`, tartışma/uzlaşma istenirse `discuss`. Depodaki asıl işi
  agent'lar yapar.

**Dosyalar:** `electron/orchestrator-bridge.ts`
