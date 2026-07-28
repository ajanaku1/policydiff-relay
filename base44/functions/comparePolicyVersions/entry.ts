import {
  createClientFromRequest,
  type Base44Client,
  type EntityRecord,
} from "@base44/sdk";

import { createSafeError } from "../../shared/base44-error.ts";
import {
  readJsonObject,
  readResourceId,
  serveBase44Function,
} from "../../shared/base44-http.ts";
import {
  type PolicyDeltaCandidate,
  type PolicyClause,
  compareClauseSets,
} from "../../shared/policy-analysis.ts";

function toPolicyClause(clause: EntityRecord["PolicyClause"]): PolicyClause {
  return {
    body: clause.body,
    bodyHash: clause.body_hash,
    clauseKey: clause.clause_key,
    heading: clause.heading,
    id: clause.id,
    versionId: clause.policy_version_id,
  };
}

async function loadClauses(
  base44: Base44Client,
  versionId: string,
): Promise<PolicyClause[]> {
  const clauses = await base44.asServiceRole.entities.PolicyClause.filter(
    { policy_version_id: versionId },
    "ordinal",
    500,
  );
  return clauses.map(toPolicyClause);
}

async function createOrGetDelta(
  base44: Base44Client,
  policy: EntityRecord["Policy"],
  oldVersionId: string,
  newVersionId: string,
): Promise<EntityRecord["PolicyDelta"]> {
  const dedupeKey = `${oldVersionId}:${newVersionId}`;
  const existing = await findDelta(base44, dedupeKey);
  if (existing) {
    return existing;
  }
  const oldClauses = await loadClauses(base44, oldVersionId);
  const newClauses = await loadClauses(base44, newVersionId);
  const delta = compareClauseSets(
    oldVersionId,
    newVersionId,
    oldClauses,
    newClauses,
  );
  try {
    return await persistDelta(base44, policy, dedupeKey, delta);
  } catch (error) {
    const winner = await findDelta(base44, dedupeKey);
    if (!winner) {
      throw error;
    }
    return winner;
  }
}

async function findDelta(
  base44: Base44Client,
  dedupeKey: string,
): Promise<EntityRecord["PolicyDelta"] | undefined> {
  const [delta] = await base44.asServiceRole.entities.PolicyDelta.filter(
    { dedupe_key: dedupeKey },
    "-created_date",
    1,
  );
  return delta;
}

function persistDelta(
  base44: Base44Client,
  policy: EntityRecord["Policy"],
  dedupeKey: string,
  delta: PolicyDeltaCandidate,
): Promise<EntityRecord["PolicyDelta"]> {
  return base44.asServiceRole.entities.PolicyDelta.create({
    changed_clause_ids: changedClauseIds(delta),
    dedupe_key: dedupeKey,
    materiality: delta.materiality,
    new_version_id: delta.newVersionId,
    old_version_id: delta.oldVersionId,
    organization_id: policy.organization_id,
    policy_id: policy.id,
    summary: `${delta.changedClauses.length} clause change(s) detected.`,
  });
}

function changedClauseIds(delta: PolicyDeltaCandidate): string[] {
  return delta.changedClauses.flatMap((change) =>
    [change.oldClauseId, change.newClauseId].filter(
      (id): id is string => id !== undefined,
    )
  );
}

serveBase44Function(async (request) => {
  const base44 = createClientFromRequest(request);
  const body = await readJsonObject(request);
  const newVersionId = readResourceId(body, "policy_version_id");
  const version =
    await base44.asServiceRole.entities.PolicyVersion.get(newVersionId);
  const policy = await base44.asServiceRole.entities.Policy.get(
    version.policy_id,
  );
  if (!policy.active_version_id) {
    throw createSafeError("POLICY_HAS_NO_ACTIVE_VERSION");
  }
  const delta = await createOrGetDelta(
    base44,
    policy,
    policy.active_version_id,
    version.id,
  );
  await base44.asServiceRole.entities.PolicyVersion.update(version.id, {
    status: "compared",
  });
  return Response.json(delta);
});
