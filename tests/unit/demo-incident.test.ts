import assert from "node:assert/strict";
import { it } from "node:test";

import { buildDemoIncidentPlan } from "../../base44/shared/demo-incident.ts";

const actor = {
  id: "admin-01",
  organizationId: "northstar-benefits-demo",
  policyRole: "policy_admin" as const,
};

const guidance = [
  {
    id: "guidance-affected",
    question: "Can a 19-year-old applicant enroll this summer?",
  },
  {
    id: "guidance-valid",
    question: "When does the waiting period begin?",
  },
  {
    id: "guidance-uncertain",
    question: "Does the age threshold apply to contractors?",
  },
];

it("builds one deterministic v5 incident over the seeded policy baseline", async () => {
  const plan = await buildDemoIncidentPlan(actor, {
    guidance,
    oldVersionId: "version-v4",
    policyId: "policy-eligibility",
    sourceFileId: "google-doc-01",
  });

  assert.equal(plan.version.sourceRevision, "demo-v5");
  assert.match(plan.version.contentHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    plan.clauses.filter((clause) => clause.changed).map((clause) => clause.clauseKey),
    ["4.2"],
  );
  assert.deepEqual(
    plan.findings.map((finding) => finding.classification),
    ["affected", "still_valid", "uncertain"],
  );
  assert.equal(plan.findings[0]?.guidanceId, "guidance-affected");
  assert.equal(plan.findings[2]?.requiresTask, true);
  assert.equal(plan.replay.candidateCount, 3);
});

it("rejects an incomplete demo guidance baseline", async () => {
  await assert.rejects(
    () => buildDemoIncidentPlan(actor, {
      guidance: guidance.slice(0, 2),
      oldVersionId: "version-v4",
      policyId: "policy-eligibility",
      sourceFileId: "google-doc-01",
    }),
    /DEMO_GUIDANCE_INCOMPLETE/,
  );
});
