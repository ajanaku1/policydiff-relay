import {
  createClientFromRequest,
  type Base44Client,
  type EntityRecord,
} from "@base44/sdk";

import { createSafeError } from "../../shared/base44-error.ts";
import { serveBase44Function } from "../../shared/base44-http.ts";
import {
  buildDemoIncidentPlan,
  type DemoIncidentPlan,
} from "../../shared/demo-incident.ts";
import { resolveDemoAdmin } from "../../shared/demo-admin.ts";
import { sha256Hex } from "../../shared/ingestion.ts";

interface Baseline {
  guidance: EntityRecord["Guidance"][];
  policy: EntityRecord["Policy"];
  version: EntityRecord["PolicyVersion"];
}

interface IncidentResult {
  delta_id: string;
  finding_ids: string[];
  replay_job_id: string;
  version_id: string;
}

serveBase44Function(async (request) => {
  const base44 = createClientFromRequest(request);
  const resolution = resolveDemoAdmin(await base44.auth.me());
  if (resolution.profileUpdate) {
    await base44.asServiceRole.entities.User.update(
      resolution.actor.id,
      resolution.profileUpdate,
    );
  }
  const baseline = await loadBaseline(base44, resolution.actor.organizationId);
  const plan = await buildDemoIncidentPlan(resolution.actor, {
    guidance: baseline.guidance,
    oldVersionId: baseline.version.id,
    policyId: baseline.policy.id,
    sourceFileId: baseline.policy.source_file_id,
  });
  const result = await seedIncident(
    base44,
    resolution.actor.id,
    baseline,
    plan,
  );
  return Response.json(result);
});

async function loadBaseline(
  base44: Base44Client,
  organizationId: string,
): Promise<Baseline> {
  const [policy] = await base44.asServiceRole.entities.Policy.filter(
    { organization_id: organizationId },
    "-created_date",
    1,
  );
  if (!policy) throw createSafeError("DEMO_BASELINE_NOT_FOUND");
  const [version] = await base44.asServiceRole.entities.PolicyVersion.filter(
    { policy_id: policy.id, source_revision: "demo-v4" },
    "-created_date",
    1,
  );
  const guidance = await base44.asServiceRole.entities.Guidance.filter(
    { policy_id: policy.id },
    "-created_date",
    20,
  );
  if (!version || guidance.length < 3) {
    throw createSafeError("DEMO_BASELINE_NOT_FOUND");
  }
  return { guidance, policy, version };
}

async function seedIncident(
  base44: Base44Client,
  actorId: string,
  baseline: Baseline,
  plan: DemoIncidentPlan,
): Promise<IncidentResult> {
  const version = await ensureVersion(base44, actorId, plan);
  const clauses = await ensureClauses(base44, version.id, plan);
  const delta = await ensureDelta(base44, version.id, clauses, plan);
  const replay = await ensureReplayJob(base44, version.id, plan);
  const findings = await Promise.all(plan.findings.map((finding) =>
    ensureFinding(base44, replay.id, version.id, clauses, finding, plan)
  ));
  await ensureReviewTasks(base44, actorId, findings, plan);
  await activateIncident(base44, baseline, version);
  return {
    delta_id: delta.id,
    finding_ids: findings.map((finding) => finding.id),
    replay_job_id: replay.id,
    version_id: version.id,
  };
}

async function ensureVersion(
  base44: Base44Client,
  actorId: string,
  plan: DemoIncidentPlan,
): Promise<EntityRecord["PolicyVersion"]> {
  return createOrGet(
    () => findByDedupe(base44, "PolicyVersion", plan.version.dedupeKey),
    () => base44.asServiceRole.entities.PolicyVersion.create({
      content_hash: plan.version.contentHash,
      content_text: plan.version.contentText,
      created_by_event_id: `demo-incident:${actorId}`,
      dedupe_key: plan.version.dedupeKey,
      organization_id: plan.organizationId,
      policy_id: plan.policyId,
      source_file_id: plan.sourceFileId,
      source_revision: plan.version.sourceRevision,
      status: "active",
    }),
  );
}

function ensureClauses(
  base44: Base44Client,
  versionId: string,
  plan: DemoIncidentPlan,
): Promise<EntityRecord["PolicyClause"][]> {
  return Promise.all(plan.clauses.map((clause) =>
    createOrGet(
      () => findByDedupe(base44, "PolicyClause", clause.dedupeKey),
      () => base44.asServiceRole.entities.PolicyClause.create({
        body: clause.body,
        body_hash: clause.bodyHash,
        clause_key: clause.clauseKey,
        dedupe_key: clause.dedupeKey,
        heading: clause.heading,
        ordinal: clause.ordinal,
        organization_id: plan.organizationId,
        policy_version_id: versionId,
      }),
    )
  ));
}

async function ensureDelta(
  base44: Base44Client,
  versionId: string,
  clauses: EntityRecord["PolicyClause"][],
  plan: DemoIncidentPlan,
): Promise<EntityRecord["PolicyDelta"]> {
  const changedIds = clauses
    .filter((clause) =>
      plan.clauses.some((item) => item.changed && item.clauseKey === clause.clause_key)
    )
    .map((clause) => clause.id);
  return createOrGet(
    () => findByDedupe(base44, "PolicyDelta", plan.delta.dedupeKey),
    () => base44.asServiceRole.entities.PolicyDelta.create({
      changed_clause_ids: changedIds,
      dedupe_key: plan.delta.dedupeKey,
      materiality: "material",
      new_version_id: versionId,
      old_version_id: plan.oldVersionId,
      organization_id: plan.organizationId,
      policy_id: plan.policyId,
      summary: plan.delta.summary,
    }),
  );
}

function ensureReplayJob(
  base44: Base44Client,
  versionId: string,
  plan: DemoIncidentPlan,
): Promise<EntityRecord["ReplayJob"]> {
  return createOrGet(
    () => findByDedupe(base44, "ReplayJob", plan.replay.dedupeKey),
    () => base44.asServiceRole.entities.ReplayJob.create({
      attempt: 1,
      candidate_count: plan.replay.candidateCount,
      completed_count: plan.replay.candidateCount,
      dedupe_key: plan.replay.dedupeKey,
      new_version_id: versionId,
      old_version_id: plan.oldVersionId,
      organization_id: plan.organizationId,
      status: "completed",
    }),
  );
}

async function ensureFinding(
  base44: Base44Client,
  replayJobId: string,
  versionId: string,
  clauses: EntityRecord["PolicyClause"][],
  finding: DemoIncidentPlan["findings"][number],
  plan: DemoIncidentPlan,
): Promise<EntityRecord["Finding"]> {
  const item = await ensureReplayItem(base44, replayJobId, finding, plan);
  const evidenceIds = clauses
    .filter((clause) => finding.evidenceClauseKeys.includes(clause.clause_key))
    .map((clause) => clause.id);
  return createOrGet(
    () => findByDedupe(base44, "Finding", finding.dedupeKey),
    () => createFindingRecord(
      base44, item.id, versionId, evidenceIds, finding, plan,
    ),
  );
}

async function createFindingRecord(
  base44: Base44Client,
  replayItemId: string,
  versionId: string,
  evidenceIds: string[],
  finding: DemoIncidentPlan["findings"][number],
  plan: DemoIncidentPlan,
): Promise<EntityRecord["Finding"]> {
  return base44.asServiceRole.entities.Finding.create({
    classification: finding.classification,
    confidence: finding.confidence,
    correction_draft: finding.correctionDraft,
    dedupe_key: finding.dedupeKey,
    evidence_clause_ids: evidenceIds,
    guidance_id: finding.guidanceId,
    model_name: "deterministic-demo-fixture",
    model_output_hash: await sha256Hex(JSON.stringify(finding)),
    new_version_id: versionId,
    old_version_id: plan.oldVersionId,
    organization_id: plan.organizationId,
    rationale: finding.rationale,
    replay_item_id: replayItemId,
    status: "pending_review",
  });
}

function ensureReplayItem(
  base44: Base44Client,
  replayJobId: string,
  finding: DemoIncidentPlan["findings"][number],
  plan: DemoIncidentPlan,
): Promise<EntityRecord["ReplayItem"]> {
  const dedupeKey = `${replayJobId}:${finding.guidanceId}`;
  return createOrGet(
    () => findByDedupe(base44, "ReplayItem", dedupeKey),
    () => base44.asServiceRole.entities.ReplayItem.create({
      dedupe_key: dedupeKey,
      guidance_id: finding.guidanceId,
      match_reasons: finding.evidenceClauseKeys.length > 0
        ? ["version", "audience", "date", "clause"]
        : ["version", "audience", "date"],
      organization_id: plan.organizationId,
      replay_job_id: replayJobId,
      status: "completed",
    }),
  );
}

async function ensureReviewTasks(
  base44: Base44Client,
  actorId: string,
  findings: EntityRecord["Finding"][],
  plan: DemoIncidentPlan,
): Promise<void> {
  const uncertain = findings.find((finding) => finding.classification === "uncertain");
  if (!uncertain) return;
  const dedupeKey = `${uncertain.id}:demo-review-task`;
  await createOrGet(
    () => findByDedupe(base44, "ReviewTask", dedupeKey),
    () => base44.asServiceRole.entities.ReviewTask.create({
      created_by_kind: "system",
      created_by_user_id: actorId,
      dedupe_key: dedupeKey,
      finding_id: uncertain.id,
      note: "Confirm whether contractors are applicants under the revised age clause.",
      organization_id: plan.organizationId,
      status: "open",
    }),
  );
}

async function activateIncident(
  base44: Base44Client,
  baseline: Baseline,
  version: EntityRecord["PolicyVersion"],
): Promise<void> {
  await Promise.all([
    base44.asServiceRole.entities.PolicyVersion.update(
      baseline.version.id,
      { status: "compared" },
    ),
    base44.asServiceRole.entities.PolicyVersion.update(
      version.id,
      { status: "active" },
    ),
    base44.asServiceRole.entities.Policy.update(
      baseline.policy.id,
      { active_version_id: version.id },
    ),
  ]);
}

async function findByDedupe<Name extends keyof EntityRecord>(
  base44: Base44Client,
  name: Name,
  dedupeKey: string,
): Promise<EntityRecord[Name] | undefined> {
  const entity = base44.asServiceRole.entities[name] as unknown as {
    filter(
      query: { dedupe_key: string },
      sort: string,
      limit: number,
    ): Promise<EntityRecord[Name][]>;
  };
  const [record] = await entity.filter(
    { dedupe_key: dedupeKey },
    "-created_date",
    1,
  );
  return record;
}

async function createOrGet<T>(
  find: () => Promise<T | undefined>,
  create: () => Promise<T>,
): Promise<T> {
  const existing = await find();
  if (existing) return existing;
  try {
    return await create();
  } catch {
    const winner = await find();
    if (winner) return winner;
    throw createSafeError("DEMO_INCIDENT_CREATE_FAILED");
  }
}
