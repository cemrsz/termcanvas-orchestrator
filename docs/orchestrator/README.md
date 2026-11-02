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
27. [Store: pipeline kuralları](27-pipeline-kurallari.md) — connectPipe/disconnectPipe, orkestratöre çevirince pipeline'lar link olur
28. [Store: AI düğümü](28-ai-dugumu-store.md) — addAiNode / updateAiConfig; ad bağlayıcıyı izler
29. [Kalıcılık: pipeline ve AI düğümü](29-pipeline-kalicilik.md) — doğrulayarak okuma, ölü uçları ayıklayarak kaydetme
30. [Test: pipeline](30-test-pipeline.md) — store kuralları, orkestratöre dönüşüm, kayıt/geri yükleme
31. [Köprü manifesti](31-kopru-manifesti.md) — her agent'ın erişebildiği eşler, modeller ve kaynaklar; kabuklar hariç
32. [API: /bridge uçları](32-api-bridge.md) — her bağlı agent için ortak uçlar; /orchestrator aynı kodla
33. [Köprü: BRIDGE.md + tc.mjs](33-agent-koprusu.md) — tek betik /bridge uçlarına geçti; peers modelleri de gösterir; bridge:prepare
34. [Pipeline mesajları: çerçeve ve korumalar](34-pipeline-koruma.md) — gönderen başlığı, karşılıklı bekleme kilidi ve hız sınırı
35. [API: modele danışma](35-api-model.md) — M1/ad/bağlayıcı ile model seçimi, persona, akışa kayıt
36. [Akışa kayıt](36-akisa-kayit.md) — send/reply tekrar etmeden kaydedilir; source/trigger /event ile bildirilir
37. [Ekrandan cevap okuma](37-ekrandan-cevap.md) — Gemini CLI gibi kaydı olmayan agent'ların cevabı ekrandan
38. [Ekran okuma köprüye bağlandı](38-ekran-baglantisi.md) — xterm ekran metni, son mesajdan sonrası cevap, awaitingApproval
39. [wait: sessizlikle tur sonu](39-sessizlik-algilama.md) — tur bilgisi olmayan agent'larda 6 sn sessizlik = cevap hazır
40. [Köprü CLI: modeller ve konsey](40-model-komutlari.md) — agent veya modele sor, aynı soruyu herkese sor, toplu mesaj
41. [discuss: AI'lar sırayla tartışır](41-tartisma.md) — katılımcılar birbirinin cevabını görerek tur tur konuşur
42. [Köprü CLI: kum havuzu ipuçları](42-kum-havuzu-ipuclari.md) — EPERM/ECONNREFUSED için yükseltilmiş izinle tekrar dene
43. [ORCHESTRATOR.md: modeller](43-orkestrator-talimati.md) — modeller düşünmek için; council/discuss ne zaman kullanılır
44. [Test: köprü betiği](44-test-kopru-betigi.md) — tc.mjs sahte API'ye karşı: Gemini sessizlik, Codex tur sonu, konsey, tartışma
45. [Pipeline bilgilendirmesi](45-pipeline-bilgilendirme.md) — kablo çekilince iki uç da kime bağlı olduğunu öğrenir; meşgulse bekler
46. [Gemini başlatma düzeltmesi](46-gemini-baslatma.md) — --prompt-interactive ve otomatik onay için --yolo
47. [Orkestratör türü](47-orkestrator-turu.md) — createOrchestratorInScene type: claude | codex | gemini
48. [Canvas: agent portları](48-agent-portlari.md) — portlar artık her agent'ta, agent rengiyle
49. [Canvas: kablo çekme kuralları](49-baglanti-kurallari.md) — gevşek bağlantı modu, resolveWireIntent, pipeline'da otomatik bilgilendirme
50. [Canvas: pipeline kablosu](50-pipeline-kablosu.md) — iki agent renginde geçiş, ⇄/× etiketi, meşgulken akan çizgi
51. [Canvas: kablo nabzı](51-kablo-nabzi.md) — gönderenden alıcıya akan parlak nokta; hareketi azalt ayarına uyar
52. [Arayüz: bağlayıcı store'u](52-baglayici-store.md) — AI düğümü ve Hub için ortak durum; anahtar asla renderer'a gelmez
53. [Canvas: AI düğümü](53-ai-dugumu.md) — sağlayıcı seçimi, model önerileri, hazır olma durumu, persona
54. [AI düğümü: test ve son cevap](54-ai-dugumu-test.md) — tek tıkla test, cevap beklerken parlama, son cevap önizlemesi
55. [Sağ tık menüsünde alt menü](55-alt-menu.md) — fare ve klavyeyle iç içe menü; ekrana sığacak şekilde konumlanır
56. [Canvas sağ tık menüsü](56-canvas-menusu.md) — Yeni Orkestratör ▸, AI Modeli Ekle ▸, Kaynak Ekle ▸; çeviriye hazır
57. [Şablon: Claude ⇄ Gemini ⇄ Codex](57-uclu-sablonu.md) — tek tıkla üç agent, herkes herkese pipeline'lı, ilk prompt'ta bilgilendirme
58. [Şablon: Model konseyi](58-konsey-sablonu.md) — orkestratör ve ona bağlı üç AI düğümü tek tıkla
59. [Terminal menüsü: pipeline](59-terminal-menusu-pipeline.md) — Pipeline bağla ▸, Pipeline'ı kes ▸, kime bağlı olduğunu söyle
60. [Rozetler](60-rozetler.md) — kim kime bağlı bir bakışta: model sayısı ve ⇄ eş isimleri
61. [AI Hub: hepsi bir arada](61-ai-hub.md) — tüm sağlayıcılar tek pencerede; anahtar kaydet/sil, durum, uyarılar
62. [AI Hub: kart ayrıntıları](62-hub-kart-ayrintilari.md) — CLI sürümü, model listesi çekme, API/CLI testi, tek tıkla canvas'a ekle
63. [AI Hub: Konsey](63-hub-konsey.md) — çoklu AI'a tek soru, yan yana cevaplar, tek tıkla sentez
64. [AI Hub: Akış](64-hub-akis.md) — kim kime ne dedi; filtre, arama, okunmamış sayacı
65. [AI düğümünden Hub'a](65-dugumden-hub.md) — anahtar yok uyarısına tıkla, Hub o sağlayıcıda açılsın
66. [AI Hub: düğme ve kısayol](66-hub-dugmesi.md) — ✦ düğmesi, okunmamış sayacı, değiştirilebilir kısayol
67. [Komut paleti: AI](67-komut-paleti.md) — Hub/konsey/akış, üçlü ve konsey şablonları, her sağlayıcı için ekle
68. [Çeviri: Çince](68-cince-ceviri.md) — AI düğümü, menüler, Hub ve akış metinleri Çince
69. [Türkçe arayüz dili](69-turkce-dil.md) — Ayarlar'da Türkçe; AI Merkezi, menüler ve düğümler Türkçe
70. [Türkçe: mevcut arayüz](70-turkce-arayuz.md) — en görünür ~280 metin Türkçe; toplam 403 anahtar
71. [Düzeltme: sayfa dili ve Sen](71-dil-duzeltmeleri.md) — doğru Türkçe büyük harf, ekran okuyucu dili, yerelleştirilmiş kullanıcı adı
72. [Testler pnpm test'te](72-test-listesi.md) — 605/607 geçiyor; 2 hata node-pty yerel modülü (ortam) kaynaklı
73. [Kullanım kılavuzu](73-kullanim-kilavuzu.md) — üç agent'ı bağlama, AI Merkezi, orkestratör, tc.mjs komutları, notlar
74. [Ana README notu](74-ana-readme.md) — fork notu yeni özellikleri ve kılavuzu gösteriyor

## Nasıl kullanılır

### 1. Claude, Gemini ve Codex'i birbirine bağla (pipeline)

En hızlı yol: boş canvas'a sağ tıkla → **Şablonlar ▸ Claude ⇄ Gemini ⇄ Codex**.
Üç terminal yan yana açılır, hepsi birbirine bağlanır ve her biri ilk mesajda
kimlerle konuşabileceğini öğrenir.

Elle kurmak için:

1. Agent terminallerini aç (sağ tık → **Yeni Claude / Yeni Codex / Yeni
   Gemini**). Her agent'ın başlık hizasında, kendi renginde iki port vardır.
2. Bir agent'ın portundan diğerinin portuna **kablo çek** (yön önemli değil).
   Kablo iki agent'ın renkleri arasında geçişlidir ve ortasında `⇄` vardır;
   kesmek için `⇄`'nin üzerine gelip `×`'e tıkla. Terminal başlığına sağ
   tıklayınca **Pipeline bağla ▸ / Pipeline'ı kes ▸** de var.
3. Kablo çekilince iki agent da kısa bir bilgilendirme alır ve
   `.termcanvas/bridge/<id>/BRIDGE.md` talimatını okur.
4. Herhangi birine normal dille yaz: *"Gemini'ye bu API'nin rate limit'ini
   sor"*, *"Codex testleri yazsın, sen gözden geçir"*, *"Gemini ve Codex ile bu
   tasarımı 2 tur tartış ve özetle"*.

Mesaj alan agent'ın sohbetine `[TermCanvas pipeline] Message from Claude
(claude): …` diye düşer; cevabını normal yazar, gönderen otomatik okur.
Mesajlaşırken kablonun üzerinde gönderenden alıcıya parlayan bir nokta akar.

### 2. AI modelleri ve AI Merkezi

**AI Merkezi** (araç çubuğunda ✦, ya da **⌘⇧Y** / Alt+Shift+Y) tüm AI'ları bir
arada tutar:

- **Bağlayıcılar:** Claude, Gemini, ChatGPT ve DeepSeek, Grok, Mistral,
  Perplexity, OpenRouter, Groq, Ollama, LM Studio, Custom. API anahtarını bir
  kez yapıştır (işletim sisteminin anahtar zinciriyle şifrelenir, arayüze geri
  gelmez) ya da anahtarsız **CLI** yolunu kullan: `claude`, `gemini`,
  `codex` kuruluysa aboneliğinle giriş yaptığın hesap çalışır. Model listesini
  çek, API/CLI'ı test et, **Canvas'a ekle**.
- **Konsey:** aynı soruyu birden çok AI'a sor, cevapları yan yana gör, birine
  özetlet.
- **Akış:** AI'ların birbirine söylediği her şey canlı (kim → kime, süre,
  token); süzgeç ve arama. Akış diske yazılmaz.

Canvas'a AI modeli eklemek için sağ tık → **AI Modeli Ekle ▸**. AI düğümünde
sağlayıcı, model, `API | CLI` yolu ve rol (persona) seçilir; **Test** ile
denenir. Bir agent'tan AI düğümüne kablo çekersen agent ona danışabilir
(`ask gemini …`). **Şablonlar ▸ Model konseyi** bir orkestratörü Claude,
Gemini ve ChatGPT düğümleriyle birlikte kurar.

### 3. Orkestratör

1. Boş canvas'a sağ tıkla → **Yeni Orkestratör ▸ Claude / Codex / Gemini**.
   Projedeki agent terminalleri otomatik olarak ona bağlanır.
2. Agent'lara başlıklarından rol adı ver (ör. "Copywriter"). Orkestratör işi bu
   isimlere bakarak dağıtır; isimler yeniden başlatmada korunur.
3. Kaynak eklemek için sağ tık → **Kaynak Ekle ▸ Google Sheet / n8n Webhook /
   HTTP API / Yerel Dosya / Not**, sonra düğümün adresini ve notunu doldur. Tek
   orkestratör varsa yeni kaynak ona otomatik bağlanır.
4. Komutu sadece orkestratörün terminaline yaz.

### Köprü CLI'ı (`tc.mjs`)

Her bağlı agent kendi klasöründeki aracı kullanır
(`.termcanvas/bridge/<id>/tc.mjs`, orkestratörde
`.termcanvas/orchestrator/<id>/tc.mjs`):

| Komut | Ne yapar |
| --- | --- |
| `peers` / `status` | Bağlı agent'lar (1, 2…), modeller (M1…), kaynaklar (S1…) |
| `ask <agent\|model> <metin>` | Agent'a yaz ve cevabını bekle; modele tek seferde sor |
| `send <agent> <metin>` / `--file` | Agent'a mesaj/görev yolla |
| `wait <agent>` | Agent'ın turu bitene kadar bekle, cevabını yaz |
| `reply <agent>` | Son cevabı tekrar göster |
| `consult <model> <metin>` | Bağlı AI modeline danış |
| `council <soru> [--models M1,M2] [--agents]` | Aynı soruyu herkese sor, cevapları alt alta bas |
| `discuss <p1,p2[,p3]> <konu> [--rounds 2]` | Agent'lar/modeller sırayla tartışsın |
| `broadcast <metin>` | Bağlı tüm agent'lara yaz |
| `source <kaynak> [--query]` | Kaynağı oku (Sheet → CSV, n8n/API → GET, dosya, not) |
| `trigger <kaynak> --data '<json>'` | n8n/API kaynağına POST at (eylem) |

`<agent>`, `peers` numarası, adı, türü (tek Gemini bağlıysa `gemini`) ya da
kimliği olabilir. `wait` çıkış kodları: 0 cevap hazır, 2 hâlâ çalışıyor, 3
kullanıcının onayını bekliyor.

### Notlar

- **Gemini CLI** tur bitti bilgisi vermez; köprü bunu ekranın durulmasından
  anlar ve cevabı ekrandan okur. Gemini komut çalıştırmadan önce onay ister;
  agent bunu bildirir (`wait` 3 ile çıkar).
- **Codex** komutları kum havuzunda çalıştırır; köprünün 127.0.0.1'e
  bağlanması ilk seferde izin isteyebilir. "Oturum boyunca izin ver" demen
  yeterli.
- İki agent birbirini beklerken yeniden mesaj atamaz (kilitlenme koruması);
  iki agent 10 dakikada 30'dan fazla mesajlaşırsa pipeline duraklar.
- Kabuk terminalleri pipeline'a bağlanamaz (mesaj komut olarak çalışırdı).
- Google Sheet doğrudan CSV olarak okunur; bunun için "bağlantıya sahip olan
  herkes görüntüleyebilir" paylaşımı gerekir. Özel Sheet için
  [`integrations/n8n`](../../integrations/n8n/build-leads-webhook.mjs) ile bir
  okuma webhook'u kur ve onu **n8n Webhook** kaynağı olarak bağla (bkz. not 15).
- Dış dünyayı değiştiren `trigger` çağrılarını yalnızca komut bunu açıkça
  istediğinde yapacak şekilde talimatlandırılmıştır.
- Arayüz dili: Ayarlar → Genel → Dil → **Türkçe**.
