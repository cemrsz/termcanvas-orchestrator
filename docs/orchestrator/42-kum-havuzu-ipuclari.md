# 42 — Köprü CLI: kum havuzu ipuçları

**Sorun:** Codex komutları varsayılan olarak ağı kapalı bir kum havuzunda
çalıştırır; `tc.mjs`'in 127.0.0.1'deki TermCanvas'a bağlanması orada
engellenebilir. Agent ham bir `EPERM` / `ECONNREFUSED` görüp vazgeçiyordu.

**Düzeltme:** Bağlantı hatalarında CLI ne yapılacağını söylüyor:

- `EPERM` / `EACCES` / "operation not permitted" → "kum havuzun bağlantıyı
  engelledi; aynı komutu yükseltilmiş izinle tekrar çalıştır, sadece
  127.0.0.1'deki TermCanvas ile konuşuyor".
- `ECONNREFUSED` → "TermCanvas açık mı? Açıksa ve kum havuzundaysan izinle
  tekrar dene".

Codex bu ipucuyla izin isteyip komutu tekrar çalıştırabiliyor; kullanıcı bir
kez "oturum boyunca izin ver" derse sonra sormuyor.

**Dosyalar:** `electron/bridge-script.ts`
