# 24 — Gerçek test: bulunan sorunlar ve düzeltmeler

**Ne yaptım:** Her şeyi gerçek bileşenlerle denedim: uygulama sanal ekranda,
**gerçek Claude Code 2.1.310** (gerçek Opus 5.5 / Sonnet 5.5 / Haiku 5.5),
**gerçek n8n 2.44** sunucusu (webhook → iş akışı → TermCanvas), Sheet tarafında
ise `termcanvas-sheet-bridge.gs`'nin kendisini çalıştıran yerel bir sunucu
(Google hesabı olmadığı için Google'ın yerine o geçti).

## Ne çalıştı

| Senaryo | Sonuç |
| --- | --- |
| Sağ tık → New Team | 25 gerçek Claude açıldı; Director brifingini okuyup "4 yönetici, her birinde 5 işçi" diye ekibini doğru raporladı |
| Director'a klavyeyle komut: lead skorla + araştırma + e-posta taslağı + rapor | ~2 dk'da bitti. Data Manager Sheet'e `score` sütunu ekleyip 3 satırı `Scored` yaptı ("Contacted" satırına dokunmadı), Researcher 1 yazdı, Writer 1 `drafts/` altına taslak kaydetti, Director Türkçe ve tablolu rapor yazdı |
| Gerçek n8n webhook'u → TermCanvas | Olay Data Manager'a geldi; kaynak notundaki talimatla lead'i Sheet'e `Pending` ekledi |
| Ops 1 `trigger` → n8n → gelen kutusu → Data Manager | Zincir tamamlandı; lead eklenip skorlandı |
| Writer → Data Manager `msg` | Soru 3 sn'de cevaplandı, not panoya yazıldı, ikinci raporda doğru özetlendi |
| Kapat → aç (3 kez) | 25 terminalin hepsi aynı oturumla döndü (konuşması olanlar `--resume`, diğerleri aynı kimlikle `--session-id`); terminale yazılabiliyor; Director önceki işi hatırladı ("En yüksek skoru 8/10 ile Ayşe Demir aldı") |

## Bulunan sorunlar ve düzeltmeler

1. **Güvenilmeyen klasörde 25 agent da Claude'un "Bu klasöre güveniyor
   musun?" ekranında kalıyordu** ve seçili şık "No, exit"ti; bu ekrana
   yapıştırılan bir görev + Enter, Claude'u kapatırdı.
   → Ekip kurulurken klasör güvenilir değilse **bir kez** sorulur, onaylanırsa
   Claude'un kendi ayarı (`~/.claude.json` → `projects[<klasör>]
   .hasTrustDialogAccepted`) işaretlenir. Ayrıca güven, giriş, ilk kurulum
   ya da bypass uyarısı ekranındaki bir agent'a **asla** metin yazılmaz:
   `send` açık bir hata verir, kuyruk bekler (`electron/claude-trust.ts`).
2. **Akışta herkes "Onay bekliyorum" görünüyordu.** Claude bir dakika boşta
   kalınca "waiting for your input" bildirimi atıyor; bu onay isteği
   sanılıyordu (Director bile raporda bunu fark etti). → Yalnızca izin/onay
   bildirimleri "bekliyor" sayılıyor.
3. **Gelen görevler akışta `<pasted_content …>` olarak görünüyordu.** Claude
   yapıştırılan metni hook'a bu sarmalla veriyor. → Sarmal açılıyor; "Director
   görev verdi: …" doğru görünüyor.
4. **"Bitirdim: …" satırı çoğu zaman boştu, `wait` cevabı eksik
   kalabilirdi.** Stop hook'u geldiğinde son mesaj henüz oturum dosyasına
   yazılmamış oluyor. → Claude'un hook'ta gönderdiği `last_assistant_message`
   kullanılıyor; yöneticinin okuduğu cevaba da ekleniyor. Akışta ara anlatım
   yerine son mesaj gösteriliyor.
5. **Bir işçi, yöneticinin göreve yazdığı `tc.mjs` yolunu çalıştırıp
   yöneticinin kimliğiyle iş yaptı.** → Her terminalde zaten bulunan
   `TERMCANVAS_TERMINAL_ID` aracın kendisine iletiliyor; API komutu her zaman
   **çalıştıran** agent adına işliyor (işçi bu yolla görev dağıtamaz).
   Yöneticilere göreve araç yolu yazmamaları söylendi.
6. **Soru soran agent cevabı iki kez alıp fazladan tur harcıyordu.** →
   `msg <arkadaş> "<soru>" --wait`: cevap aynı turda gelir ve kuyruktan
   alınır. Gerçek testte Writer 2 cevabı 3 sn'de aldı, fazladan tur olmadı.
7. **Bir agent aracı `./tc.mjs` diye çalıştırınca "Permission denied".** →
   `tc.mjs` çalıştırılabilir olarak yazılıyor.
8. **Kanvasın sağ kenarına yakın sağ tıklayınca menü sağ panelin altında
   kesiliyordu; ortada ise ekranın sonuna kadar uzuyordu** (eski bir hata).
   → Menü `body`'ye taşındı, öğeler blok yapıldı, genişlik konumdan bağımsız
   ölçülüyor.
9. Yöneticiler işi daha sık kendileri yapıyordu (Data Manager işçi
   kullanmadan skorladı). → Talimat netleştirildi: iş astlara verilir,
   yönetici planlar, kontrol eder, özetler.

## Hâlâ bilinmesi gerekenler

- Google Sheets tarafı gerçek bir Google hesabıyla denenmedi; köprü kodu
  birebir çalıştırıldı ama Google'ın kendisi yerine yerel sunucu vardı.
- Windows'ta denenmedi.
- Zaten açık olan oturumlar yeni `AGENT.md` kurallarını ancak yeniden
  okuduklarında görür; kimlik düzeltmesi (5) ise araç düzeyinde olduğu için
  hemen geçerli.

**Dosyalar:** `electron/claude-trust.ts`, `electron/team-api.ts`,
`electron/team-hub.ts`, `electron/team-bridge.ts`,
`electron/orchestrator-bridge.ts`, `electron/main.ts`, `electron/preload.ts`,
`shared/teamActivity.ts`, `src/actions/orchestrationSceneActions.ts`,
`src/canvas/XyFlowCanvas.tsx`, `src/components/ContextMenu.tsx`,
`src/components/TeamPanel.tsx`, `src/types/index.ts`,
`tests/claude-trust.test.ts`, `tests/team-api.test.ts`, `tests/team-hub.test.ts`
