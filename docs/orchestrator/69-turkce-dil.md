# 69 — Türkçe arayüz dili

**Ne yaptım:** Uygulamaya **Türkçe** dil seçeneği eklendi:

- Ayarlar → Genel → Dil: `中文 · English · Türkçe`.
- Sistem dili Türkçeyse ilk açılışta otomatik Türkçe gelir.
- Bu çalışmanın tüm yeni metinleri Türkçe: AI düğümü, canvas ve terminal
  menüleri (Yeni Orkestratör, AI Modeli Ekle, Pipeline bağla…), rozetler,
  komut paleti, **AI Merkezi** (Bağlayıcılar, Konsey, Akış).
- Sözlük kısmi olabilir: Türkçesi olmayan metin İngilizceye düşer, boş
  kalmaz.
- Otomatik terminal başlığı özeti de Türkçe istenir ("bu oturumun ne
  üzerinde çalıştığını tek kısa Türkçe cümleyle özetle").
- Dil, React dışındaki yerlerde (güncelleme uyarısı, anlık görüntü geçmişi,
  WebGL uyarısı) tek bir `getDictionary()` üzerinden okunuyor; her dosyada
  ayrı "zh mi değil mi" kontrolü kalmadı.

**Dosyalar:** `src/i18n/tr.ts`, `src/i18n/useT.ts`, `src/stores/localeStore.ts`,
`src/components/SettingsModal.tsx`, `src/stores/updaterStore.ts`,
`src/snapshotHistory.ts`, `src/terminal/terminalRuntimeStore.ts`,
`src/terminal/webglContextPool.ts`, `electron/summary-service.ts`,
`src/types/index.ts`
