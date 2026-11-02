# 57 — Şablon: Claude ⇄ Gemini ⇄ Codex

**Ne yaptım:** Sağ tık → **Şablonlar ▸ Claude ⇄ Gemini ⇄ Codex**:

1. Tıkladığın yere Claude, Gemini ve Codex terminallerini yan yana açar
   (adları "Claude", "Gemini", "Codex").
2. Üçünü de **birbirine pipeline ile bağlar** (3 kablo, herkes herkesle).
3. Her birinin köprü klasörünü hazırlar ve **ilk prompt'u bilgilendirme
   olur**: "Artık şunlara bağlısın: Gemini (gemini), Codex (codex). BRIDGE.md'yi
   oku…". Böylece daha ilk turda kimlerle konuşabileceklerini bilirler.

Sonra herhangi birine "Gemini ve Codex'le bu tasarımı tartış" ya da
"Codex'ten testleri yazmasını iste" demen yeterli.

**Dosyalar:** `src/actions/orchestrationSceneActions.ts`,
`src/canvas/XyFlowCanvas.tsx`, `src/i18n/en.ts`, `tests/bridge-manifest.test.ts`
