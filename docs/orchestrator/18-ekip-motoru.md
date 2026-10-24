# 18 — Ekip motoru: birbirini gören agent'lar, mesajlaşma, pano, rapor

**Ne yaptım:** Ekipteki **her** agent (yalnızca orkestratör değil) artık kendi
köprü aracına sahip ve ekibini görüyor.

- Her ekip üyesi için `.termcanvas/agent/<id>/` altında `AGENT.md` (role göre:
  işçi / yönetici / en üstteki lider) ve `tc.mjs` yazılıyor. Ana süreç bunu
  ekip dizini her değiştiğinde kendisi yapıyor; arayüzün bir şey
  çağırmasına gerek yok.
- Ekipteki Claude terminalleri `--append-system-prompt` ile "ekip üyesisin,
  AGENT.md'yi oku" bilgisini ve `--allowedTools "Bash(node .termcanvas/*)…"`
  iznini alıyor: ekip komutları her seferinde onay istemiyor, ilk görev için
  ekstra bir tur da harcanmıyor.
- Yöneticinin gönderdiği her görevin başında kısa bir başlık var
  (`[TermCanvas · task from …]`): agent sonradan bağlanmış olsa bile aracını
  ve kurallarını buluyor.

`tc.mjs` komutları:

| Komut | Kim | Ne yapar |
| --- | --- | --- |
| `status` | herkes | ben, yöneticim, astlarım, tüm ekip (durum + şu an ne yapıyor), ekip kaynakları |
| `say "<cümle>"` | herkes | Ekip paneline "şunu yapıyorum" cümlesi |
| `msg <ekip arkadaşı> <metin>` | herkes | Ekip arkadaşına mesaj; o boşa çıkınca teslim edilir |
| `reply <agent>` | herkes | Herhangi bir ekip arkadaşının son cevabı |
| `board` / `post` | herkes | Ekip panosu: ortak bulgular ve kararlar |
| `source`, `sheet … read/append/update`, `trigger` | herkes | Ekibe bağlı kaynaklar (sheet yazma dahil) |
| `log [--since 2h]` | herkes | Ekibin yaptıkları |
| `send` / `wait` / `ask` | yöneticiler | Yalnızca **doğrudan astlara** görev |
| `report --title … --file …` | en üstteki lider | Son raporu kaydeder |

**Teslim kuyruğu:** Mesajlar ve n8n olayları agent bir aracı çalıştırırken
ya da onay beklerken terminaline yapıştırılmıyor; agent boşa çıkınca
(en fazla 6 tanesi birleştirilerek) teslim ediliyor.

**Etkinlik akışı:** Claude/Codex hook olaylarından (araç kullanımı, gelen
komut, tur sonu, onay bekleme) otomatik tek cümleler üretiliyor
(`shared/teamActivity.ts`, Türkçe/İngilizce). Tur bitince cevabın ilk
cümlesi "Bitirdim: …" olarak yazılıyor. Akış, pano ve raporlar
`~/.termcanvas/team/` altında saklanıyor; uygulama yeniden açılınca geri
geliyor.

**Raporlar:** `report` komutu markdown'ı agent'ın projesinde
`.termcanvas/reports/<tarih>-<başlık>.md` olarak kaydediyor; Ekip panelinde
açılıyor (not 21).

**Dosyalar:** `electron/team-hub.ts`, `electron/team-api.ts`,
`electron/team-bridge.ts`, `electron/team-inbox.ts`,
`electron/orchestrator-bridge.ts`, `electron/api-server.ts`,
`electron/main.ts`, `electron/preload.ts`, `shared/teamActivity.ts`,
`src/stores/teamStore.ts`, `src/actions/teamDirectorySync.ts`,
`src/terminal/teamLaunch.ts`, `src/types/index.ts`, `src/App.tsx`,
`tests/team-hub.test.ts`, `tests/team-api.test.ts`
