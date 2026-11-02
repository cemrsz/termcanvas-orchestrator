# 21 — Test: bağlayıcı servisi

**Ne yaptım:** Servisi sahte `fetch` ve sahte CLI çalıştırıcıyla test ettim:

- Anahtar diske şifreli yazılıyor, dosya `0600`, durum çıktısında anahtarın
  tamamı hiçbir zaman görünmüyor; uygulama yeniden açılınca çözülüyor.
- Anahtar zinciri yoksa düz saklanıyor ve "güvensiz" diye işaretleniyor.
- `GOOGLE_API_KEY` gibi ortam değişkenleri kayıtlı anahtar yokken kullanılıyor.
- API çağrısı, hata mesajı, yerel sunucuda ilk modeli seçme.
- Codex CLI'ın son mesaj dosyası okunuyor ve siliniyor; CLI yok / hata /
  süre aşımı açık mesajlara dönüşüyor; CLI sürümü önbelleğe alınıyor.

**Dosyalar:** `tests/ai-connector-service.test.ts`
