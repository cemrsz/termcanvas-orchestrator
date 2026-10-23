# 04 — Köprü aracı

**Ne yaptım:** Her orkestratör için projenin içine
`.termcanvas/orchestrator/<id>/` altında iki dosya yazan modülü ekledim:

- `ORCHESTRATOR.md` — orkestratörün çalışma kuralları (önce `status`, işi rol
  adına göre dağıt, workerlara kendi başına anlaşılır prompt yaz, `trigger`'ı
  sadece istenince kullan, kullanıcının dilinde cevap ver).
- `tc.mjs` — bağımlılıksız Node aracı: `status`, `send`, `wait`, `ask`, `reply`,
  `source`, `trigger`. n8n/API kaynakları `source` ile GET (`--query`),
  `trigger` ile POST çağrılır.

Klasöre `.gitignore` konuyor, üretilen dosyalar kullanıcının git geçmişine
girmiyor. Agent'ın son cevabını Claude/Codex oturum kaydından (JSONL) okuyan
`extractLastAssistantReply` da burada.

**Dosyalar:** `electron/orchestrator-bridge.ts`
