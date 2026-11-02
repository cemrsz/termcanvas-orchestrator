# 35 — API: bağlı modele danışma (`/bridge/:id/model`)

**Ne yaptım:** Bir agent, kendisine bağlı AI düğümüne soru sorabiliyor:

```
POST /bridge/<id>/model   { "model": "M1" | "gemini" | "<ad>", "prompt": "…" }
→ { text, model, latencyMs, usage }
```

- Model `M1`, kimlik, ad ya da bağlayıcı adıyla (`gemini`, `chatgpt`)
  seçilebiliyor; sadece **bağlı** modeller bulunur.
- Modele kim olduğu ve kimin sorduğu söyleniyor: "Sen Gemini'sin; Claude
  (claude) adlı agent sana danışıyor; dosya göremezsin, mesajdaki bilgiye
  dayan; isteğin dilinde kısa cevap ver" + düğümdeki persona ("Rolün: …").
- CLI yolu agent'ın klasöründe çalışıyor.
- Her soru ve cevap (veya hata) akışa düşüyor: süre, token, model, etiket.
- Model çağrıları dakikalar sürebildiği için bu uçta 30 sn'lik boşta kalma
  sınırı uzatıldı. Anahtar/CLI eksikse 424, sağlayıcı hatasında 502 döner.

**Dosyalar:** `electron/api-server.ts`, `electron/main.ts`
