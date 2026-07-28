import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(path, "utf8");

test("ships the selected Evidence Cartography React control room", async () => {
  const [app, styles, packageJson] = await Promise.all([
    read("src/App.tsx"),
    read("src/index.css"),
    read("package.json"),
  ]);

  assert.match(app, /BlastRadiusMap/);
  assert.match(app, /EvidenceReview/);
  assert.match(app, /RemediationLedger/);
  assert.match(app, /PolicyTimeline/);
  assert.match(styles, /--cobalt:/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(packageJson, /"build": "vite build"/);
});

test("uses Base44 for authenticated data, trusted actions, and realtime", async () => {
  const [client, gateway, hook, loader] = await Promise.all([
    read("src/api/base44Client.ts"),
    read("src/api/controlRoomGateway.ts"),
    read("src/hooks/useControlRoom.ts"),
    read("base44/functions/loadControlRoomData/entry.ts"),
  ]);

  assert.match(client, /createClient/);
  assert.match(client, /appBaseUrl:\s*BASE44_PLATFORM_URL/);
  assert.match(gateway, /auth\.isAuthenticated/);
  assert.match(gateway, /auth\.loginWithProvider\("google"/);
  assert.doesNotMatch(gateway, /auth\.redirectToLogin/);
  assert.match(gateway, /functions\.invoke\("loadControlRoomData"/);
  assert.match(gateway, /functions\.invoke\("approveFinding"/);
  assert.match(gateway, /functions\.invoke\("createReviewerTask"/);
  assert.match(gateway, /functions\.invoke\("createAuditPacket"/);
  assert.match(loader, /buildWorkflowActor/);
  assert.match(loader, /asServiceRole\.entities\.Policy\.filter/);
  assert.match(loader, /organization_id:\s*actor\.organizationId/);
  assert.doesNotMatch(loader, /recipient_email|connector_message_id|private_file_uri/);
  assert.match(hook, /\.subscribe\(/);
});

test("keeps development fixtures out of the production data path", async () => {
  const [gateway, demo] = await Promise.all([
    read("src/api/controlRoomGateway.ts"),
    read("src/data/demoSnapshot.ts"),
  ]);

  assert.match(gateway, /import\.meta\.env\.DEV/);
  assert.match(gateway, /loadDemoSnapshot/);
  assert.match(
    gateway,
    /if \(import\.meta\.env\.DEV[\s\S]*loadDemoSnapshot\(\)/,
  );
  assert.match(demo, /Local preview/);
});
