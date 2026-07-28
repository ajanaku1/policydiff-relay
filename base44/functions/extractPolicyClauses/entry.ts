import {
  createClientFromRequest,
  type Base44Client,
  type EntityRecord,
} from "@base44/sdk";

import { invokeFunction } from "../../shared/base44-invoke.ts";
import {
  readJsonObject,
  readResourceId,
  serveBase44Function,
} from "../../shared/base44-http.ts";
import { sha256Hex } from "../../shared/ingestion.ts";
import {
  type ClauseCandidate,
  validateClauseCandidates,
} from "../../shared/policy-analysis.ts";

const CLAUSE_SCHEMA = {
  type: "object",
  properties: {
    clauses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          clause_key: { type: "string" },
          heading: { type: "string" },
          body: { type: "string" },
        },
        required: ["clause_key", "heading", "body"],
        additionalProperties: false,
      },
    },
  },
  required: ["clauses"],
  additionalProperties: false,
};

async function extractCandidates(
  base44: Base44Client,
  contentText: string,
): Promise<ClauseCandidate[]> {
  const output =
    await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: "gpt_5_mini",
      prompt:
        "Extract the policy into stable, ordered clauses. Preserve exact meaning. " +
        "Use durable lowercase clause keys. Return only the requested structure.\n\n" +
        contentText,
      response_json_schema: CLAUSE_SCHEMA,
    });
  return validateClauseCandidates(output);
}

async function persistClause(
  base44: Base44Client,
  version: EntityRecord["PolicyVersion"],
  clause: ClauseCandidate,
  ordinal: number,
): Promise<EntityRecord["PolicyClause"]> {
  const dedupeKey = `${version.id}:${clause.clauseKey}`;
  const existing = await findClause(base44, dedupeKey);
  if (existing) {
    return existing;
  }
  try {
    return await createClause(base44, version, clause, ordinal, dedupeKey);
  } catch (error) {
    const winner = await findClause(base44, dedupeKey);
    if (!winner) {
      throw error;
    }
    return winner;
  }
}

async function createClause(
  base44: Base44Client,
  version: EntityRecord["PolicyVersion"],
  clause: ClauseCandidate,
  ordinal: number,
  dedupeKey: string,
): Promise<EntityRecord["PolicyClause"]> {
  return base44.asServiceRole.entities.PolicyClause.create({
    body: clause.body,
    body_hash: await sha256Hex(clause.body),
    clause_key: clause.clauseKey,
    dedupe_key: dedupeKey,
    heading: clause.heading,
    ordinal,
    organization_id: version.organization_id,
    policy_version_id: version.id,
  });
}

async function findClause(
  base44: Base44Client,
  dedupeKey: string,
): Promise<EntityRecord["PolicyClause"] | undefined> {
  const [clause] = await base44.asServiceRole.entities.PolicyClause.filter(
    { dedupe_key: dedupeKey },
    "-created_date",
    1,
  );
  return clause;
}

serveBase44Function(async (request) => {
  const base44 = createClientFromRequest(request);
  const body = await readJsonObject(request);
  const versionId = readResourceId(body, "policy_version_id");
  const version =
    await base44.asServiceRole.entities.PolicyVersion.get(versionId);
  const candidates = await extractCandidates(base44, version.content_text);
  const clauses = await Promise.all(
    candidates.map((clause, ordinal) =>
      persistClause(base44, version, clause, ordinal)
    ),
  );
  await base44.asServiceRole.entities.PolicyVersion.update(version.id, {
    status: "extracted",
  });
  await invokeFunction(
    base44.asServiceRole.functions,
    "comparePolicyVersions",
    { policy_version_id: version.id },
  );
  return Response.json({ clauses, version_id: version.id });
});
