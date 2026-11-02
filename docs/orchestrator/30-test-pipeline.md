# 30 — Test: pipeline kuralları ve kalıcılık

**Ne yaptım:** Store ve sahne okuma için testler:

- Pipeline iki yönlü; ters yönde tekrar, kendine bağlama, iki AI düğümünü
  birbirine bağlama reddediliyor; düğüm silinince kabloları gidiyor.
- AI düğümü bağlayıcının adını alıyor; özel ad korunuyor.
- Bir agent orkestratör yapılınca pipeline'ları link'e dönüşüyor, iki işçi
  arasındaki pipeline kalıyor.
- Kayıt/geri yükleme: bozuk girişler ayıklanıyor, eski sahneler açılıyor.

**Dosyalar:** `tests/orchestration-pipes.test.ts`
