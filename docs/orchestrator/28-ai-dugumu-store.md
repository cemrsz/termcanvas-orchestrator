# 28 — Store: AI düğümü ekleme ve ayarlama

**Ne yaptım:** `addAiNode(connector, konum, seçenekler)` ve
`updateAiConfig(id, değişiklik)`:

- Yeni AI düğümü bağlayıcının adını alır ("Gemini", "ChatGPT"…), varsayılan
  olarak API yolunu kullanır ve modeli boş bırakır (= bağlayıcının varsayılan
  modeli). Boyutu kaynak düğümlerinden biraz büyük (320 × 250).
- Bağlayıcı değiştirildiğinde, düğüm hâlâ eski bağlayıcının adını taşıyorsa
  adı da yenisine geçer; kullanıcının verdiği özel ad korunur.

**Dosyalar:** `src/stores/orchestrationStore.ts`
