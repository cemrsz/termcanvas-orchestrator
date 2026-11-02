# 51 — Canvas: mesaj akarken kablo nabzı

**Ne yaptım:** Bir AI diğerine yazdığında, cevap verdiğinde ya da bir modele
danıştığında o kablonun üzerinde **gönderenden alıcıya** doğru parlayan bir
nokta akıyor ve kablo kalınlaşıyor (2,2 sn). Konuşma canvas'ta canlı
izlenebiliyor: Claude → Gemini mesajı Claude'dan Gemini'ye akar, cevap geri
akar.

- Yön bilgisi akış kaydından geliyor (`pulseFrom`).
- Hem orkestratör kablolarında hem pipeline'larda çalışıyor.
- "Hareketi azalt" sistem ayarı açıksa nokta ve akan çizgi gösterilmiyor.

**Dosyalar:** `src/stores/commsStore.ts`, `src/canvas/orchestrationFlow.tsx`,
`src/index.css`, `tests/comms-store.test.ts`
