# 66 — AI Hub: araç çubuğu düğmesi ve kısayol

**Ne yaptım:**

- Üst araç çubuğuna ✦ **AI Hub** düğmesi. AI'lar arasında okunmamış mesaj
  varsa üstünde sayı rozeti (9'dan fazlası "9+"); ipucunda "3 yeni mesaj".
- Kısayol: **⌘⇧Y** (Windows/Linux: Alt+Shift+Y) Hub'ı açar/kapatır;
  terminal odaktayken de çalışır. Ayarlar → Kısayollar'da değiştirilebilir;
  kayıtlı kısayolları olan kullanıcılarda varsayılanla birleşir.

**Dosyalar:** `src/toolbar/Toolbar.tsx`, `src/stores/shortcutStore.ts`,
`src/hooks/useKeyboardShortcuts.ts`, `src/components/SettingsModal.tsx`,
`src/i18n/en.ts`
