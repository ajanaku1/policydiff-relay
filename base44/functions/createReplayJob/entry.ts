import {
  createClientFromRequest,
  type Base44Client,
  type EntityRecord,
} from "@base44/sdk";

import { createSafeError } from "../../shared/base44-error.ts";
import { invokeFunction } from "../../shared/base44-invoke.ts";
import {
  readJsonObject,
  readResourceId,
  serveBase44Function,
} from "../../shared/base44-http.ts";
import {
  type GuidanceDependency,
  selectReplayCandidates,
} from "../../shared/policy-analysis.ts";

function toGuidanceDependency(
  guidance: EntityRecord["Guidance"],
): GuidanceDependency {
  return {
    audience: guidance.audience,
    citedClauseIds: guidance.cited_clause_ids,
    effectiveOn: guidance.effective_on,
    id: guidance.id,
    policyVersionId: guidance.policy_version_id,
  };
}

async function createOrGetJob(
  base44: Base44Client,
  delta: EntityRecord["PolicyDelta"],
): Promise<EntityRecord["ReplayJob"]> {
  const dedupeKey =
    `${delta.organization_id}:${delta.old_version_id}:${delta.new_version_id}`;
  const existing = await findReplayJob(base44, dedupeKey);
  if (existing) {
    return existing;
  }
  try {
    return await createReplayJob(base44, delta, dedupeKey);
  } catch (error) {
    const winner = await findReplayJob(base44, dedupeKey);
    if (!winner) {
      throw error;
    }
    return winner;
  }
}

function createReplayJob(
  base44: Base44Client,
  delta: EntityRecord["PolicyDelta"],
  dedupeKey: string,
): Promise<EntityRecord["ReplayJob"]> {
  return base44.asServiceRole.entities.ReplayJob.create({
    candidate_count: 0,
    completed_count: 0,
    dedupe_key: dedupeKey,
    new_version_id: delta.new_version_id,
    old_version_id: delta.old_version_id,
    organization_id: delta.organization_id,
    status: "pending",
  });
}

async function findReplayJob(
  base44: Base44Client,
  dedupeKey: string,
): Promise<EntityRecord["ReplayJob"] | undefined> {
  const [job] = await base44.asServiceRole.entities.ReplayJob.filter(
    { dedupe_key: dedupeKey },
    "-created_date",
    1,
  );
  return job;
}

async function persistReplayItem(
  base44: Base44Client,
  job: EntityRecord["ReplayJob"],
  guidanceId: string,
  reasons: string[],
): Promise<EntityRecord["ReplayItem"]> {
  const dedupeKey = `${job.id}:${guidanceId}`;
  const existing = await findReplayItem(base44, dedupeKey);
  if (existing) {
    return existing;
  }
  try {
    return await createReplayItem(base44, job, guidanceId, reasons, dedupeKey);
  } catch (error) {
    const winner = await findReplayItem(base44, dedupeKey);
    if (!winner) {
      throw error;
    }
    return winner;
  }
}

function createReplayItem(
  base44: Base44Client,
  job: EntityRecord["ReplayJob"],
  guidanceId: string,
  reasons: string[],
  dedupeKey: string,
): Promise<EntityRecord["ReplayItem"]> {
  return base44.asServiceRole.entities.ReplayItem.create({
    dedupe_key: dedupeKey,
    guidance_id: guidanceId,
    match_reasons: reasons,
    organization_id: job.organization_id,
    replay_job_id: job.id,
    status: "pending",
  });
}

async function findReplayItem(
  base44: Base44Client,
  dedupeKey: string,
): Promise<EntityRecord["ReplayItem"] | undefined> {
  const [item] = await base44.asServiceRole.entities.ReplayItem.filter(
    { dedupe_key: dedupeKey },
    "-created_date",
    1,
  );
  return item;
}

async function selectGuidance(
  base44: Base44Client,
  delta: EntityRecord["PolicyDelta"],
): Promise<ReturnType<typeof selectReplayCandidates>> {
  const guidance = await base44.asServiceRole.entities.Guidance.filter(
    {
      organization_id: delta.organization_id,
      policy_version_id: delta.old_version_id,
    },
    "effective_on",
    500,
  );
  const oldClauseIds = await loadOldChangedClauseIds(base44, delta);
  const dependencies = guidance.map(toGuidanceDependency);
  return selectReplayCandidates(dependencies, {
    allowedAudiences: [...new Set(dependencies.map((item) => item.audience))],
    changedOldClauseIds: oldClauseIds,
    effectiveThrough: new Date().toISOString().slice(0, 10),
    oldVersionId: delta.old_version_id,
  });
}

async function loadOldChangedClauseIds(
  base44: Base44Client,
  delta: EntityRecord["PolicyDelta"],
): Promise<string[]> {
  const clauses = await base44.asServiceRole.entities.PolicyClause.filter(
    {
      id: { $in: delta.changed_clause_ids },
      policy_version_id: delta.old_version_id,
    },
    "ordinal",
    500,
  );
  return clauses.map((clause) => clause.id);
}

serveBase44Function(async (request) => {
  const base44 = createClientFromRequest(request);
  const body = await readJsonObject(request);
  const newVersionId = readResourceId(body, "policy_version_id");
  const [delta] = await base44.asServiceRole.entities.PolicyDelta.filter(
    { new_version_id: newVersionId },
    "-created_date",
    1,
  );
  if (!delta) {
    throw createSafeError("POLICY_DELTA_NOT_FOUND");
  }
  const job = await createOrGetJob(base44, delta);
  const selected = await selectGuidance(base44, delta);
  const items = await Promise.all(
    selected.map((item) =>
      persistReplayItem(base44, job, item.guidance.id, item.reasons)
    ),
  );
  await base44.asServiceRole.entities.ReplayJob.update(job.id, {
    candidate_count: items.length,
    status: items.length > 0 ? "running" : "completed",
  });
  await Promise.all(
    items.map(({ id }) =>
      invokeFunction(
        base44.asServiceRole.functions,
        "replayGuidance",
        { replay_item_id: id },
      )
    ),
  );
  return Response.json({ job_id: job.id, replay_item_ids: items.map(({ id }) => id) });
});
