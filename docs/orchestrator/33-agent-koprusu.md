# 33 — Köprü: her agent için `BRIDGE.md` + `tc.mjs`

**Ne yaptım:** Pipeline'a bağlanan her agent kendi köprü klasörünü alıyor:

```
.termcanvas/bridge/<terminalId>/BRIDGE.md   eşlerle nasıl konuşulur
.termcanvas/bridge/<terminalId>/tc.mjs      köprü CLI'ı
```

- `tc.mjs` artık tek bir betik (`electron/bridge-script.ts`); orkestratör ve
  normal agent aynı betiği kullanıyor, sadece rolü farklı. Hepsi
  `/bridge/<kendi id>` uçlarıyla konuşuyor.
- `peers` (= `status`) bağlı agent'ları, **AI modellerini (M1…)** ve
  kaynakları gösteriyor.
- `BRIDGE.md` kuralları: eşlerle sadece kullanıcı isteyince ya da işe
  yarayınca konuş; gelen mesajlar "[TermCanvas pipeline]" ile başlar, cevabını
  normal yaz (gönderen otomatik okur); mesajı gönderene geri yazma (seni
  bekliyor); kendi kendine yeten mesaj yaz; aynı dosyayı birlikte düzenleme;
  kum havuzu/ağ hatasında izin isteyip tekrar dene.
- Yeni IPC: `bridge:prepare` dosyaları yazar ve agent'a gönderilecek kısa
  bilgilendirme mesajını döndürür.

**Dosyalar:** `electron/bridge-script.ts`, `electron/orchestrator-bridge.ts`,
`electron/main.ts`, `electron/preload.ts`, `src/types/index.ts`
