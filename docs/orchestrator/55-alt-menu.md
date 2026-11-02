# 55 — Sağ tık menüsünde alt menü

**Ne yaptım:** `ContextMenu` artık iç içe menü destekliyor
(`{ type: "submenu", label, items }`), menüler uzamadan gruplanabiliyor:

- Fareyle üzerine gelince açılıyor (kısa gecikmeyle, kayarken kapanmıyor),
  tıklayınca da açılıyor.
- Klavye: `→` / `Enter` açar ve ilk öğeye odaklanır, `↑ ↓ Home End` gezer,
  `←` kapatıp üst öğeye döner, `Esc` hepsini kapatır.
- Ekranın sağına sığmazsa sola, altına sığmazsa yukarı kayıyor.
- Öğelere renkli nokta (ör. AI sağlayıcısının rengi) ve sağda soluk bir ipucu
  ("API · CLI") eklenebiliyor.
- Mevcut menüler aynı şekilde çalışmaya devam ediyor.

**Dosyalar:** `src/components/ContextMenu.tsx`
