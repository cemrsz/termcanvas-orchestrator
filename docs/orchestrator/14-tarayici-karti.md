# 14 — Düzeltme: tarayıcı kartı sürükleme

**Sorun:** Canvas'taki tarayıcı kartları (ör. n8n editörü) taşınamıyordu.
Üç sebep vardı:

1. Kart, fareye basma olayını yakalama aşamasında durduruyordu; olay başlıktaki
   sürükleme ve köşedeki boyutlandırma tutamacına hiç ulaşmıyordu.
2. Başlığın neredeyse tamamını adres kutusu kaplıyordu; tutacak yer yoktu.
3. Hızlı sürüklemede imleç kartın içindeki sayfaya (webview) kayınca fare
   olaylarını o sayfa yutuyordu ve sürükleme kopuyordu.

**Düzeltme:** Durdurma kabarma aşamasına alındı, başlığın soluna bir tutamaç
(⠿) eklendi, taşıma/boyutlandırma sırasında tüm pencereyi kaplayan şeffaf bir
katman açılıyor.

**Dosyalar:** `src/components/BrowserCard.tsx`
