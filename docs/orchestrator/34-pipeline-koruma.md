# 34 — Pipeline mesajları: çerçeve ve korumalar

**Ne yaptım:** Bir agent pipeline üzerinden başka bir agent'a yazınca:

- **Çerçeve:** Mesaj alıcının sohbetine şöyle düşer:
  `[TermCanvas pipeline] Message from Claude (claude): …` ve sonunda
  "cevabını normal yaz, Claude otomatik okur; sen de yazmak istersen:
  `node .termcanvas/bridge/<id>/tc.mjs peers`". Böylece Gemini, Codex veya
  Claude, mesajın kimden geldiğini ve nasıl cevap vereceğini bilir.
- Alıcının köprü klasörü (BRIDGE.md + tc.mjs) yoksa o an yazılır.
- **Kilitlenme koruması:** A, B'nin cevabını beklerken (`wait`) B, A'ya yeni
  mesaj göndermeye kalkarsa reddedilir: "A senin cevabını bekliyor, normal
  cevabını yaz". `wait` artık sunucuya "bekliyorum" der.
- **Kaçak döngü koruması:** iki agent 10 dakikada 30'dan fazla mesajlaşırsa
  pipeline duraklar ve agent'a "kullanıcıya sor" denir.
- Orkestratörün işçilerine gönderdiği görevler eskisi gibi çerçevesiz gider.

**Dosyalar:** `electron/pipeline-guard.ts`, `electron/api-server.ts`,
`electron/bridge-script.ts`, `electron/main.ts`, `tests/pipeline-guard.test.ts`
