# 23 — Haberleşme kaydı (comms log)

**Ne yaptım:** AI'ların birbirine söylediği her şey için ortak bir kayıt tipi
ve ana süreçte bir halka tampon ekledim:

- Kayıt türleri: `message` (A → B), `reply` (B'nin cevabı), `ask` / `answer`
  (bir modele soru ve cevabı), `read` / `trigger` (kaynak okuma / tetikleme),
  `brief` (agent'a kime bağlı olduğunun söylenmesi), `error`.
- Her kayıtta gönderen, alıcı, metin (en fazla 4000 karakter; kesilen kısım
  sayılır), süre, token ve etiket (ör. "konsey", "tartışma · tur 2") var.
- Tampon son 400 kaydı tutar ve **diske yazmaz**: prompt'lar özel veri
  içerebilir, agent'ların kendi oturum kayıtları zaten var.

**Dosyalar:** `shared/comms.ts`, `electron/comms-log.ts`, `tests/comms-log.test.ts`
