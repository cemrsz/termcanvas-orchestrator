# 44 — Test: köprü betiği uçtan uca

**Ne yaptım:** Üretilen `tc.mjs`'i sahte bir TermCanvas API'sine karşı, bir
agent'ın kendi kabuğundan çalıştıracağı gibi çalıştıran testler:

- `peers` agent'ları numarasıyla, modelleri M-numarasıyla listeliyor.
- `ask chatgpt …` sadece modele uyduğu için modele soruyor.
- `ask gemini …` (tur bilgisi yok) ekran durulana kadar bekliyor, cevabı
  erken döndürmüyor.
- `ask 2 …` (Codex) `turn_complete` ile dönüyor.
- Onay bekleyen agent'ta `wait` 3 ile çıkıyor.
- `council … --agents` herkese soruyor; `discuss M1,codex …` her
  konuşmacıya ötekinin söylediğini iletiyor, akış etiketleri doğru.
- Belirsiz ve bilinmeyen isimler açıklanıyor.

Testler hızlı çalışsın diye sessizlik/yoklama süreleri ortam değişkeniyle
kısaltılabiliyor (`TC_BRIDGE_QUIET_MS`, `TC_BRIDGE_POLL_MS`,
`TC_BRIDGE_MIN_TURN_MS`); varsayılanlar değişmedi.

**Dosyalar:** `tests/bridge-script.test.ts`, `electron/bridge-script.ts`
