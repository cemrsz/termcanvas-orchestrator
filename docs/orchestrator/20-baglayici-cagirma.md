# 20 — Bağlayıcılar: soru sorma (API veya CLI)

**Ne yaptım:** `AiConnectorService.invoke()` — bir bağlayıcıya tek bir soru
sorar ve `{ text, model, transport, latencyMs, usage }` döndürür.

- **API:** adres → anahtar → model sırasıyla çözülür (düğümün modeli, sonra
  bağlayıcının varsayılanı, sonra katalog varsayılanı). Ollama / LM Studio
  gibi yerel sunucularda model boşsa sunucunun listelediği ilk model
  kullanılır.
- **CLI:** CLI kurulu değilse kurulum komutunu söyler; Codex'in son mesajı
  geçici dosyadan okunur ve dosya silinir; CLI hata verirse stderr'in son
  satırları ve "giriş yaptın mı?" ipucu gösterilir.
- Süre sınırı varsayılan 180 sn, en fazla 600 sn.

**Dosyalar:** `electron/ai-connector-service.ts`
