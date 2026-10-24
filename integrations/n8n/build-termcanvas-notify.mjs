// Builds the "TermCanvas: agent'a gönder" n8n workflow: any workflow that
// calls it (Execute Workflow node) or copies its HTTP node pushes its output
// to the agents wired to a source on the canvas.
//
//   Execute Workflow Trigger -> Paketle (all items -> one event) -> HTTP POST to the team inbox
//
// Usage:
//   node build-termcanvas-notify.mjs <out.json> <inboxUrl> [--node <node.json>]
//
// <inboxUrl> is the address shown on the n8n source node in TermCanvas
// ("Workflow output → team"). Use its "docker" variant (host.docker.internal)
// when n8n runs in Docker. With --node, the two nodes (Paketle + HTTP) are
// also written as a snippet: paste it straight into an existing workflow's
// canvas and connect your last node to "Paketle". The sub-workflow must be
// published (n8n 2.x runs only published sub-workflows).
import fs from "node:fs";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const nodeFlag = args.indexOf("--node");
const nodeOut = nodeFlag >= 0 ? args[nodeFlag + 1] : null;
const [outPath, inboxUrl] = args.filter((_, i) => nodeFlag < 0 || (i !== nodeFlag && i !== nodeFlag + 1));
if (!outPath || !inboxUrl || !/^https?:\/\/.+\/inbox\/.+\/.+/.test(inboxUrl)) {
  console.error(
    "usage: node build-termcanvas-notify.mjs <out.json> <inboxUrl> [--node <node.json>]\n" +
      "       <inboxUrl> looks like http://host.docker.internal:17890/inbox/<token>/<sourceId>",
  );
  process.exit(1);
}

// One event per run: the agent gets every item at once, plus a summary line
// for the Team panel.
const packCode = `const items = $input.all().map((item) => item.json);
return [{
  json: {
    summary: $workflow.name + ": " + items.length + " item(s)",
    workflow: $workflow.name,
    executionId: $execution.id,
    count: items.length,
    items,
  },
}];`;

function packNode(position) {
  return {
    id: crypto.randomUUID(),
    name: "Paketle",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position,
    parameters: { jsCode: packCode },
  };
}

function httpNode(position) {
  return {
    id: crypto.randomUUID(),
    name: "TermCanvas'a gönder",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position,
    parameters: {
      method: "POST",
      url: inboxUrl,
      sendBody: true,
      specifyBody: "json",
      jsonBody: "={{ JSON.stringify($json) }}",
      options: { timeout: 10000 },
    },
  };
}

const workflow = {
  id: "tcTeamNotify01",
  name: "TermCanvas: agent'a gönder",
  active: false,
  nodes: [
    {
      id: crypto.randomUUID(),
      name: "Başka iş akışından",
      type: "n8n-nodes-base.executeWorkflowTrigger",
      typeVersion: 1.1,
      position: [0, 0],
      parameters: { inputSource: "passthrough" },
    },
    packNode([240, 0]),
    httpNode([480, 0]),
  ],
  connections: {
    "Başka iş akışından": { main: [[{ node: "Paketle", type: "main", index: 0 }]] },
    Paketle: { main: [[{ node: "TermCanvas'a gönder", type: "main", index: 0 }]] },
  },
  settings: { executionOrder: "v1" },
  pinData: {},
  tags: [],
};

fs.writeFileSync(outPath, JSON.stringify(workflow, null, 2), "utf-8");
console.log("wrote", outPath);

if (nodeOut) {
  // n8n accepts this shape on paste: { nodes, connections }. Connect the
  // last node of your workflow to "Paketle".
  const snippet = {
    nodes: [packNode([0, 0]), httpNode([240, 0])],
    connections: {
      Paketle: { main: [[{ node: "TermCanvas'a gönder", type: "main", index: 0 }]] },
    },
  };
  fs.writeFileSync(nodeOut, JSON.stringify(snippet, null, 2), "utf-8");
  console.log("wrote", nodeOut, "(paste into an n8n canvas)");
}
