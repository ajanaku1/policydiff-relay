import {
  createClientFromRequest,
  type Base44Client,
  type EntityRecord,
} from "@base44/sdk";

import { createSafeError } from "../../shared/base44-error.ts";
import {
  readJsonObject,
  readRequiredString,
  serveBase44Function,
} from "../../shared/base44-http.ts";
import { resolveDemoAdmin } from "../../shared/demo-admin.ts";
import {
  buildDemoSeedPlan,
  type DemoClausePlan,
  type DemoGuidancePlan,
  type DemoSeedPlan,
} from "../../shared/demo-seed.ts";
import { sha256Hex } from "../../shared/ingestion.ts";

interface SeedResult {
  guidance_ids: string[];
  policy_id: string;
  version_id: string;
}

serveBase44Function(async (request) => {
  const base44 = createClientFromRequest(request);
  const user = await base44.auth.me();
  const resolution = resolveDemoAdmin(user);
  if (resolution.profileUpdate) {
    await base44.asServiceRole.entities.User.update(
      resolution.actor.id,
      resolution.profileUpdate,
    );
  }
  const body = await readJsonObject(request);
  const plan = await buildDemoSeedPlan(
    resolution.actor,
    readRequiredString(body, "source_file_id"),
    readRequiredString(body, "recipient_email"),
  );
  const result = await seedWorkspace(base44, resolution.actor.id, plan);
  return Response.json(result);
});

async function seedWorkspace(
  base44: Base44Client,
  actorId: string,
  plan: DemoSeedPlan,
): Promise<SeedResult> {
  await ensureOrganization(base44, plan);
  const policy = await ensurePolicy(base44, plan);
  const version = await ensureVersion(base44, actorId, policy.id, plan);
  const clauses = await ensureClauses(base44, version.id, plan);
  await activateBaseline(base44, policy, version);
  const guidance = await ensureGuidance(base44, policy.id, version.id, clauses, plan);
  return {
    guidance_ids: guidance.map((item) => item.id),
    policy_id: policy.id,
    version_id: version.id,
  };
}

async function ensureOrganization(
  base44: Base44Client,
  plan: DemoSeedPlan,
): Promise<EntityRecord["Organization"]> {
  const find = async () => {
    const [organization] =
      await base44.asServiceRole.entities.Organization.filter(
        { organization_id: plan.organization.id },
        "-created_date",
        1,
      );
    return organization;
  };
  return createOrGet(find, () =>
    base44.asServiceRole.entities.Organization.create({
      name: plan.organization.name,
      organization_id: plan.organization.id,
      slug: plan.organization.slug,
    })
  );
}

async function ensurePolicy(
  base44: Base44Client,
  plan: DemoSeedPlan,
): Promise<EntityRecord["Policy"]> {
  const find = async () => {
    const [policy] = await base44.asServiceRole.entities.Policy.filter(
      { dedupe_key: plan.policy.dedupeKey },
      "-created_date",
      1,
    );
    return policy;
  };
  const policy = await createOrGet(find, () =>
    base44.asServiceRole.entities.Policy.create({
      dedupe_key: plan.policy.dedupeKey,
      name: plan.policy.name,
      organization_id: plan.organization.id,
      source_file_id: plan.policy.sourceFileId,
    })
  );
  assertMatchingSource(policy, plan.policy.sourceFileId);
  return policy;
}

function assertMatchingSource(
  policy: EntityRecord["Policy"],
  sourceFileId: string,
): void {
  if (policy.source_file_id !== sourceFileId) {
    throw createSafeError("DEMO_SOURCE_FILE_CONFLICT");
  }
}

async function ensureVersion(
  base44: Base44Client,
  actorId: string,
  policyId: string,
  plan: DemoSeedPlan,
): Promise<EntityRecord["PolicyVersion"]> {
  const find = async () => {
    const [version] = await base44.asServiceRole.entities.PolicyVersion.filter(
      { dedupe_key: plan.version.dedupeKey },
      "-created_date",
      1,
    );
    return version;
  };
  return createOrGet(find, () =>
    base44.asServiceRole.entities.PolicyVersion.create({
      content_hash: plan.version.contentHash,
      content_text: plan.version.contentText,
      created_by_event_id: `demo-seed:${actorId}`,
      dedupe_key: plan.version.dedupeKey,
      organization_id: plan.organization.id,
      policy_id: policyId,
      source_file_id: plan.policy.sourceFileId,
      source_revision: plan.version.sourceRevision,
      status: "active",
    })
  );
}

async function ensureClauses(
  base44: Base44Client,
  versionId: string,
  plan: DemoSeedPlan,
): Promise<EntityRecord["PolicyClause"][]> {
  return Promise.all(
    plan.clauses.map((clause) =>
      ensureClause(base44, plan.organization.id, versionId, clause)
    ),
  );
}

async function ensureClause(
  base44: Base44Client,
  organizationId: string,
  versionId: string,
  clause: DemoClausePlan,
): Promise<EntityRecord["PolicyClause"]> {
  const find = async () => {
    const [record] = await base44.asServiceRole.entities.PolicyClause.filter(
      { dedupe_key: clause.dedupeKey },
      "ordinal",
      1,
    );
    return record;
  };
  return createOrGet(find, async () =>
    base44.asServiceRole.entities.PolicyClause.create({
      body: clause.body,
      body_hash: await sha256Hex(clause.body),
      clause_key: clause.clauseKey,
      dedupe_key: clause.dedupeKey,
      heading: clause.heading,
      ordinal: clause.ordinal,
      organization_id: organizationId,
      policy_version_id: versionId,
    })
  );
}

async function activateBaseline(
  base44: Base44Client,
  policy: EntityRecord["Policy"],
  version: EntityRecord["PolicyVersion"],
): Promise<void> {
  if (policy.active_version_id === version.id) return;
  if (policy.active_version_id) {
    throw createSafeError("DEMO_POLICY_ALREADY_ACTIVE");
  }
  await base44.asServiceRole.entities.Policy.update(policy.id, {
    active_version_id: version.id,
  });
}

async function ensureGuidance(
  base44: Base44Client,
  policyId: string,
  versionId: string,
  clauses: EntityRecord["PolicyClause"][],
  plan: DemoSeedPlan,
): Promise<EntityRecord["Guidance"][]> {
  const clauseIds = new Map(clauses.map((clause) => [clause.clause_key, clause.id]));
  const create = (guidance: DemoGuidancePlan) =>
    ensureGuidanceRecord(
      base44,
      plan.organization.id,
      policyId,
      versionId,
      clauseIds,
      guidance,
    );
  return Promise.all(plan.guidance.map(create));
}

async function ensureGuidanceRecord(
  base44: Base44Client,
  organizationId: string,
  policyId: string,
  versionId: string,
  clauseIds: Map<string, string>,
  guidance: DemoGuidancePlan,
): Promise<EntityRecord["Guidance"]> {
  const find = async () => {
    const [record] = await base44.asServiceRole.entities.Guidance.filter(
      { policy_version_id: versionId, question: guidance.question },
      "-created_date",
      1,
    );
    return record;
  };
  return createOrGet(find, () =>
    createGuidanceRecord(
      base44,
      organizationId,
      policyId,
      versionId,
      resolveClauseIds(clauseIds, guidance.citedClauseKeys),
      guidance,
    )
  );
}

function createGuidanceRecord(
  base44: Base44Client,
  organizationId: string,
  policyId: string,
  versionId: string,
  citedClauseIds: string[],
  guidance: DemoGuidancePlan,
): Promise<EntityRecord["Guidance"]> {
  return base44.asServiceRole.entities.Guidance.create({
    answer: guidance.answer,
    audience: guidance.audience,
    cited_clause_ids: citedClauseIds,
    effective_on: guidance.effectiveOn,
    organization_id: organizationId,
    policy_id: policyId,
    policy_version_id: versionId,
    question: guidance.question,
    recipient_email: guidance.recipientEmail,
    recipient_name: guidance.recipientName,
  });
}

function resolveClauseIds(
  clauses: Map<string, string>,
  keys: string[],
): string[] {
  return keys.map((key) => {
    const id = clauses.get(key);
    if (!id) throw createSafeError("DEMO_CLAUSE_MISSING");
    return id;
  });
}

async function createOrGet<T>(
  find: () => Promise<T | undefined>,
  create: () => Promise<T>,
): Promise<T> {
  const existing = await find();
  if (existing) return existing;
  try {
    return await create();
  } catch (error) {
    const winner = await find();
    if (winner) return winner;
    throw error;
  }
}
