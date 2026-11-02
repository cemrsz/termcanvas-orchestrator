# 25 — Haberleşme akışı: arayüz store'u

**Ne yaptım:** `useCommsStore` — ana süreçten gelen kayıtları tutan store.
Uygulama açılınca geçmişi yükler (`startCommsSync`) ve yenilerini dinler.

- **Kablo nabzı:** iki canvas düğümü arasında bir mesaj geçince o kablo
  2,2 saniye parlar (`useWirePulse`). Süresi biten parıltılar temizlenir.
- **Düşünüyor durumu:** bir modele soru gidince cevap (veya hata) gelene kadar
  o model düğümü "meşgul" sayılır; aynı anda birden çok soru sayılır.
- **Okunmamış sayacı:** akış ekranı kapalıyken gelen kayıtlar sayılır, ekran
  açılınca sıfırlanır. Açılışta yüklenen eski kayıtlar sayılmaz, parlamaz.

Mantık saf fonksiyonlarda (`applyCommsEntry`, `prunePulses`), testli.

**Dosyalar:** `src/stores/commsStore.ts`, `src/App.tsx`, `tests/comms-store.test.ts`
