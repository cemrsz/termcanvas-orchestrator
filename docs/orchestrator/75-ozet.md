# 75 — Özet: 16–75

Bu 60 commit'lik bölümde eklenenler:

- **Eklentiler (bağlayıcılar):** Claude, Gemini, ChatGPT ve 9 sağlayıcı için
  ortak katalog; Anthropic / Gemini / OpenAI uyumlu API çağrıları; `claude -p`,
  `gemini`, `codex exec` ile anahtarsız CLI yolu; anahtarlar işletim sistemi
  anahtar zinciriyle şifreli (16–22).
- **Haberleşme akışı:** AI'lar arası her mesajın kaydı, canlı yayın, kablo
  nabzı (23–25, 36, 51).
- **Pipeline'lar:** agent ↔ agent ve agent ↔ AI/kaynak kabloları, her agent
  için `BRIDGE.md` + `tc.mjs`, `/bridge` API'si, mesaj çerçevesi, kilitlenme ve
  döngü korumaları, kablo çekince otomatik bilgilendirme (26–35, 45, 48–50).
- **Gemini CLI düzeltmeleri:** ekrandan cevap okuma, sessizlikle tur sonu,
  `--prompt-interactive` / `--yolo` (37–39, 46).
- **Köprü komutları:** `ask` (agent veya model), `consult`, `council`,
  `discuss`, `broadcast`; kum havuzu ipuçları; uçtan uca testler (40–44).
- **Arayüz:** AI düğümü (test, düşünüyor ışığı, son cevap), alt menüler,
  şablonlar (Claude ⇄ Gemini ⇄ Codex, model konseyi), rozetler, terminal
  menüsü (47, 52–60, 65).
- **AI Merkezi:** bağlayıcı kartları, konsey, akış, araç çubuğu düğmesi ve
  ⌘⇧Y, komut paleti (61–67).
- **Dil:** Çince ve Türkçe metinler, Türkçe arayüz seçeneği, doğru Türkçe
  büyük harf (68–71).
- **Test ve belgeler:** 12 yeni test dosyası `pnpm test`'te, kılavuz, README
  (72–75).

**Dosyalar:** `docs/orchestrator/README.md`
