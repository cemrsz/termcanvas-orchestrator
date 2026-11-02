# TermCanvas Orkestratör

Bu fork, [TermCanvas](https://github.com/blueberrycongee/termcanvas) v0.39.10'a
n8n tarzı bir **orkestratör agent** ekler: tek bir agent'a komut verirsin, o da
canvas'ta kabloyla bağlı agent'lara iş dağıtır ve bağlı kaynakları (Google Sheet,
n8n webhook, HTTP API, yerel dosya, not) kullanır.

Değişiklikler 15 commit halinde eklendi. Her commit kendi kısa notunu bu klasöre
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
16. [Bağlayıcı kataloğu](16-baglayici-katalogu.md) — Claude, Gemini, ChatGPT ve diğer sağlayıcılar; API ve CLI taşıma yolları
17. [Bağlayıcılar: API](17-baglayici-http.md) — üç protokol için istek kurma, cevap okuma ve okunur hata mesajları
18. [Bağlayıcılar: CLI](18-baglayici-cli.md) — abonelik girişiyle, anahtarsız tek seferlik CLI çağrısı
19. [Bağlayıcı servisi](19-baglayici-servisi.md) — şifreli anahtarlar, ortam değişkenleri, CLI kontrolü, model listesi
20. [Bağlayıcılar: soru sorma](20-baglayici-cagirma.md) — invoke(): model çözümü, yerel sunucu, CLI hata ve süre aşımı
21. [Test: bağlayıcı servisi](21-baglayici-testleri.md) — şifreli anahtar, ortam değişkeni, API ve CLI çağrıları
22. [IPC: ai kanalları](22-baglayici-ipc.md) — durum, anahtar, model listesi ve invoke için window.termcanvas.ai
23. [Haberleşme kaydı](23-haberlesme-kaydi.md) — AI'lar arası her mesaj için tip ve 400 kayıtlık tampon
24. [Haberleşme akışı: IPC](24-haberlesme-ipc.md) — comms:entry yayını, list/clear ve AI Hub çağrılarının kaydı
25. [Haberleşme akışı: store](25-haberlesme-store.md) — kablo nabzı, meşgul model sayacı ve okunmamış rozeti
26. [Veri modeli: pipeline ve AI düğümü](26-pipeline-veri-modeli.md) — yönsüz pipeline kabloları, ai kaynak türü, BridgeManifest

## Nasıl kullanılır

1. Boş canvas'a sağ tıkla → **New Orchestrator**. Projedeki agent terminalleri
   (Claude, Codex, …) otomatik olarak ona bağlanır.
2. Agent'lara başlıklarından rol adı ver (ör. "Copywriter"). Orkestratör işi bu
   isimlere bakarak dağıtır; isimler yeniden başlatmada korunur.
3. Kaynak eklemek için sağ tık → **Add Google Sheet / n8n Webhook / HTTP API /
   Local File / Note**, sonra düğümün adresini ve notunu doldur. Tek orkestratör
   varsa yeni kaynak ona otomatik bağlanır.
4. Kablo çekmek için orkestratörün kenarındaki noktadan bir agent'a ya da kaynağa
   sürükle; kesmek için kablonun ortasındaki × işaretine tıkla. Terminal başlığına
   sağ tıklayınca *Connect / Disconnect / Make Orchestrator* da var.
5. Komutu sadece orkestratörün terminaline yaz.

Orkestratör, projenin içindeki `.termcanvas/orchestrator/<id>/tc.mjs` aracını
kullanır:

| Komut | Ne yapar |
| --- | --- |
| `status` | Bağlı agent'ları ve kaynakları listeler |
| `send <agent> <metin>` / `--file` | Agent'a görev yollar |
| `wait <agent>` | Agent'ın turu bitene kadar bekler, cevabını yazar |
| `ask <agent> <metin>` | `send` + `wait` |
| `reply <agent>` | Son cevabı tekrar gösterir |
| `source <kaynak> [--query]` | Kaynağı okur (Sheet → CSV, n8n/API → GET, dosya, not) |
| `trigger <kaynak> --data '<json>'` | n8n/API kaynağına POST atar (eylem) |

Notlar:

- Google Sheet doğrudan CSV olarak okunur; bunun için "bağlantıya sahip olan
  herkes görüntüleyebilir" paylaşımı gerekir. Özel Sheet için
  [`integrations/n8n`](../../integrations/n8n/build-leads-webhook.mjs) ile bir
  okuma webhook'u kur ve onu **n8n Webhook** kaynağı olarak bağla (bkz. not 15).
- Orkestratör yalnızca kabloyla bağlı agent'lara iş gönderebilir.
- Dış dünyayı değiştiren `trigger` çağrılarını yalnızca komut bunu açıkça
  istediğinde yapacak şekilde talimatlandırılmıştır.
