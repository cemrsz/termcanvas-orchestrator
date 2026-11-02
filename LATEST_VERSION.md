# Son Sürüm — Pipeline'lar, AI Merkezi ve Türkçe Arayüz

**Tarih:** 2 Kasım 2026 · **Dal:** `claude/magical-darwin-v18hc0` · **Commit sayısı:** 60 (günlük 16–75)

Bu sürüm, orkestratörün üstüne yapay zekâların **birbiriyle konuşmasını** ve
hepsinin **tek yerden yönetilmesini** ekler.

## Öne çıkanlar

### 1. Claude ⇄ Gemini ⇄ Codex pipeline'ları
- Her agent terminalinde (Claude, Gemini, Codex, Kimi, OpenCode…) port var.
  İki agent'ı kabloyla bağla: ikisi de birbirine yazabilir.
- Kablo çekilince her iki agent'a kime bağlı olduğu bildirilir ve
  `.termcanvas/bridge/<id>/BRIDGE.md` + `tc.mjs` hazırlanır.
- Gelen mesaj `[TermCanvas pipeline] Message from Claude (claude): …` olarak
  düşer; alıcı normal cevap verir, gönderen otomatik okur.
- **Şablonlar ▸ Claude ⇄ Gemini ⇄ Codex:** üç agent tek tıkla, herkes herkese bağlı.
- Korumalar: karşılıklı bekleme kilidi, 10 dakikada 30 mesaj sınırı, kabuk
  terminalleri asla bağlanmaz.

### 2. Köprü komutları (`tc.mjs`)
| Komut | Ne yapar |
| --- | --- |
| `peers` | Bağlı agent'lar (1, 2…), modeller (M1…), kaynaklar (S1…) |
| `ask <agent\|model> <metin>` | Agent'a yaz ve cevabı bekle / modele sor |
| `consult <model> <metin>` | AI modeline danış |
| `council <soru> [--agents]` | Aynı soruyu herkese sor, cevapları karşılaştır |
| `discuss <p1,p2,p3> <konu> [--rounds 2]` | Sırayla tartışma |
| `broadcast <metin>` | Bağlı tüm agent'lara yaz |

### 3. AI bağlayıcıları (eklentiler)
- Claude, Gemini, ChatGPT + DeepSeek, Grok, Mistral, Perplexity, OpenRouter,
  Groq, Ollama, LM Studio, Custom (OpenAI uyumlu).
- **API** (anahtar işletim sistemi anahtar zincirinde şifreli) veya **CLI**
  (`claude -p`, `gemini`, `codex exec` — abonelik girişiyle, anahtarsız).

### 4. AI Merkezi (✦ düğmesi veya ⌘⇧Y / Alt+Shift+Y)
- **Bağlayıcılar:** anahtar, CLI durumu, model listesi, API/CLI testi, canvas'a ekle.
- **Konsey:** bir soruyu birden çok AI'a sor, yan yana gör, birine özetlet.
- **Akış:** AI'lar arası tüm mesajlar canlı (kim → kime, süre, token).

### 5. Canvas ve arayüz
- AI düğümü: sağlayıcı, model, API/CLI, rol; test düğmesi, düşünürken parlama, son cevap.
- Renk geçişli kablolar, mesaj giderken akan nokta, `⇄` rozetleri.
- Alt menülü sağ tık: Yeni Orkestratör ▸ (Claude/Codex/Gemini), AI Modeli Ekle ▸,
  Kaynak Ekle ▸, Şablonlar ▸ (üçlü, model konseyi).
- Komut paletinde AI komutları.
- **Türkçe arayüz** (Ayarlar → Genel → Dil), Çince çeviriler.

### 6. Düzeltmeler
- Gemini CLI agent'larında `wait` hiç bitmiyordu → ekran durulunca cevap ekrandan okunuyor.
- Başlangıç prompt'uyla açılan Gemini terminali kapanıyordu → `--prompt-interactive`.
- Türkçe büyük harf hatası (DIĞER → DİĞER) için `<html lang>` dile göre ayarlanıyor.

## Doğrulama
- TypeScript kontrolü temiz.
- `pnpm test`: 607 testten 605'i geçiyor (12 yeni test dosyası dahil). Kalan 2'si
  `pty-manager` testleri; node-pty yerel modülü derlenmemiş ortamdan kaynaklı.
- Gerçek CLI'lar ve API anahtarlarıyla uçtan uca deneme yapılmadı.

## Bilinen notlar
- Gemini'de tur sonu 6 sn ekran sessizliğiyle tahmin edilir.
- Codex köprünün 127.0.0.1 bağlantısı için ilk seferde izin isteyebilir.
- Varsayılan modeller (`gemini-flash-latest`, `gpt-5`) zamanla değişebilir;
  AI Merkezi'ndeki "model listesini getir" ile güncellenir.

Ayrıntılı kılavuz: [docs/orchestrator/README.md](docs/orchestrator/README.md)

## Commit listesi
- `ca6690e` bağlayıcılar: ortak katalog (Claude, Gemini, ChatGPT ve diğerleri)
- `341b45b` bağlayıcılar: API isteği ve cevabı (Anthropic, Gemini, OpenAI uyumlu)
- `d7d44bd` bağlayıcılar: CLI ile çağırma (claude -p, gemini, codex exec)
- `9e05360` bağlayıcılar: şifreli anahtar deposu, durum ve model listesi
- `5583d1b` bağlayıcılar: API veya CLI üzerinden soru sorma
- `b054eb2` test: bağlayıcı servisi (anahtar, ortam, API, CLI)
- `c9095a7` ipc: ai:* kanalları ve preload köprüsü
- `73085bb` akış: ortak mesaj tipleri ve ana süreçte halka tampon
- `2bc5195` akış: IPC, canlı yayın ve arayüz çağrılarının kaydı
- `72dad3c` akış: renderer store'u (kablo nabzı, meşgul modeller, okunmamış)
- `18bde7f` veri modeli: agent↔agent pipeline'ları ve AI düğümleri
- `30a2442` store: pipeline bağlama/kesme kuralları
- `e98da73` store: AI düğümü ekleme ve ayarları
- `784f778` kalıcılık: pipeline ve AI düğümlerini kaydet/yükle
- `da9a780` test: pipeline kuralları ve sahne kaydı
- `27ab024` eylemler: köprü manifesti (pipeline eşleri, modeller, kaynaklar)
- `79d0945` api: /bridge uçları (manifest, agent, send, reply)
- `e8ee5d1` köprü: her pipeline agent'ı için BRIDGE.md ve ortak tc.mjs
- `262cf27` api: pipeline mesaj çerçevesi, kilitlenme ve döngü koruması
- `b0c537c` api: /bridge/:id/model — bağlı AI modeline danışma
- `f26c983` akış: mesaj, cevap ve kaynak olaylarını kaydet
- `c0196cd` köprü: TUI ekranından cevap ve onay sorusu okuma
- `12e939c` köprü: Gemini cevabını çizilmiş ekrandan oku, onay sorusunu bildir
- `b6084f3` düzeltme: Gemini CLI agent'larında wait hiç bitmiyordu
- `8800d74` köprü: ask/consult/council/broadcast komutları
- `b6dc80b` köprü: discuss — Claude, Gemini ve Codex sırayla tartışır
- `f2f66ed` köprü: kum havuzu ve bağlantı hatalarında ipucu (Codex)
- `e23877f` köprü: ORCHESTRATOR.md'ye modeller, konsey ve tartışma
- `d17ec77` test: köprü betiği uçtan uca (peers, ask, council, discuss)
- `e485882` eylemler: pipeline kurulunca agent'ları bilgilendir
- `fca7321` düzeltme: Gemini ilk prompt'la tek seferlik moda düşüp kapanıyordu
- `ebe13fe` eylemler: orkestratör türü seçilebilir (Claude, Codex, Gemini)
- `e127baa` canvas: her agent terminalinde pipeline portu
- `166eea8` canvas: yönsüz kablo çekme; agent↔agent pipeline kurar
- `d056cae` canvas: pipeline kablosu — renk geçişli, ⇄ ve tıkla-kes
- `94583ac` canvas: mesaj akarken kablo üzerinde yönlü nabız
- `498873b` arayüz: bağlayıcı durum store'u (anahtar, CLI, model listesi)
- `dfcd076` canvas: AI düğümü (sağlayıcı, model, API/CLI, rol)
- `678b7b0` canvas: AI düğümünde test, düşünüyor ışığı ve son cevap
- `e624506` menü: alt menü, renkli nokta ve ipucu desteği
- `c26372e` menü: canvas sağ tık — orkestratör türü, AI modeli ve kaynak alt menüleri
- `1c856c9` şablon: Claude ⇄ Gemini ⇄ Codex — üç agent, hepsi bağlı
- `9423339` şablon: model konseyi (orkestratör + Claude, Gemini, ChatGPT)
- `d9c2eaf` terminal: sağ tıkla pipeline bağla, kes, yeniden bilgilendir
- `0da6249` canvas: orkestratörde model sayısı, agent'larda ⇄ pipeline rozeti
- `b508f9e` hub: AI Hub penceresi ve bağlayıcı kartları (şifreli anahtar)
- `85848d2` hub: CLI kontrolü, varsayılan model, model listesi, test ve canvas'a ekle
- `89d3c23` hub: Konsey — aynı soruyu Claude, Gemini, ChatGPT'ye sor, yan yana gör, özetlet
- `d70953b` hub: Akış — AI'lar arası tüm mesajların canlı zaman çizelgesi
- `293129c` canvas: AI düğümündeki durumdan Hub'ı ilgili kartta aç
- `35cb7a2` hub: araç çubuğu düğmesi, okunmamış rozeti ve ⌘⇧Y kısayolu
- `cc126fd` komut paleti: AI Hub, şablonlar ve AI modeli ekleme
- `5574829` i18n: yeni metinlerin Çince çevirisi
- `2779539` i18n: Türkçe arayüz dili (ayar, otomatik algılama, yeni metinler)
- `6b25d0c` i18n: Türkçe — araç çubuğu, ayarlar, durumlar, kısayollar, komut paleti
- `aa4683f` düzeltme: html lang dile göre (Türkçe büyük İ), akışta "Sen"
- `bf669d5` test: yeni 12 test dosyası pnpm test listesinde
- `b92a7af` dokümantasyon: pipeline, AI Merkezi ve köprü komutları kılavuzu
- `7043cea` README: fork notu — pipeline'lar, AI Merkezi, Türkçe arayüz
- `74954a3` dokümantasyon: giriş ve 16–75 özeti
