# 23 — Kılavuz güncellemesi ve uçtan uca doğrulama

**Ne yaptım:** Kullanım kılavuzu (bu klasördeki `README.md`) ekip
özellikleriyle yeniden yazıldı; kök `README.md`'deki not güncellendi.
n8n gelen kutusu, dolu port yüzünden başka porta geçerse yeni portu
kaydediyor (n8n'deki adres bozulmasın). n8n gönderici parçası artık iki
düğümlü (*Paketle → TermCanvas'a gönder*). Agent kuralları, dosya
kaynaklarının agent'ın kendi dosya araçlarıyla düzenlenebileceğini
söylüyor.

## Nasıl doğrulandı

Uygulama bu ortamda derlenip sanal ekranda (Xvfb) çalıştırıldı; Claude
yerine aynı komut satırı bayraklarını kabul eden, oturum dosyası ve hook
olayları yazan sahte bir `claude` kullanıldı.

| Senaryo | Sonuç |
| --- | --- |
| Claude terminali → yaz → kapat → aç | Önce: yeni oturum açılıyordu (hata yeniden üretildi). Sonra: `--session-id X`, açılışta `--resume X`, yazı yazılabiliyor |
| Sağ tık → New Team | 25 terminal: 1 opus, 4 sonnet, 20 haiku; 24 kablo, 25 rol; hepsi ekip sistem promptu, izinler ve sabit oturum kimliğiyle |
| Ekiple kapat → aç | 25'i de aynı oturumla geri geldi (konuşması olanlar `--resume`, olmayanlar aynı kimlikle `--session-id`) |
| `tc.mjs status / send / say / post / log / report` | Lider astına görev verdi, işçinin `send`'i reddedildi, işçi ekip kaynağını gördü |
| Kaynak düğümü → kabloyla yöneticiye bağla → gelen kutusuna POST | `202`, olay yöneticiye teslim edildi; yanlış token `401` |
| Gerçek n8n 2.44 iş akışı → gelen kutusu | Çalıştırma başarılı, olay agent'a ulaştı |
| Team paneli ve rapor okuyucu | Kadro, akış, raporlar ve markdown tablo düzgün görünüyor |

Birim testleri: `pnpm test` → 562 test, hepsi geçiyor (27'si yeni:
ekip grafiği, ekip motoru, API + `tc.mjs`, gelen kutusu, Sheet köprüsü,
ekip şablonu, başlatma bayrakları, oturum dosyası kontrolü).
`pnpm typecheck` temiz; `electron/` için yeni tip hatası yok.

## Bilinen sınırlar

- Bu notta gerçek Claude CLI kullanılmadı; gerçek Claude ve gerçek n8n ile
  yapılan test ve bulduğu sorunlar not 24'te.
- Windows'ta denenmedi. Başlatma bayrakları `cmd.exe` ile uyumlu olacak
  şekilde tırnak/özel karakterden arındırılıyor.
- Bulut (headless) sunucu modu (`server/`, `headless-runtime/`) ekip
  özelliklerini henüz kullanmıyor; ekipler masaüstü uygulamasında çalışıyor.
- Apps Script köprüsü sahte Google servisleriyle test edildi; gerçek bir
  Sheet'te ilk kurulumda bir okuma/yazma denemesi yap.

**Dosyalar:** `docs/orchestrator/README.md`, `README.md`,
`electron/team-inbox.ts`, `electron/main.ts`, `electron/team-bridge.ts`,
`integrations/n8n/build-termcanvas-notify.mjs`, `tests/team-inbox.test.ts`
