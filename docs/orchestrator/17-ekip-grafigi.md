# 17 — Ekip grafiği: kademeli yönetim ve paylaşılan kaynaklar

**Ne yaptım:** Kablolar artık bir **ekip** tanımlıyor. Kabloyla birbirine
bağlı her agent ve kaynak (hangi yönden olursa olsun) aynı ekipte.

- **Kademeli yönetim:** Bir orkestratör başka bir orkestratöre bağlanabiliyor
  (ör. Opus lider → Sonnet yöneticiler → Haiku işçiler). Eskiden "orkestratör
  başka bir orkestratörün işçisi olamaz" kuralı vardı; artık yalnızca döngü
  (bir yöneticinin kendi altındakine bağlanması) engelleniyor.
- **Üst port:** Orkestratörün yan portları giden kablolar için; kendi
  yöneticisinden gelen kablo kutunun üst kenarındaki porta bağlanıyor.
- **Paylaşılan kaynaklar:** Bir Sheet/n8n/API/dosya/not ekipte herhangi bir
  yöneticiye bağlıysa ekibin tamamı onu görüyor.
- **Roller:** Her agent için "ne iş yapar" notu (`roles`) sahneyle birlikte
  kaydediliyor; tüm ekip bunu görüyor.
- **Sheet yazma köprüsü:** Sheet kaynağına ikinci bir adres alanı eklendi
  (Apps Script web uygulaması ya da n8n webhook'u). Agent'lar satır eklemek ve
  güncellemek için bunu kullanacak (bkz. not 20).
- Terminal sağ tık menüsü orkestratörleri de başka orkestratörlere
  bağlayabiliyor; döngü yaratacak seçenekler gösterilmiyor.
- "New Orchestrator" projedeki agent'ları bağlarken başka bir yöneticiye
  zaten bağlı olanlara dokunmuyor.

Ekip mantığı saf fonksiyonlar olarak `shared/team.ts` içinde: ana süreç,
arayüz ve testler aynı tanımı kullanıyor.

**Dosyalar:** `shared/team.ts`, `src/actions/teamDirectory.ts`,
`src/stores/orchestrationStore.ts`, `src/types/orchestration.ts`,
`src/snapshotBridge.ts`, `src/canvas/XyFlowCanvas.tsx`,
`src/canvas/xyflowNodes.tsx`, `src/canvas/orchestrationFlow.tsx`,
`src/terminal/TerminalTile.tsx`, `src/actions/orchestrationSceneActions.ts`,
`tests/team-graph.test.ts`
