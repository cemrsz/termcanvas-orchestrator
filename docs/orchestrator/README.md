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
