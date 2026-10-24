# 16 — Düzeltme: açılışta aynı Claude oturumları geri gelsin

**Sorun:** Uygulamayı kapatıp açınca agent'lar önceki konuşmalarına değil,
boş yeni oturumlara açılıyordu. Gerçek uygulamada (sanal ekranda) yeniden
üretildi: oturum dosyası yazılmış olsa bile `state.json`'da `sessionId` boştu.

Üç sebep vardı:

1. **Oturum kimliği hiç kaydedilmiyordu.** Kimlik, Claude açıldıktan sonra
   (hook ya da yoklamayla) öğreniliyordu ama bu değişiklik çalışma alanını
   "kirli" işaretlemiyordu; otomatik kayıt da yalnızca başka bir değişiklik
   olunca çalışıyordu.
2. **Kapanışta kayıt yoktu.** Diskte en son 5 sn'lik gecikmeli kaydın
   yazdığı (çoğu zaman dakikalarca eski) hâl kalıyordu.
3. **Hiç mesaj almamış oturum `--resume` ile açılamıyor.** Claude konuşma
   dosyasını ilk mesajda yazar; boş bir oturumu `--resume` ile açmak
   hata verip terminali yeniden başlatıyordu.

**Düzeltme:**

- Her Claude terminali artık kimliğini baştan biliyor: yeni konuşma
  `claude --session-id <uuid>` ile başlıyor ve kimlik hemen kaydediliyor.
- Açılışta konuşma dosyası varsa `--resume <id>`, yoksa aynı kimlikle
  `--session-id <id>` kullanılıyor (`session:claude-transcript-exists`).
- Oturum kimliği değişince (`/clear`, `/resume` dahil) çalışma alanı kirli
  işaretleniyor; Claude'un SessionStart hook'u ilk oturumdan sonra da
  dinleniyor.
- Pencere kapanırken durum senkron olarak kaydediliyor (`state:save-sync`).
  Kayıtlı durum henüz yüklenmeden kapatılırsa boş sahne eski kaydın üstüne
  yazılmıyor.
- Terminal başına `model` alanı eklendi (`claude --model …`, `codex -m …`);
  geri açılışta da aynı modelle başlıyor.
- Tarayıcı kartı sürüklenirken açılan koruma katmanı, fare pencere dışında
  bırakılırsa takılı kalıp tüm tıklama ve yazmayı engelleyebiliyordu; artık
  pencere odağı kaybolunca da kapanıyor.

**Doğrulama:** Sahte bir `claude` ile uçtan uca: ilk açılış
`--session-id 271c…`, kapat-aç sonrası `--resume 271c…`, terminale yazı
yazılabiliyor. Birim testleri: `tests/terminal-adapters.test.ts`,
`tests/session-watcher.test.ts`.

**Dosyalar:** `src/terminal/terminalRuntimeStore.ts`,
`src/terminal/cliConfig.ts`, `src/terminal/teamLaunch.ts`, `src/App.tsx`,
`src/snapshotBridge.ts`, `src/types/index.ts`, `electron/main.ts`,
`electron/preload.ts`, `electron/session-watcher.ts`,
`src/components/BrowserCard.tsx`
