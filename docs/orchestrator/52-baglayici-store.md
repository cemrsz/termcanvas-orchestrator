# 52 — Arayüz: bağlayıcı durum store'u

**Ne yaptım:** `useAiConnectorStore` — canvas'taki AI düğümleri ve AI Hub'ın
ortak kullandığı store:

- Ana süreçten bağlayıcı durumlarını çeker (`refresh`, `ensureLoaded`):
  anahtar var mı (son 4 karakter), ortam değişkeni, CLI kurulu mu, varsayılan
  model/adres. **Anahtarın kendisi buraya hiç gelmez.**
- `setKey` / `clearKey` / `setConfig` / `checkCli` / `fetchModels`
  (sağlayıcının güncel model listesi).
- Yardımcılar: `modelSuggestions` (çekilen + katalogdaki modeller),
  `transportReady` (bu düğüm şu an çağrılabilir mi), `invokeFromUi`
  (arayüzden soru sorar, istenirse akışa "Sen → Gemini" olarak düşer).

**Dosyalar:** `src/stores/aiConnectorStore.ts`, `tests/ai-connector-store.test.ts`
