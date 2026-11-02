# 16 — Yapay zekâ bağlayıcı kataloğu

**Ne yaptım:** Canvas'tan konuşulabilecek model sağlayıcılarının ("eklentiler")
ortak kataloğunu ekledim: **Claude, Gemini, ChatGPT** öne çıkanlar; ayrıca
DeepSeek, Grok, Mistral, Perplexity, OpenRouter, Groq, Ollama, LM Studio ve
OpenAI uyumlu "Custom".

Her kayıt: protokol (`anthropic`, `gemini`, `openai`), varsayılan adres,
anahtarın okunacağı ortam değişkenleri (`GEMINI_API_KEY` gibi), önerilen
modeller ve varsa CLI'ı (`claude -p`, `gemini`, `codex exec`).

İki taşıma yolu var: **API** (anahtarla) ve **CLI** (aboneliğinle giriş
yaptığın kendi CLI'ı; anahtar gerekmez).

**Dosyalar:** `shared/ai-connectors.ts`

**Neden:** Ana süreç (çağrıyı yapan) ve arayüz (düğümleri, AI Hub'ı çizen)
aynı listeyi kullanıyor; dosya Node veya DOM'a bağımlı değil.
