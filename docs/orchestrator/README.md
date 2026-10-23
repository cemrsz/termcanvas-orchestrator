# TermCanvas Orkestratör

Bu fork, [TermCanvas](https://github.com/blueberrycongee/termcanvas) v0.39.10'a
n8n tarzı bir **orkestratör agent** ekler: tek bir agent'a komut verirsin, o da
canvas'ta kabloyla bağlı agent'lara iş dağıtır ve bağlı kaynakları (Google Sheet,
n8n webhook, HTTP API, yerel dosya, not) kullanır.

Değişiklikler 15 commit halinde eklendi. Her commit kendi kısa notunu bu klasöre
ekler; aşağıdaki liste commit sırasıyla aynıdır.

## Commit günlüğü

1. [Veri modeli](01-veri-modeli.md) — orkestrasyon grafiğinin tipleri
2. [Orkestrasyon store'u](02-store.md) — orkestratörler, kaynaklar ve kablolar için zustand store
3. [Sahne kaydı](03-kalicilik.md) — grafiği state.json'a yaz ve geri yükle
4. [Köprü aracı](04-kopru.md) — ORCHESTRATOR.md talimatı ve tc.mjs komut aracı
5. [API uçları](05-api.md) — /orchestrator uçları: manifest, agent, send, reply
6. [IPC ve preload](06-ipc.md) — orchestrator:prepare kanalı
7. [Sahne eylemleri](07-eylemler.md) — orkestratör oluşturma, dönüştürme, manifest
8. [Kaynak düğümleri ve kablolar](08-dugumler.md) — n8n tarzı kaynak düğümü, portlar, silinebilir kablo
9. [Terminal portları ve rozet](09-terminal-portlari.md) — orkestratör çerçevesi ve ORCHESTRATOR rozeti
10. [Canvas entegrasyonu](10-canvas.md) — kabloları çiz, sürükleyip bağla, sağ tık menüsü
11. [Terminal sağ tık menüsü](11-terminal-menusu.md) — Connect / Disconnect / Make Orchestrator
12. [Düzeltme: Claude oturum yolu](12-oturum-yolu.md) — boşluk, _ ve Türkçe harfli klasörlerde oturum dosyası bulunamıyordu
