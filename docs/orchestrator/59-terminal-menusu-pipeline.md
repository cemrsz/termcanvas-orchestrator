# 59 — Terminal menüsü: pipeline işlemleri

**Ne yaptım:** Agent terminalinin başlığına sağ tıklayınca, kablo sürüklemeden:

- **Pipeline bağla ▸** — canvas'taki diğer agent'lar (rengiyle) ve AI
  düğümleri; seçince pipeline kurulur ve iki taraf bilgilendirilir.
- **Pipeline'ı kes ▸** — bağlı olduğu eşler.
- **Kime bağlı olduğunu söyle** — bilgilendirme mesajını yeniden gönderir
  (ör. agent konuşmayı sıfırladıysa).
- Orkestratör seçenekleri (bağla / kes / orkestratör yap / rolü kaldır) de
  artık çeviriye hazır metinlerle.

Liste menü açıldığında hesaplanıyor; terminaller her değişiklikte yeniden
çizilmiyor.

**Dosyalar:** `src/terminal/TerminalTile.tsx`, `src/i18n/en.ts`
