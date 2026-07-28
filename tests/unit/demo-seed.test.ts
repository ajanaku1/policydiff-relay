import assert from "node:assert/strict";
import test from "node:test";

import { buildDemoSeedPlan } from "../../base44/shared/demo-seed.ts";

const policyAdmin = {
  id: "admin-1",
  organizationId: "org-1",
  policyRole: "policy_admin" as const,
};

test("builds one deterministic policy baseline with three cited answers", async () => {
  const plan = await buildDemoSeedPlan(policyAdmin, "drive-file-1");

  assert.equal(plan.policy.sourceFileId, "drive-file-1");
  assert.equal(plan.clauses.length, 3);
  assert.equal(plan.guidance.length, 3);
  assert.ok(plan.guidance.some((item) => item.label === "affected"));
  assert.ok(plan.guidance.some((item) => item.label === "still_valid"));
  assert.ok(plan.guidance.some((item) => item.label === "uncertain"));
  assert.ok(plan.guidance.every((item) => item.citedClauseKeys.length > 0));
  assert.match(plan.version.contentHash, /^[a-f0-9]{64}$/);
});

test("keeps seed dedupe keys stable for repeated setup", async () => {
  const first = await buildDemoSeedPlan(policyAdmin, "drive-file-1");
  const second = await buildDemoSeedPlan(policyAdmin, "drive-file-1");

  assert.equal(first.policy.dedupeKey, second.policy.dedupeKey);
  assert.equal(first.version.dedupeKey, second.version.dedupeKey);
  assert.deepEqual(
    first.clauses.map((clause) => clause.dedupeKey),
    second.clauses.map((clause) => clause.dedupeKey),
  );
});

test("routes only the affected correction to the supplied demo inbox", async () => {
  const plan = await buildDemoSeedPlan(
    policyAdmin,
    "drive-file-1",
    "policy-demo@example.com",
  );
  const affected = plan.guidance.find((item) => item.label === "affected");
  const safe = plan.guidance.find((item) => item.label === "still_valid");

  assert.equal(affected?.recipientEmail, "policy-demo@example.com");
  assert.equal(safe?.recipientEmail, "rowan.kim@example.test");
});

test("rejects demo provisioning by a non-admin role", async () => {
  await assert.rejects(
    () => buildDemoSeedPlan({ ...policyAdmin, policyRole: "reviewer" }, "drive-file-1"),
    /POLICY_ADMIN_REQUIRED/,
  );
});

test("rejects an empty Drive file ID", async () => {
  await assert.rejects(
    () => buildDemoSeedPlan(policyAdmin, "  "),
    /DRIVE_FILE_ID_REQUIRED/,
  );
});
