# 61 — AI Hub: hepsi bir arada

**Ne yaptım:** Canvas'ın konuşabildiği tüm AI'ları tek yerde toplayan **AI
Hub** penceresi (`useAiHubStore`, `AiHubModal`):

- **Bağlayıcılar** sekmesi: Claude · Gemini · ChatGPT üstte, diğer
  sağlayıcılar "Diğer sağlayıcılar" altında; her biri kendi renginde bir kart.
- Kartta API durumu: "anahtar kayıtlı …9fQe", "anahtar $GEMINI_API_KEY'den",
  "anahtar gerekmez", "API anahtarı yok" (kırmızı).
- **Anahtar kutusu:** parola alanı; Enter/Kaydet ile şifreli saklanır,
  çöp kutusuyla silinir. Kaydedilen anahtar asla geri gösterilmez, sadece son
  4 karakteri. Yerel sunucularda (Ollama, LM Studio) kutu yok.
- Anahtar zinciri olmayan sistemde sarı uyarı: "anahtar şifresiz, sadece
  senin kullanıcının okuyabildiği bir dosyada".
- "Anahtar al ↗" bağlantısı sağlayıcının anahtar sayfasını tarayıcıda açar.
- `Esc` veya dışarı tıklayınca kapanır; açılınca durumlar yenilenir.

**Dosyalar:** `src/stores/aiHubStore.ts`, `src/components/AiHub/AiHubModal.tsx`,
`src/components/AiHub/ConnectorsTab.tsx`, `src/App.tsx`, `src/i18n/en.ts`
