# 41 — `discuss`: AI'lar sırayla tartışır

**Ne yaptım:** Pipeline'la bağlı agent'ları ve modelleri aynı konuda
tartıştıran komut:

```
node .termcanvas/bridge/<id>/tc.mjs discuss gemini,codex "Bu API tasarımı ölçeklenir mi?" --rounds 2
```

- Katılımcılar virgülle verilir: agent (numara, ad, tür) veya model (M1…).
  Komutu çalıştıran agent moderatördür.
- Her tur, her katılımcıya konu + o ana kadarki konuşma gönderilir;
  "diğerlerine adıyla cevap ver, iyi fikirleri geliştir, zayıf olanlara itiraz
  et, en fazla ~200 kelime" denir. Böylece Claude, Gemini ve Codex
  **birbirinin söylediğini görerek** konuşur.
- Konuşma uzadıkça eski turlar kısaltılır (prompt şişmez); en fazla 6 tur.
- Bir agent onay bekliyor ya da hâlâ çalışıyorsa o tur atlanır, tartışma
  durmaz. Her tur canvas'taki akışa da düşer ("tartışma · tur 2").
- Sonunda moderatörden kullanıcı için özet istenir.

**Dosyalar:** `electron/bridge-script.ts`, `electron/orchestrator-bridge.ts`
