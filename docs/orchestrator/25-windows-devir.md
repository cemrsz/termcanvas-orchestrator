# 25 — Windows'a devir: bilgisayarı buluttaki demo ile aynı hale getirmek

Bu dosya, kullanıcının Windows bilgisayarında çalışan bir Claude oturumu
için yazıldı. Bulutta (Linux) şu çalışıyordu: bu branch'teki uygulama,
25 agent'lık ekip, Team paneli, yeniden açılışta aynı oturumlar, Sheet
köprüsü ve gerçek n8n webhook'u ([24](24-gercek-test.md)). Hedef, aynısını
bu bilgisayarda çalışır ve doğrulanmış görmek.

Kurallar:

- Branch `claude/wonderful-gauss-o7k9g0`. Kod değiştirirsen bu branch'e
  commit et ve push et; başka branch'e push etme.
- Tıklama gereken yerlerde (uygulama içi menüler, Google, n8n hesabı)
  kullanıcıya tam olarak ne yapacağını söyle ve bekle.
- Token'ları (Sheet köprüsü, team inbox) commit'e, dokümana ya da
  ekran çıktısına koyma.
- PowerShell'de `curl` değil `curl.exe` kullan.
- Uygulama durumu `%USERPROFILE%\.termcanvas\` altında: `port` (ilk satır
  yerel API portu), `team\` (activity/board/reports, `team-inbox.json`).

## 1. Kod ve bağımlılıklar

```powershell
git status
git pull
powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1 -NoStart
```

Beklenen: `[postinstall] Using node-pty's prebuilt binary for win32-x64`,
ardından Chromium indirmesi ve `dependencies installed`.
`node-pty` kaynaktan derlenmeye çalışılıyorsa (MSBuild / MSB8040 hatası)
`scripts/postinstall.mjs` içindeki prebuild kontrolüne bak.

## 2. Terminal motoru Electron'da çalışıyor mu

```powershell
$env:ELECTRON_RUN_AS_NODE = "1"
& .\node_modules\electron\dist\electron.exe -e "const p=require('node-pty');const t=p.spawn('cmd.exe',['/c','echo pty-ok'],{});t.onData(d=>process.stdout.write(d));t.onExit(()=>process.exit(0))"
Remove-Item Env:ELECTRON_RUN_AS_NODE
```

Çıktıda `pty-ok` görünmeli.

## 3. Tip kontrolü ve testler

```powershell
pnpm typecheck
pnpm test
```

Linux'ta 570/570 geçiyordu. Burada düşen test olursa önce Windows'a özgü
olup olmadığına bak (yol ayırıcı `\`, `chmod`, satır sonu, `cmd.exe`).
Ekip kodundaki (`electron/team-*.ts`, `electron/claude-trust.ts`,
`shared/team*.ts`, `src/terminal/teamLaunch.ts`) Windows hatalarını düzelt;
upstream testlerindeki hataları yalnızca raporla.

## 4. Uygulamayı aç

Ayrı bir pencerede başlat ki bu oturum beklemesin:

```powershell
Start-Process powershell -ArgumentList '-NoExit','-Command','pnpm dev' -WorkingDirectory (Get-Location)
```

Pencere açılınca:

```powershell
$port = (Get-Content "$env:USERPROFILE\.termcanvas\port")[0]
curl.exe -s "http://127.0.0.1:$port/terminal/list"
curl.exe -s "http://127.0.0.1:17890/health"
```

İkisi de JSON dönmeli (inbox portu doluysa `team-inbox.json`'daki portu kullan).

## 5. Ekip (kullanıcı tıklar)

Kullanıcıya söyle:

1. Boş canvas'taki **Add project folder…** ile bir çalışma klasörü ekle
   (ör. `C:\Users\hcems\ekip`). Proje yokken ekip menüsü hiçbir şey yapmaz.
2. Canvas'a sağ tık → **New Small Team (1 Opus · 2 Sonnet · 6 Haiku)**.
   Her şey yolundaysa daha sonra **New Team** (25 agent).
3. Klasör güveni sorulursa **Evet**.

Doğrula:

- `/terminal/list` → 9 Claude terminali; `curl.exe -s "http://127.0.0.1:$port/state"`
  çıktısında her terminalin `sessionId`'si var.
- `curl.exe -s "http://127.0.0.1:$port/team/<directorId>"` → `members`
  9 kişi, `managers`/`reports` doğru.
- Çalışma klasöründe her agent için `.termcanvas\agent\<id>\tc.mjs` var.
  Claude'un Bash aracı Windows'ta Git Bash kullanır; Git Bash'te
  `node .termcanvas/agent/<id>/tc.mjs status` ekibi listelemeli.
- Terminallerde güven ya da giriş ekranı kalmamalı; varsa
  `electron/claude-trust.ts` → `detectBlockingPrompt` bunu yakalar ve
  Team panelinde gösterir.

## 6. Küçük gerçek görev

Kullanıcı Director terminaline yazsın, örneğin: "Bir yöneticin bir işçiye
'merhaba' notunu panoya yazdırsın, bana tek cümleyle sonucu söyle."
`%USERPROFILE%\.termcanvas\team\activity.jsonl` dosyasında `task`, `say`,
`board`, `done` satırları görünmeli; Team panelinde akış dolmalı.

## 7. Yeniden açılış

Kullanıcı uygulamayı kapatıp `pnpm dev` ile yeniden açsın.
`/state` çıktısındaki terminal id'leri ve `sessionId`'ler aynı kalmalı, Director'ın eski
konuşması görünmeli ve terminale yazı yazılabilmeli
([16](16-oturum-geri-yukleme.md)).

## 8. Google Sheet

[20-sheet-yazma.md](20-sheet-yazma.md) adımları. Google tarafını kullanıcı
yapar (Apps Script'i yapıştırma, dağıtma, web uygulaması URL'si). Canvas'ta
**Add Google Sheet** ile kaynak eklenir; okuma URL'si sheet adresi, yazma
URL'si web uygulaması adresi. Kaynağı bir yöneticiye kabloyla bağla ve
Git Bash'te `node .termcanvas/agent/<id>/tc.mjs sheet "<ad>" read --limit 5` dene.

## 9. n8n

[19-n8n-ciktilari.md](19-n8n-ciktilari.md) adımları. n8n bu bilgisayarda
çalışıyorsa inbox `http://127.0.0.1:17890` doğrudan erişilir; n8n bulutta
ise yerel inbox'a bir tünel gerekir (ör. `cloudflared tunnel --url
http://127.0.0.1:17890`). Bildirim alt akışını
`integrations/n8n/build-termcanvas-notify.mjs` üretir. Webhook'a lead
alanlarını doğrudan gönder (`{"email":…,"name":…}`); alt akış onları
kendisi `items` içine paketler.

## 10. Bitiş

Bilgisayar buluttaki demo ile aynı sayılır: 1–7 doğrulandı, kullanıcı
istiyorsa 8–9 da. Sonucu kullanıcıya kısaca söyle; kod değiştiyse commit
edip push et ve bu dosyanın altına "Windows sonuçları" başlığıyla ne
bulduğunu ekle.

## Windows sonuçları (24.10.2026)

Windows 11 Pro, Node 24.16, pnpm 10.33, Electron 41.2.1, Claude Code 2.1.310.
1–7 doğrulandı; 8–9 (Sheet, n8n) yapılmadı.

| Adım | Sonuç |
| --- | --- |
| 1 | `setup-windows.ps1` tamam, `node-pty` hazır derlemeyi kullandı. Playwright'ın Chromium zip'ini açma adımı iki kez `D3DCompiler_47.dll`'de takıldı (zip tamdı); `tar -xf` ile `chromium-1217` ve `chromium_headless_shell-1217` klasörlerine açıp `INSTALLATION_COMPLETE` yazınca Chromium çalıştı. Kod değişmedi. |
| 2 | `pty-ok`. `electron.exe` bir GUI uygulaması: PowerShell'de `&` ile çıktısı görünmez, `Start-Process -Wait -RedirectStandardOutput` gerekir. |
| 3 | `typecheck` temiz. Testler (bu branch'teki eklemelerle) 579: 569 geçti, 3 atlandı, 7 düştü. Ekip testindeki tek Windows hatası düzeltildi (aşağıda). Düşen 7'si upstream: `git-watcher` (zaman aşımı), `headless-cli-control` ve `headless-workflow-control` ×2 (`codex` beklenirken `claude` seçiliyor), `memory-service` (Windows'ta Claude bellek yolu), `pty-launch` (macOS yolları), `session-watcher` codex `rollout_path`. |
| 4 | Uygulama açıldı, iki uç JSON döndü. `pnpm dev` ile durum `%USERPROFILE%\.termcanvas-dev\` altında (`port`, `state.json`, `team\`), `.termcanvas` değil. `/state` `sessionId` döndürmüyor; oturumlar `state.json`'da. `POST /terminal/create` Windows'ta yalnızca `C:/...` biçimindeki worktree yolunu tanıyor. |
| 5 | Düzeltmelerden sonra küçük ekip `ekip` klasörüne kuruldu: 9 Claude, doğru modeller ve oturum kimlikleri, `/team/<director>` 9 üye ve doğru yönetici/rapor ilişkileri, Git Bash'te `tc.mjs status` çalışıyor, hiçbir agent güven/giriş ekranında değil, güven bayrağı `~/.claude.json`'da hem `C:\` hem `C:/` anahtarıyla. |
| 6 | Kullanıcının iki komutu (herkesten selam) Director → yöneticiler → işçiler zincirinden geçti: `task`, `say`, `done`, `report`; tur ~45 sn. Pano, Writer 1'in `tc.mjs post`'u ile denendi: `board` satırı ve `board.jsonl` oluştu. |
| 7 | Pencere normal kapatılıp başlatıcıyla açıldı: 9 terminalin kimliği ve `sessionId`'si aynı, hepsi `--resume` ile döndü, Director'ın eski konuşması ekranda, giriş kutusu hazır, brifing tekrar gönderilmedi. |

**Düzeltilenler (bu branch'te):**

- `tests/team-api.test.ts`: `tc.mjs`'in çalıştırma biti Windows'ta yok (NTFS); kontrol Windows'ta atlanıyor. Git Bash `./tc.mjs`'i shebang'den çalıştırıyor.
- Sağ tık menüsü ekibi/orkestratörü seçili proje yoksa sessizce ilk projeye kuruyordu; boş kanvasa her tık seçimi bıraktığı, terminaller kapatılınca da seçim projede kaldığı için ekip üç kez yanlış klasöre kuruldu. Menü artık her worktree için ayrı seçenek gösteriyor ("New Small Team in ekip …"), seçili olan en üstte (`src/canvas/contextMenuTargets.ts`).
- Kutu seçimi hiç çalışmıyordu: sürüklemenin sonundaki tıklama kanvasın tıklama işleyicisine gidip seçimi siliyordu; o tek tıklama artık yutuluyor. Ayrıca varsayılan araç Seçim (sol sürükleme kutu çizer, H el aracı), Delete seçili terminalleri onayla kapatıyor, seçili terminaller vurgulanıyor.

**Bilinmesi gerekenler (kod değişmedi):**

- TermCanvas bir Claude Code oturumunun içinden (ör. o oturumun aracıyla `pnpm dev`) başlatılırsa `CLAUDECODE`, `CLAUDE_CODE_CHILD_SESSION` gibi değişkenleri agent'lara geçiriyor. Agent'lar kendini alt oturum sanıp konuşmayı diske yazmıyor; yeniden açılışta `--resume` yerine `--session-id` + brifing tekrarı oluyor. O oturum kapanınca uygulama da kapanıyor. Gezginden ya da `TermCanvas-Baslat.vbs` ile açınca sorun yok. Öneri: pty ortamından bu değişkenler temizlensin.
- `isClaudeFolderTrusted` üst klasör güvenini yeterli sayıyor; Claude 2.1.310 Windows'ta güvenilir bir klasörün altındaki git kökünde yine soruyor. Bu durumda ekip güveni sormadan kurulur ve agent'lar güven ekranında kalır (`detectBlockingPrompt` yakalar).
- Bir CLI çıkınca kart kabuğa düşüyor ve `sessionId` siliniyor (upstream davranışı); uygulama düzgün kapanmadan agent'lar ölürse oturum bağı kaybolabilir.
- Bir proje menüde iki kez "master" olarak görünebiliyor (aynı klasör iki worktree olarak kayıtlı); incelenmedi.
