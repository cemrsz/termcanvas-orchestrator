# 19 — n8n çıktıları otomatik olarak agent'a gelsin

**Ne yaptım:** n8n iş akışlarının çıktısı artık ekibe kendiliğinden geliyor.

- **Gelen kutusu:** TermCanvas sabit bir portta (varsayılan `17890`) küçük
  bir HTTP ucu açıyor:
  `POST http://127.0.0.1:17890/inbox/<token>/<kaynak id'si veya adı>`.
  Normal API her açılışta port değiştirdiği için n8n'e yazılamıyordu; bu uç
  sabit. Port, dinlenen adres ve gizli token
  `~/.termcanvas/team/team-inbox.json` içinde (port doluysa sonraki 10
  porttan boş olan kullanılır).
- **Kim alır:** Olay, kaynağın kabloyla bağlı olduğu yönetici(ler)e gidiyor
  — agent boşa çıkınca, bir sonraki komutu olarak. Mesaj
  `[TermCanvas · n8n event from source "…"]` başlığıyla, kaynağın notları ve
  JSON gövdeyle birlikte geliyor; yönetici gerekirse işi astlarına dağıtıyor.
  Ekip panelinde `n8n · <kaynak> → <agent>: <özet>` satırı görünüyor.
- **Adres kanvasta:** n8n ve HTTP API kaynak düğümlerinde artık
  "Workflow output → team" satırı var: tıklayınca adres kopyalanıyor.
  `localhost` / `docker` düğmesi n8n Docker'da çalışıyorsa
  `host.docker.internal` adresine geçiriyor.
- **n8n tarafı:** `integrations/n8n/build-termcanvas-notify.mjs` bir alt iş
  akışı üretiyor: *Execute Workflow Trigger → Paketle → TermCanvas'a gönder*.
  Herhangi bir iş akışının sonuna **Execute Workflow** düğümü koyup bunu
  çağırman yeterli. `--node` ile tek bir HTTP düğümü de üretiyor; JSON'unu
  doğrudan n8n kanvasına yapıştırabilirsin.

**Kurulum:**

```bash
# Adresi kaynak düğümünden kopyala (Docker için "docker" seçili olsun)
node integrations/n8n/build-termcanvas-notify.mjs notify.json \
  "http://host.docker.internal:17890/inbox/<token>/<kaynak-id>" --node notify-node.json
docker cp notify.json <n8n-konteyner>:/tmp/notify.json
docker exec <n8n-konteyner> n8n import:workflow --input=/tmp/notify.json
```

Sonra çıktısını göndermek istediğin iş akışının sonuna *Execute Workflow →
"TermCanvas: agent'a gönder"* ekle (ya da `notify-node.json` içeriğini
yapıştır).

**Notlar:**

- Linux'ta Docker içindeki n8n'in ulaşabilmesi için
  `team-inbox.json` içinde `"host": "0.0.0.0"` yap ve TermCanvas'ı yeniden
  başlat (Docker Desktop'ta gerek yok).
- n8n bulutta çalışıyorsa (n8n.cloud) gelen kutusuna bir tünel gerekir
  (ör. `cloudflared tunnel --url http://127.0.0.1:17890`); adres yine
  `/inbox/<token>/<kaynak>` ile biter. Token tek kilit olduğu için adresi
  paylaşma.
- Kaynak hiçbir orkestratöre bağlı değilse uç `409` döner; olmayan kaynak
  için `404`, yanlış token için `401`.

**Dosyalar:** `electron/team-inbox.ts`, `electron/team-hub.ts`
(`handleInbound`), `electron/main.ts`, `src/canvas/orchestrationFlow.tsx`,
`integrations/n8n/build-termcanvas-notify.mjs`
