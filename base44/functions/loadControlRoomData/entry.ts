import {
  createClientFromRequest,
  type Base44Client,
  type EntityRecord,
} from "@base44/sdk";

import {
  buildWorkflowActor,
  serveBase44Function,
} from "../../shared/base44-http.ts";
import type { WorkflowActor } from "../../shared/workflow.ts";

type EntityFields<Name extends keyof EntityRecord> =
  Array<keyof EntityRecord[Name]>;

const coreFields = {
  clauses: ["id", "policy_version_id", "clause_key", "heading", "body"],
  deltas: ["id", "new_version_id", "old_version_id", "summary"],
  findings: [
    "id",
    "new_version_id",
    "guidance_id",
    "classification",
    "confidence",
    "correction_draft",
    "evidence_clause_ids",
    "old_version_id",
    "rationale",
    "status",
  ],
  guidance: ["id", "answer", "question"],
  policies: ["id", "name"],
  reviewTasks: ["id", "finding_id", "status"],
  versions: ["id", "created_date", "status"],
} satisfies {
  clauses: EntityFields<"PolicyClause">;
  deltas: EntityFields<"PolicyDelta">;
  findings: EntityFields<"Finding">;
  guidance: EntityFields<"Guidance">;
  policies: EntityFields<"Policy">;
  reviewTasks: EntityFields<"ReviewTask">;
  versions: EntityFields<"PolicyVersion">;
};

const protectedFields = {
  acknowledgements: ["id"],
  deliveries: ["id", "guidance_id", "status"],
  replayJobs: [
    "id",
    "new_version_id",
    "candidate_count",
    "completed_count",
    "status",
  ],
} satisfies {
  acknowledgements: EntityFields<"Acknowledgement">;
  deliveries: EntityFields<"Delivery">;
  replayJobs: EntityFields<"ReplayJob">;
};

async function loadCoreData(base44: Base44Client, actor: WorkflowActor) {
  const query = { organization_id: actor.organizationId };
  const [policyData, reviewData] = await Promise.all([
    loadPolicyData(base44, query),
    loadReviewData(base44, query),
  ]);
  return { ...policyData, ...reviewData };
}

function loadPolicyData(
  base44: Base44Client,
  query: { organization_id: string },
) {
  return Promise.all([
    base44.asServiceRole.entities.Policy.filter(
      query, "-created_date", 20, 0, coreFields.policies,
    ),
    base44.asServiceRole.entities.PolicyVersion.filter(
      query, "-created_date", 50, 0, coreFields.versions,
    ),
    base44.asServiceRole.entities.PolicyDelta.filter(
      query, "-created_date", 20, 0, coreFields.deltas,
    ),
  ]).then(([policies, versions, deltas]) => ({ deltas, policies, versions }));
}

function loadReviewData(
  base44: Base44Client,
  query: { organization_id: string },
) {
  return Promise.all([
    base44.asServiceRole.entities.Finding.filter(
      query, "-created_date", 100, 0, coreFields.findings,
    ),
    base44.asServiceRole.entities.Guidance.filter(
      query, "-created_date", 100, 0, coreFields.guidance,
    ),
    base44.asServiceRole.entities.PolicyClause.filter(
      query, "ordinal", 200, 0, coreFields.clauses,
    ),
    base44.asServiceRole.entities.ReviewTask.filter(
      query, "-created_date", 100, 0, coreFields.reviewTasks,
    ),
  ]).then(([findings, guidance, clauses, reviewTasks]) => ({
    clauses,
    findings,
    guidance,
    reviewTasks,
  }));
}

async function loadProtectedData(
  base44: Base44Client,
  actor: WorkflowActor,
) {
  if (actor.policyRole === "staff") {
    return { acknowledgements: [], deliveries: [], replayJobs: [] };
  }
  const query = { organization_id: actor.organizationId };
  const [deliveries, acknowledgements, replayJobs] = await Promise.all([
    base44.asServiceRole.entities.Delivery.filter(
      query, "-created_date", 100, 0, protectedFields.deliveries,
    ),
    base44.asServiceRole.entities.Acknowledgement.filter(
      query, "-created_date", 100, 0, protectedFields.acknowledgements,
    ),
    base44.asServiceRole.entities.ReplayJob.filter(
      query, "-created_date", 20, 0, protectedFields.replayJobs,
    ),
  ]);
  return { acknowledgements, deliveries, replayJobs };
}

serveBase44Function(async (request) => {
  const base44 = createClientFromRequest(request);
  const actor = buildWorkflowActor(await base44.auth.me());
  const [core, protectedData] = await Promise.all([
    loadCoreData(base44, actor),
    loadProtectedData(base44, actor),
  ]);
  return Response.json({ ...core, ...protectedData });
});
