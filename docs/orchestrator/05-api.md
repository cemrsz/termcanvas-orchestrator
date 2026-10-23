# 05 — API uçları

**Ne yaptım:** TermCanvas'ın yerel API'sine orkestratör uçlarını ekledim:

| Uç | Ne yapar |
| --- | --- |
| `GET /orchestrator/list` | Orkestratörleri listeler |
| `GET /orchestrator/:id` | Bağlı agent'lar (canlı durumlarıyla) ve kaynaklar |
| `GET /orchestrator/:id/agent?agent=` | Tek agent'ın durumu |
| `POST /orchestrator/:id/send` | Agent'ın terminaline prompt yapıştırıp gönderir |
| `GET /orchestrator/:id/reply?agent=` | Agent'ın son cevabı |

Agent numara, isim veya id ile seçilir; **sadece kabloyla bağlı** agent'lar
bulunur. Gönderim, TermCanvas'ın kendi composer yolunu kullanıyor.

**Dosyalar:** `electron/api-server.ts`
