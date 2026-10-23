# 15 — n8n okuma webhook'u ve kılavuz

**Ne yaptım:** Özel bir Google Sheet'i, paylaşıma açmadan orkestratöre
okutmak için bir n8n iş akışı kurucusu ekledim:
`integrations/n8n/build-leads-webhook.mjs`.

İş akışı: **Webhook (GET) → Google Sheets: sekmeyi oku → filtrele
(`?status=`, `?limit=`) → `{count, rows}`**. Okuma başarısız olursa açık bir
`{error}` mesajı döner. Lead'ler kişisel veri olduğu için başarılı okumalar
n8n geçmişine kaydedilmez.

**Kurulum:**

```bash
node integrations/n8n/build-leads-webhook.mjs wf.json leads-<uzun-rastgele-yol> "<sheet-url>" Leads
docker cp wf.json <n8n-konteyner>:/tmp/wf.json
docker exec <n8n-konteyner> n8n import:workflow --input=/tmp/wf.json
docker exec <n8n-konteyner> n8n publish:workflow --id=tcLeadsReadHook1
docker restart <n8n-konteyner>
```

Sonra n8n'de **Leads sekmesini oku** düğümüne Google Sheets kimlik bilgisi bağla.
Canvas'a bir **n8n Webhook** kaynağı ekle, adresine
`http://localhost:5678/webhook/<yol>` yaz ve orkestratöre bağla. Orkestratör
`source "<kaynak adı>" --query "status=Pending&limit=20"` ile okur.

Webhook yolu tek koruma olduğu için uzun ve rastgele olmalı, depoya
yazılmamalı. n8n'i dış dünyaya açarsan (ör. Cloudflare tüneli) bu webhook'a
ayrıca kimlik doğrulama ekle.

Ayrıca kök `README.md`'ye bu klasöre giden bir not ve buraya kullanım kılavuzu
eklendi.

**Dosyalar:** `integrations/n8n/build-leads-webhook.mjs`, `README.md`,
`docs/orchestrator/README.md`
