# 20 — Agent'lar Sheet'leri değiştirebilsin

**Ne yaptım:** Google Sheet'ler artık yalnızca okunmuyor; ekipteki agent'lar
satır ekleyip güncelleyebiliyor — Sheet'i herkese açmadan.

- **Köprü:** `integrations/google-sheets/termcanvas-sheet-bridge.gs` —
  Sheet'e bağlı bir Apps Script web uygulaması. Okuma (filtre + limit),
  satır ekleme, anahtar sütuna göre güncelleme ve "yoksa ekle"
  (`upsert`) yapıyor; aynı anda gelen yazmaları kilitle sıraya koyuyor,
  yeni alanlar için başlık sütunu ekliyor, hiçbir şeyi silmiyor.
- **Kanvas:** Sheet kaynak düğümünün ikinci alanına köprünün adresi
  (`…/exec?token=<TOKEN>`) yazılıyor.
- **Agent tarafı:** `tc.mjs sheet <S#|ad> read|append|update|upsert`.
  Köprü adresi olan bir Sheet'te `source` de köprü üzerinden okuyor (özel
  Sheet'ler için CSV paylaşımı gerekmiyor). Her yazma ekip paneline
  "Leads sheet'inde 12 satırı güncelledim" gibi bir satır olarak düşüyor.

```bash
node .termcanvas/agent/<id>/tc.mjs sheet Leads read --where status=Pending --limit 20
node .termcanvas/agent/<id>/tc.mjs sheet S1 append --rows '[{"email":"a@b.c","status":"New"}]'
node .termcanvas/agent/<id>/tc.mjs sheet S1 update --key email --rows '[{"email":"a@b.c","status":"Sent"}]'
```

**Kurulum (Sheet başına bir kez):**

1. Sheet'te *Uzantılar → Apps Script*, dosyayı yapıştır, `TOKEN`'ı uzun
   rastgele bir değerle değiştir.
2. *Dağıt → Yeni dağıtım → Web uygulaması*: "Şu kullanıcı olarak yürüt: Ben",
   "Erişimi olanlar: Herkes".
3. Verilen `/exec` adresinin sonuna `?token=<TOKEN>` ekleyip Sheet
   düğümünün ikinci alanına yapıştır.

Token tek kilit; adresi kimseyle paylaşma ve depoya yazma. Scripti
değiştirirsen yeni sürüm olarak yeniden dağıt.

Agent talimatları yazmayı yalnızca görevin istediği satırlarla sınırlıyor:
tüm Sheet'i yeniden yazmak ve silmek yasak.

**Doğrulama:** Köprü, sahte Apps Script servisleriyle bir VM'de test
ediliyor (`tests/sheet-bridge.test.ts`); `tc.mjs sheet …` komutları sahte
bir köprüye karşı uçtan uca test ediliyor (`tests/team-api.test.ts`).

**Dosyalar:** `integrations/google-sheets/termcanvas-sheet-bridge.gs`,
`electron/team-bridge.ts` (`sheet` komutu), `tests/sheet-bridge.test.ts`
