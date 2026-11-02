# 45 — Pipeline kurulunca agent'lar bilgilendirilir

**Ne yaptım:** Kabloyu çektiğin anda iki uçtaki agent da kime bağlı olduğunu
öğreniyor; "Gemini'ye sor" dediğinde ne yapacağını biliyor:

- `connectPipeInScene(a, b)` — pipeline'ı kurar (uçlardan en az biri agent
  olmalı, kabuklar asla bağlanmaz) ve agent uçlarını bilgilendirir.
- `briefAgentAboutPipes(id)` — agent'ın `BRIDGE.md` + `tc.mjs` dosyalarını
  yazar ve sohbetine tek satırlık bir bilgilendirme yapıştırır:
  "[TermCanvas] Artık şunlara bağlısın: Gemini (gemini), Codex (codex).
  BRIDGE.md'yi oku…".
- Agent o an çıktı üretiyorsa (meşgul) bilgilendirme 2 sn arayla bekletilir,
  en fazla 3 dakika. Agent çalışmıyorsa atlanır.
- Her konuşma (terminal + oturum) bir kez bilgilendirilir; sonraki
  kablolar için agent `peers` ile güncel listeyi görür. Yeni oturum açılırsa
  tekrar bilgilendirilir.
- Bilgilendirme akışa da düşer (`comms:record-brief`).

**Dosyalar:** `src/actions/orchestrationSceneActions.ts`, `electron/main.ts`,
`electron/preload.ts`, `src/types/index.ts`, `tests/bridge-manifest.test.ts`
