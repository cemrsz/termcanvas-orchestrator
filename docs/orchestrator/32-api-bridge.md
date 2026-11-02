# 32 — API: `/bridge` uçları

**Ne yaptım:** Yerel API artık her bağlı agent'a hizmet veriyor, sadece
orkestratörlere değil:

| Uç | Ne yapar |
| --- | --- |
| `GET /bridge/:id` | Çağıranın bağlı agent'ları (canlı durumlarıyla), modelleri ve kaynakları |
| `GET /bridge/:id/agent?agent=` | Tek agent'ın durumu |
| `POST /bridge/:id/send` | Agent'ın terminaline mesaj yapıştırıp gönderir |
| `GET /bridge/:id/reply?agent=` | Agent'ın son cevabı |

- `:id` çağıran agent'ın terminal kimliği; yalnızca **ona bağlı** agent'lar
  bulunur (pipeline veya orkestratör link'i).
- Agent artık türüyle de seçilebilir: tek bir Gemini bağlıysa `gemini` yeter.
- `/orchestrator/:id/*` aynı kodu kullanıyor ama sadece orkestratörlere açık
  (eski köprü betikleri bozulmasın diye).

**Dosyalar:** `electron/api-server.ts`
