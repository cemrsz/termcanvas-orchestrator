# 22 — Solda Ekip paneli: agent'lar ne yapıyor, tek cümleyle

**Ne yaptım:** Sol panele **Team** sekmesi eklendi (Sessions ile History
arasında). Bir grup sohbeti gibi, her satır tek cümle:

- **Kadro:** Ekibin tamamı, hiyerarşiye göre girintili. Her agent'ın model
  rozeti (opus / sonnet / haiku), durum noktası (yeşil çalışıyor, sarı onay
  bekliyor, gri boşta, kırmızı çalışmıyor) ve "şu an ne yapıyor" cümlesi.
  Satıra tıklayınca kanvas o terminale kayıyor; ✎ ile rol notu
  düzenleniyor.
- **Akış:** "Director → Research Manager: rakip listesini çıkar",
  "Researcher 2: “n8n pricing” arıyorum", "Data 1: Leads sheet'ine 12 satır
  ekledim", "n8n · New Leads → Research Manager: 3 yeni lead",
  "✓ Bitirdim: …". Agent'ın kendi `say` cümleleri baloncuk olarak, araç
  adımları soluk tek satır olarak görünüyor; aynı agent'ın art arda gelen
  araç adımları tek satırda birleşiyor. "Araç adımları" kutusu bunları
  gizliyor. Yukarı kaydırınca akış yerinde duruyor, "↓ yeni satır"
  düğmesi en alta götürüyor.
- **Raporlar:** Liderin `report` ile kaydettiği raporlar listeleniyor;
  "Raporu aç" düzgün biçimlenmiş markdown okuyucuyu açıyor (tablo, liste,
  başlık), "Markdown'ı kopyala" ile alınabiliyor.
- Birden çok ekip varsa üstten seçiliyor. Panel dili TR/EN arasında
  değişiyor; otomatik cümleler de aynı dile geçiyor.

**Ek düzeltmeler:**

- Yeni açılan bir terminalin ilk hook olayları ekip dizini henüz
  güncellenmeden gelirse kaybolmuyor; dizin gelince işleniyor.
- Telemetri "düşünüyor" deyip 3 dakikadır sessiz kalan bir agent
  (ör. geri yüklenmiş oturum) teslim kuyruğunu sonsuza kadar
  kilitlemiyor. Araç çalıştıran ve onay bekleyen agent'lara yine
  dokunulmuyor.
- `wait`, çok hızlı biten turları da yakalıyor (agent'ın son "bitti"
  zamanına bakıyor).
- n8n olayı akışta JSON'un ilk satırı yerine özetiyle görünüyor
  ("Otomatik olay geldi (New Leads): 2 yeni lead").

**Doğrulama:** Gerçek uygulamada (sanal ekran, sahte `claude`): 25 kişilik
ekip, görev, `say`, pano, n8n olayı ve rapor akışta göründü; rapor okuyucu
açıldı. Birim testleri `tests/team-hub.test.ts`.

**Dosyalar:** `src/components/TeamPanel.tsx`, `src/components/LeftPanel.tsx`,
`src/stores/canvasStore.ts`, `src/i18n/en.ts`, `src/i18n/zh.ts`,
`shared/teamActivity.ts`, `electron/team-hub.ts`, `electron/team-api.ts`,
`electron/team-bridge.ts`, `electron/main.ts`, `tests/team-hub.test.ts`
