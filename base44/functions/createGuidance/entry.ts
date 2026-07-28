import {
  createClientFromRequest,
  type Base44Client,
  type EntityRecord,
} from "@base44/sdk";

import { createSafeError } from "../../shared/base44-error.ts";
import {
  buildWorkflowActor,
  readJsonObject,
  readRequiredString,
  readStringArray,
  serveBase44Function,
} from "../../shared/base44-http.ts";
import type { WorkflowActor } from "../../shared/workflow.ts";

async function loadActivePolicy(
  base44: Base44Client,
  actor: WorkflowActor,
  policyId: string,
): Promise<EntityRecord["Policy"] & { active_version_id: string }> {
  const policy = await base44.asServiceRole.entities.Policy.get(policyId);
  if (
    policy.organization_id !== actor.organizationId ||
    !policy.active_version_id
  ) {
    throw createSafeError("ACTIVE_POLICY_NOT_FOUND");
  }
  return policy as EntityRecord["Policy"] & { active_version_id: string };
}

async function assertValidCitations(
  base44: Base44Client,
  actor: WorkflowActor,
  policy: EntityRecord["Policy"] & { active_version_id: string },
  citedClauseIds: string[],
): Promise<void> {
  const clauses = await base44.asServiceRole.entities.PolicyClause.filter(
    { id: { $in: citedClauseIds } },
    "ordinal",
    citedClauseIds.length,
  );
  const citationsValid =
    clauses.length === new Set(citedClauseIds).size &&
    clauses.every((clause) =>
      clause.organization_id === actor.organizationId &&
      clause.policy_version_id === policy.active_version_id
    );
  if (!citationsValid) {
    throw createSafeError("GUIDANCE_CITATION_INVALID");
  }
}

async function createGuidance(
  base44: Base44Client,
  actor: WorkflowActor,
  body: Record<string, unknown>,
): Promise<EntityRecord["Guidance"]> {
  const policy = await loadActivePolicy(
    base44,
    actor,
    readRequiredString(body, "policy_id"),
  );
  const citedClauseIds = readStringArray(body, "cited_clause_ids");
  await assertValidCitations(base44, actor, policy, citedClauseIds);
  return base44.asServiceRole.entities.Guidance.create({
    answer: readRequiredString(body, "answer"),
    audience: readRequiredString(body, "audience"),
    cited_clause_ids: citedClauseIds,
    effective_on: readRequiredString(body, "effective_on"),
    organization_id: actor.organizationId,
    policy_id: policy.id,
    policy_version_id: policy.active_version_id,
    question: readRequiredString(body, "question"),
    recipient_email: readRequiredString(body, "recipient_email"),
    recipient_name: typeof body.recipient_name === "string"
      ? body.recipient_name.trim()
      : "",
  });
}

serveBase44Function(async (request) => {
  const base44 = createClientFromRequest(request);
  const actor = buildWorkflowActor(await base44.auth.me());
  const body = await readJsonObject(request);
  const guidance = await createGuidance(base44, actor, body);
  return Response.json(guidance, { status: 201 });
});
