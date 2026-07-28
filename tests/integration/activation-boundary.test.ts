import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const entry = readFileSync(
  join(
    process.cwd(),
    "base44/functions/activatePolicyVersion/entry.ts",
  ),
  "utf8",
);

test("authorizes activation before service-role entity access", () => {
  assert.match(entry, /buildWorkflowActor\(await base44\.auth\.me\(\)\)/);
  assert.match(
    entry,
    /base44\.asServiceRole\.entities\.PolicyVersion\.get\(versionId\)/,
  );
  assert.match(
    entry,
    /base44\.asServiceRole\.entities\.Policy\.get\(version\.policy_id\)/,
  );
});
