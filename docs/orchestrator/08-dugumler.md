# 08 — Kaynak düğümleri ve kablolar

**Ne yaptım:** Canvas için xyflow bileşenleri:

- **Kaynak düğümü** — türüne göre renkli (Sheet yeşil, n8n pembe, API camgöbeği,
  dosya gri, not sarı). Ad, adres ve not alanları düzenlenebilir; × ile silinir.
- **Portlar** — orkestratörde çıkış, agent ve kaynaklarda giriş; iki yanda da var,
  başlık hizasında (kenar boyutlandırma tutamaçlarıyla çakışmaz).
- **Kablo** — ortasında × ile kesilir; bağlı agent çıktı üretirken kesik çizgi
  akar. Her kablo, düğümlerin birbirine bakan kenarlarından çıkar.

**Dosyalar:** `src/canvas/orchestrationFlow.tsx`, `src/index.css`
