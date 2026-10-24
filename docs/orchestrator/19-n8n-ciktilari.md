# 19 — n8n çıktıları otomatik olarak agent'a gelsin

**Ne yaptım:** n8n iş akışlarının çıktısı artık ekibe kendiliğinden geliyor.

- **Gelen kutusu:** TermCanvas sabit bir portta (varsayılan `17890`) küçük
  bir HTTP ucu açıyor:
  `POST http://127.0.0.1:17890/inbox/<token>/<kaynak id'si veya adı>`.
  Normal API her açılışta port değiştirdiği için n8n'e yazılamıyordu; bu uç
  sabit. Port, dinlenen adres ve gizli token
  `~/.termcanvas/team/team-inbox.json` içinde. Port doluysa sonraki boş port
  kullanılıp kaydediliyor; adres sonraki açılışlarda da aynı kalıyor.
- **Kim alır:** Olay, kaynağın kabloyla bağlı olduğu yönetici(ler)e gidiyor
  — agent boşa çıkınca, bir sonraki komutu olarak. Mesaj
  `[TermCanvas · n8n event from source "…"]` başlığıyla, kaynağın notları ve
  JSON gövdeyle birlikte geliyor; yönetici gerekirse işi astlarına dağıtıyor.
  Ekip panelinde `n8n · <kaynak> → <agent>: <özet>` satırı görünüyor.
- **Adres kanvasta:** n8n ve HTTP API kaynak düğümlerinde artık
  "Workflow output → team" satırı var: tıklayınca adres kopyalanıyor.
  `localhost` / `docker` düğmesi n8n Docker'da çalışıyorsa
  `host.docker.internal` adresine geçiriyor.
- **n8n tarafı:** `integrations/n8n/build-termcanvas-notify.mjs` iki şey
  üretiyor:
  1. `--node` ile **iki düğümlük bir parça** (*Paketle → TermCanvas'a
     gönder*): JSON'unu herhangi bir iş akışının kanvasına yapıştır, son
     düğümünü *Paketle*'ye bağla. En kolay yol bu.
  2. Bir **alt iş akışı** (*Execute Workflow Trigger → Paketle → TermCanvas'a
     gönder*): birçok iş akışından *Execute Workflow* düğümüyle çağırmak
     için. n8n 2.x alt iş akışını yalnızca **yayınlanmışsa** çalıştırır
     (arayüzde *Publish* ya da `n8n publish:workflow --id=tcTeamNotify01`).

  *Paketle* tüm öğeleri tek olaya toplar
  (`{summary, workflow, executionId, count, items}`); agent her
  çalıştırmada bir kez uyanır.

**Kurulum:**

```bash
# Adresi kaynak düğümünden kopyala (n8n Docker'daysa "docker" seçili olsun)
node integrations/n8n/build-termcanvas-notify.mjs notify.json \
  "http://host.docker.internal:17890/inbox/<token>/<kaynak-id>" --node notify-node.json

# 1) notify-node.json içeriğini n8n kanvasına yapıştır, ya da
# 2) alt iş akışını içe aktarıp yayınla:
docker cp notify.json <n8n-konteyner>:/tmp/notify.json
docker exec <n8n-konteyner> n8n import:workflow --input=/tmp/notify.json
docker exec <n8n-konteyner> n8n publish:workflow --id=tcTeamNotify01
docker restart <n8n-konteyner>
```

**Doğrulama:** Gerçek n8n 2.44 ile denendi: *Manual Trigger → iki öğe →
Paketle → TermCanvas'a gönder* çalıştırması başarılı oldu, gelen kutusu
`202` döndü, olay kaynağa bağlı yöneticiye teslim edildi ve agent turunu
bitirdi. Gelen kutusu `tests/team-inbox.test.ts` ile de test ediliyor
(yoldaki/başlıktaki token, düz metin gövde, dolu port).

**Notlar:**

- Linux'ta Docker içindeki n8n'in ulaşabilmesi için `team-inbox.json`
  içinde `"host": "0.0.0.0"` yap ve TermCanvas'ı yeniden başlat (Docker
  Desktop'ta gerek yok).
- n8n bulutta çalışıyorsa (n8n.cloud) gelen kutusuna bir tünel gerekir
  (ör. `cloudflared tunnel --url http://127.0.0.1:17890`); adres yine
  `/inbox/<token>/<kaynak>` ile biter. Token tek kilit olduğu için adresi
  paylaşma.
- Kaynak hiçbir orkestratöre bağlı değilse uç `409` döner; olmayan kaynak
  için `404`, yanlış token için `401`.

**Dosyalar:** `electron/team-inbox.ts`, `electron/team-hub.ts`
(`handleInbound`), `electron/main.ts`, `src/canvas/orchestrationFlow.tsx`,
`integrations/n8n/build-termcanvas-notify.mjs`, `tests/team-inbox.test.ts`
