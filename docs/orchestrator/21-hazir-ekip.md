# 21 — Hazır ekip: 1 Opus · 4 Sonnet · 20 Haiku

**Ne yaptım:** Boş kanvasa sağ tık menüsüne iki seçenek eklendi:

- **New Team (1 Opus · 4 Sonnet · 20 Haiku)** — 25 Claude terminali
- **New Small Team (1 Opus · 2 Sonnet · 6 Haiku)** — 9 terminal, daha hafif

Yapı genel amaçlı bir ekip (yalnızca cold mail için değil):

| Kademe | Model | Ad | Görev |
| --- | --- | --- | --- |
| Lider | `claude-opus-5-5` | Director | Komutu alır, yöneticilere dağıtır, sonuçları birleştirir, büyük işlerde rapor yazar |
| Yönetici | `claude-sonnet-5-5` | Research / Content / Data / Ops Manager | Kendi bölümünün işini 5 işçiye böler, kontrol eder, lidere özet verir |
| İşçi | `claude-haiku-5-5` | Researcher 1-5, Writer 1-5, Data 1-5, Ops 1-5 | Araştırma · metin/e-posta/doküman · Sheet/CSV verisi · otomasyon/kod/n8n |

- Kablolar ve roller terminaller açılmadan önce kuruluyor; her agent ilk
  açılışta modelini (`--model`), ekip bilgisini ve izinlerini alıyor.
- Yalnızca lider ilk açılışta brifingini okuyup "ekibimde kimler var"
  diye cevap veriyor; diğer 24 agent boşta bekliyor (ekstra maliyet yok).
- Komutu yalnızca **Director**'a yaz. O, yöneticilere `send` ile görev
  veriyor; yöneticiler kendi işçilerine. Herkes `status` ile tüm ekibi
  ve ekibe bağlı tüm kaynakları görüyor.
- İsimleri başlıktan, rolleri Ekip panelinden değiştirebilirsin; yeniden
  başlatmada korunur. Model kimlikleri `src/actions/teamTemplate.ts`
  içindeki `TEAM_MODELS`'te.
- Her açılışta aynı 25 oturum geri geliyor (not 16).

**Kanvas:** Ekip org şeması gibi yerleşiyor: lider üstte, yöneticiler bir
sıra altta, her yöneticinin altında iki sütunlu işçi ızgarası. Altta duran
bir hedefe kablo, yöneticinin alt kenarındaki porttan hedefin üst kenarına
çiziliyor.

**Kaynak kullanımı:** 25 Claude süreci birlikte açılıyor (sırayla, 150 ms
arayla). Her biri ayrı bellek kullanır; makine zorlanırsa küçük ekibi seç.

**Doğrulama:** Sahte `claude` ile uçtan uca: 25 terminal doğru model,
sistem promptu, izinler ve sabit oturum kimliğiyle açıldı; 24 kablo ve 25 rol
kaydedildi; kapat-aç sonrası 25'i de aynı oturumla geri geldi.
`tests/team-template.test.ts`: kademe sayıları, modeller, çakışmayan yerleşim.

**Dosyalar:** `src/actions/teamTemplate.ts`,
`src/actions/orchestrationSceneActions.ts` (`createTeamInScene`),
`src/canvas/XyFlowCanvas.tsx`, `src/canvas/orchestrationFlow.tsx`,
`tests/team-template.test.ts`
