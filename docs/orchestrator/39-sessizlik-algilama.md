# 39 — `wait`: sessizlikle tur sonu (Gemini CLI)

**Sorun:** `wait`, agent'ın turunun bittiğini Claude/Codex kancalarından gelen
`turn_complete` bilgisiyle anlıyordu. Gemini CLI bu bilgiyi vermediği için
`wait` hiç bitmiyor, hep "STILL_WORKING" diyordu — Claude ile Gemini fiilen
konuşamıyordu.

**Düzeltme:** Tur bilgisi gelmeyen agent'larda:

- Mesajımızdan sonra agent bir şey yazdıysa **ve** ekran 6 saniyedir
  durgunsa (Gemini düşünürken dönen gösterge sürekli çıktı üretir) tur bitmiş
  sayılır, cevap ekrandan okunur.
- Ekranda onay sorusu varsa çıkış kodu 3: "kullanıcının onayı bekleniyor".
- Süre dolarsa `reply <agent>` ile ekranın o ana kadarki hâlinin okunabileceği
  söylenir.

Claude ve Codex için davranış aynı kaldı.

**Dosyalar:** `electron/bridge-script.ts`
