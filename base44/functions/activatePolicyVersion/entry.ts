import {
  createClientFromRequest,
  type Base44Client,
  type EntityRecord,
} from "@base44/sdk";

import { createSafeError } from "../../shared/base44-error.ts";
import { invokeFunction } from "../../shared/base44-invoke.ts";
import {
  buildWorkflowActor,
  readJsonObject,
  readRequiredString,
  serveBase44Function,
} from "../../shared/base44-http.ts";
import type { WorkflowActor } from "../../shared/workflow.ts";

function assertActivatable(
  actor: WorkflowActor,
  policy: EntityRecord["Policy"],
  version: EntityRecord["PolicyVersion"],
): asserts policy is EntityRecord["Policy"] & { active_version_id: string } {
  if (actor.policyRole !== "policy_admin") {
    throw createSafeError("POLICY_ADMIN_REQUIRED");
  }
  if (version.organization_id !== actor.organizationId) {
    throw createSafeError("ORGANIZATION_MISMATCH");
  }
  if (version.status !== "compared" || !policy.active_version_id) {
    throw createSafeError("VERSION_NOT_ACTIVATABLE");
  }
}

async function activateVersion(
  base44: Base44Client,
  actor: WorkflowActor,
  versionId: string,
): Promise<{ policy_id: string; version_id: string }> {
  const version = await base44.entities.PolicyVersion.get(versionId);
  const policy = await base44.entities.Policy.get(version.policy_id);
  assertActivatable(actor, policy, version);
  const updated = await base44.asServiceRole.entities.Policy.updateMany(
    { active_version_id: policy.active_version_id, id: policy.id },
    { $set: { active_version_id: version.id } },
  );
  if (updated.updated !== 1) {
    throw createSafeError("ACTIVE_VERSION_CONFLICT");
  }
  await base44.asServiceRole.entities.PolicyVersion.update(version.id, {
    status: "active",
  });
  await invokeFunction(
    base44.asServiceRole.functions,
    "createReplayJob",
    { policy_version_id: version.id },
  );
  return { policy_id: policy.id, version_id: version.id };
}

serveBase44Function(async (request) => {
  const base44 = createClientFromRequest(request);
  const actor = buildWorkflowActor(await base44.auth.me());
  const body = await readJsonObject(request);
  const result = await activateVersion(
    base44,
    actor,
    readRequiredString(body, "policy_version_id"),
  );
  return Response.json(result);
});
