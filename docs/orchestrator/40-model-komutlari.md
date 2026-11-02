# 40 — Köprü CLI: modellere sor, konsey, toplu mesaj

**Ne yaptım:** `tc.mjs` yeni komutlar aldı:

| Komut | Ne yapar |
| --- | --- |
| `ask <agent\|model> <metin>` | Agent'sa mesaj atıp cevabı bekler; modelse (M1, `gemini`, ad) tek seferde sorar |
| `consult <model> <metin>` | Sadece model: bağlı AI düğümüne danışır |
| `council <soru> [--models M1,M2] [--agents [1,2]]` | Aynı soruyu tüm bağlı modellere (istenirse agent'lara da) paralel sorar, cevapları alt alta basar |
| `broadcast <metin>` | Bağlı tüm agent'lara aynı mesajı yollar |

- `ask gemini …` hem agent'ı hem modeli gösterebilir; ikisi de bağlıysa
  belirsiz der ve numarayla (`2` ya da `M1`) seçmeni ister.
- Model cevabı başlığında model, yol, süre ve token sayısı var:
  `[Gemini · gemini-flash-latest · api · 2.4s, 312 tokens]`.
- `wait` mantığı tekrar kullanılabilir hâle getirildi (`waitFor`), konsey
  agent'ları paralel bekleyebiliyor.
- `BRIDGE.md` bu komutlarla güncellendi.

**Dosyalar:** `electron/bridge-script.ts`, `electron/orchestrator-bridge.ts`
