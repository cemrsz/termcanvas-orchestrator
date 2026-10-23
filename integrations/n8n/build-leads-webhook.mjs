// Builds the "TermCanvas: Leads oku" n8n workflow: GET webhook -> Google Sheets
// read -> filter by ?status / ?limit -> { count, rows } JSON. Wire the webhook
// URL to an orchestrator as an "n8n Webhook" source and read it with
// `tc.mjs source "<name>" --query "status=Pending&limit=20"`.
//
// Usage:
//   node build-leads-webhook.mjs <out.json> <webhookPath> <sheetUrl> [sheetName]
// Use a long random webhookPath: it is the only thing guarding the rows.
import fs from "node:fs";
import crypto from "node:crypto";

const [outPath, webhookPath, sheetUrl, sheetName = "Leads"] = process.argv.slice(2);
if (!outPath || !webhookPath || !sheetUrl) {
  console.error(
    "usage: node build-leads-webhook.mjs <out.json> <webhookPath> <sheetUrl> [sheetName]",
  );
  process.exit(1);
}

const filterCode = `const items = $input.all();
// With onError=continueRegularOutput a failed read arrives as { error }.
const failed = items.find((item) => item.json.error && Object.keys(item.json).length === 1);
if (failed) {
  const reason = failed.json.error.message ?? failed.json.error;
  return [{ json: { error: "Leads sekmesi okunamadi: " + reason + ". n8n'de 'Leads sekmesini oku' dugumune Google Sheets kimlik bilgisi baglanmali." } }];
}
const query = $('Leads webhook').first().json.query || {};
let rows = items.map((item) => item.json).filter((row) => Object.keys(row).length > 0);
if (query.status) {
  const wanted = String(query.status).toLowerCase();
  rows = rows.filter((row) => String(row.status ?? '').toLowerCase() === wanted);
}
const limit = parseInt(query.limit, 10);
if (limit > 0) rows = rows.slice(0, limit);
return [{ json: { count: rows.length, rows } }];`;

const workflow = {
  id: "tcLeadsReadHook1",
  name: "TermCanvas: Leads oku (webhook)",
  active: false,
  nodes: [
    {
      id: crypto.randomUUID(),
      name: "Leads webhook",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [0, 0],
      webhookId: crypto.randomUUID(),
      parameters: {
        httpMethod: "GET",
        path: webhookPath,
        responseMode: "responseNode",
        options: {},
      },
    },
    {
      id: crypto.randomUUID(),
      name: "Leads sekmesini oku",
      type: "n8n-nodes-base.googleSheets",
      typeVersion: 4.5,
      position: [240, 0],
      alwaysOutputData: true,
      // Missing credentials / no access flow on as an { error } item, which
      // "Filtrele" turns into a readable message instead of an empty reply.
      onError: "continueRegularOutput",
      parameters: {
        resource: "sheet",
        operation: "read",
        documentId: { __rl: true, mode: "url", value: sheetUrl },
        sheetName: { __rl: true, mode: "name", value: sheetName },
        options: {},
      },
    },
    {
      id: crypto.randomUUID(),
      name: "Filtrele",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [480, 0],
      parameters: { jsCode: filterCode },
    },
    {
      id: crypto.randomUUID(),
      name: "Cevap ver",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1,
      position: [720, 0],
      parameters: { respondWith: "firstIncomingItem", options: {} },
    },
  ],
  connections: {
    "Leads webhook": { main: [[{ node: "Leads sekmesini oku", type: "main", index: 0 }]] },
    "Leads sekmesini oku": { main: [[{ node: "Filtrele", type: "main", index: 0 }]] },
    Filtrele: { main: [[{ node: "Cevap ver", type: "main", index: 0 }]] },
  },
  settings: {
    executionOrder: "v1",
    // Lead rows are personal data: don't keep a copy of every read.
    saveDataSuccessExecution: "none",
    saveManualExecutions: false,
  },
  pinData: {},
  tags: [],
};

fs.writeFileSync(outPath, JSON.stringify(workflow, null, 2), "utf-8");
console.log("wrote", outPath, "webhook path:", webhookPath);
