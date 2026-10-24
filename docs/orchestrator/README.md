# TermCanvas Orkestratör

Bu fork, [TermCanvas](https://github.com/blueberrycongee/termcanvas) v0.39.10'a
n8n tarzı **agent ekipleri** ekler: tek bir agent'a (lider) komut verirsin, o
canvas'ta kabloyla bağlı yöneticilere ve agent'lara iş dağıtır. Kabloyla bağlı
herkes birbirini ve ekibe bağlı kaynakları (Google Sheet, n8n webhook, HTTP API,
yerel dosya, not) görür; Sheet'leri değiştirebilir, n8n çıktıları otomatik
olarak ekibe gelir, büyük işlerin sonunda lider okunaklı bir rapor yazar.

Değişiklikler commit commit eklendi. Her commit kendi kısa notunu bu klasöre
ekler; aşağıdaki liste commit sırasıyla aynıdır.

## Commit günlüğü

1. [Veri modeli](01-veri-modeli.md) — orkestrasyon grafiğinin tipleri
2. [Orkestrasyon store'u](02-store.md) — orkestratörler, kaynaklar ve kablolar için zustand store
3. [Sahne kaydı](03-kalicilik.md) — grafiği state.json'a yaz ve geri yükle
4. [Köprü aracı](04-kopru.md) — ORCHESTRATOR.md talimatı ve tc.mjs komut aracı
5. [API uçları](05-api.md) — /orchestrator uçları: manifest, agent, send, reply
6. [IPC ve preload](06-ipc.md) — orchestrator:prepare kanalı
7. [Sahne eylemleri](07-eylemler.md) — orkestratör oluşturma, dönüştürme, manifest
8. [Kaynak düğümleri ve kablolar](08-dugumler.md) — n8n tarzı kaynak düğümü, portlar, silinebilir kablo
9. [Terminal portları ve rozet](09-terminal-portlari.md) — orkestratör çerçevesi ve ORCHESTRATOR rozeti
10. [Canvas entegrasyonu](10-canvas.md) — kabloları çiz, sürükleyip bağla, sağ tık menüsü
11. [Terminal sağ tık menüsü](11-terminal-menusu.md) — Connect / Disconnect / Make Orchestrator
12. [Düzeltme: Claude oturum yolu](12-oturum-yolu.md) — boşluk, _ ve Türkçe harfli klasörlerde oturum dosyası bulunamıyordu
13. [Düzeltme: agent isimleri korunuyor](13-isimler.md) — bağlı agent'ların rol adları yeniden başlatmada silinmiyor
14. [Düzeltme: tarayıcı kartı sürükleme](14-tarayici-karti.md) — n8n kartı gibi tarayıcı kartları taşınamıyordu
15. [n8n okuma webhook'u ve kılavuz](15-n8n-ve-kilavuz.md) — özel Sheet'i n8n üzerinden okuma, kullanım kılavuzu
16. [Düzeltme: oturum geri yükleme](16-oturum-geri-yukleme.md) — açılışta aynı Claude oturumları geri gelir, kapanışta kayıt
17. [Ekip grafiği](17-ekip-grafigi.md) — kademeli yönetim, döngü engeli, ekibe paylaşılan kaynaklar, roller
18. [Ekip motoru](18-ekip-motoru.md) — her agent'a köprü, birbirini görme, mesaj, pano, etkinlik akışı, rapor
19. [n8n çıktıları](19-n8n-ciktilari.md) — sabit portlu gelen kutusu, iş akışı çıktısı otomatik olarak agent'a
20. [Sheet yazma](20-sheet-yazma.md) — Apps Script köprüsüyle agent'lar satır ekler ve günceller
21. [Hazır ekip](21-hazir-ekip.md) — sağ tık → 1 Opus · 4 Sonnet · 20 Haiku, org şeması yerleşimi
22. [Ekip paneli](22-ekip-paneli.md) — solda canlı "şunu yapıyorum" akışı, kadro ve rapor okuyucu
23. [Kılavuz ve doğrulama](23-dogrulama.md) — güncel kullanım kılavuzu, uçtan uca testler, bilinen sınırlar

## Nasıl kullanılır

### Hızlı başlangıç: hazır ekip

1. Boş kanvasa sağ tıkla → **New Team (1 Opus · 4 Sonnet · 20 Haiku)**
   (daha hafifi: **New Small Team**). 25 Claude terminali org şeması gibi
   yerleşir: en üstte **Director** (Opus), altında Research / Content /
   Data / Ops yöneticileri (Sonnet), her birinin altında 5 işçi (Haiku).
2. Komutu yalnızca **Director**'ın terminaline yaz. Director işi
   yöneticilere, yöneticiler işçilere dağıtır; büyük işlerin sonunda
   Director bir rapor yazar.
3. Sol paneldeki **Team** sekmesinden kimin ne yaptığını tek cümlelik
   satırlarla canlı izle; raporları oradan aç.
4. Uygulamayı kapatıp açtığında aynı 25 oturum, aynı konuşmalarıyla geri
   gelir.

### Kendi ekibini kurmak

1. Boş kanvasa sağ tıkla → **New Orchestrator**. Projedeki boşta duran agent
   terminalleri (Claude, Codex, …) ona bağlanır.
2. Agent'lara başlıklarından ad ver (ör. "Copywriter"); Team panelinde ✎ ile
   rol notu ekle. Adlar ve roller yeniden başlatmada korunur.
3. Kademeli ekip için bir agent'ı **Make Orchestrator** ile yönetici yap ve
   onu lidere bağla: liderin portundan yöneticinin **üst kenarındaki** porta
   sürükle. Döngü (bir yöneticinin kendi altındakine bağlanması) engellenir.
4. Kaynak eklemek için sağ tık → **Add Google Sheet / n8n Webhook / HTTP API /
   Local File / Note**; adresini ve notunu doldur, bir yöneticiye bağla.
   **Kaynak, ekipte kime bağlanırsa bağlansın tüm ekip onu görür.**
5. Kabloyla birbirine bağlı her agent ve kaynak aynı ekiptir: herkes
   kadroyu, kimin ne yaptığını ve ekip kaynaklarını görür; birbirine mesaj
   atabilir. Kesmek için kablonun ortasındaki × işaretine tıkla.

### Agent'ların aracı (`tc.mjs`)

Her ekip üyesinin projesinde `.termcanvas/agent/<id>/tc.mjs` ve kuralları
(`AGENT.md`) var. Agent'lar bunu kendileri kullanır; ekip komutları onay
istemez.

| Komut | Kim | Ne yapar |
| --- | --- | --- |
| `status` | herkes | Ben, yöneticim, astlarım, tüm ekip (durum + şu an ne yapıyor), kaynaklar |
| `say "<cümle>"` | herkes | Team paneline "şunu yapıyorum" |
| `msg <ekip arkadaşı> <metin>` | herkes | Mesaj; alıcı boşa çıkınca teslim edilir |
| `reply <agent>` | herkes | Bir ekip arkadaşının son cevabı |
| `board` / `post <metin>` | herkes | Ortak ekip panosu |
| `source <kaynak> [--query]` | herkes | Kaynağı okur (Sheet, n8n/API GET, dosya, not) |
| `sheet <kaynak> read/append/update/upsert` | herkes | Sheet satırı okur, ekler, günceller (not 20) |
| `trigger <kaynak> --data '<json>'` | herkes | n8n/API kaynağına POST (dış dünyada eylem) |
| `log [--since 2h]` | herkes | Ekibin yaptıkları |
| `send` / `wait` / `ask <ast>` | yöneticiler | Doğrudan astlara görev ver, cevabı bekle |
| `report --title … --file …` | en üstteki lider | Son raporu kaydet; Team panelinde açılır |

### n8n çıktıları agent'a

n8n kaynak düğümündeki "Workflow output → team" adresini kopyala ve
iş akışının sonuna bir HTTP POST (ya da
[`build-termcanvas-notify.mjs`](../../integrations/n8n/build-termcanvas-notify.mjs)
ile üretilen alt iş akışı) koy. Çıktı, kaynağın bağlı olduğu yöneticiye
otomatik olarak bir sonraki görevi olarak gelir (not 19).

### Notlar

- Özel bir Google Sheet'i okumak **ve yazmak** için
  [Apps Script köprüsünü](../../integrations/google-sheets/termcanvas-sheet-bridge.gs)
  kur ve adresini Sheet düğümünün ikinci alanına yapıştır (not 20). Yalnızca
  okumak için n8n okuma webhook'u da kullanılabilir (not 15). Herkese açık
  bir Sheet doğrudan CSV olarak okunur.
- Yöneticiler yalnızca doğrudan astlarına görev verebilir; mesaj her ekip
  arkadaşına atılabilir.
- Dış dünyayı değiştiren `trigger` ve Sheet yazmaları yalnızca komut bunu
  istediğinde yapılacak şekilde talimatlandırılmıştır.
- Ekip etkinliği, pano ve rapor dizini `~/.termcanvas/team/` altında; raporlar
  projede `.termcanvas/reports/` altında.
