import {
  createClientFromRequest,
  type Base44Client,
  type EntityRecord,
} from "@base44/sdk";

import {
  readJsonObject,
  readResourceId,
  serveBase44Function,
} from "../../shared/base44-http.ts";
import { sha256Hex } from "../../shared/ingestion.ts";
import { validateReplayCandidate } from "../../shared/policy-analysis.ts";

const REPLAY_SCHEMA = {
  type: "object",
  properties: {
    classification: {
      type: "string",
      enum: ["affected", "still_valid", "uncertain"],
    },
    evidence_clause_ids: { type: "array", items: { type: "string" } },
    old_version_id: { type: "string" },
    new_version_id: { type: "string" },
    rationale: { type: "string" },
    correction_draft: { type: "string" },
  },
  required: [
    "classification",
    "evidence_clause_ids",
    "old_version_id",
    "new_version_id",
    "rationale",
    "correction_draft",
  ],
  additionalProperties: false,
};

async function invokeReplayModel(
  base44: Base44Client,
  guidance: EntityRecord["Guidance"],
  job: EntityRecord["ReplayJob"],
  clauses: EntityRecord["PolicyClause"][],
): Promise<unknown> {
  return base44.asServiceRole.integrations.Core.InvokeLLM({
    model: "gpt_5_mini",
    prompt: JSON.stringify({
      instruction:
        "Classify whether the prior guidance remains safe under the new policy. " +
        "Use only supplied evidence; uncertainty must remain uncertain.",
      guidance: {
        answer: guidance.answer,
        question: guidance.question,
      },
      new_version_id: job.new_version_id,
      old_version_id: job.old_version_id,
      policy_clauses: clauses.map(({ body, heading, id, policy_version_id }) => ({
        body,
        heading,
        id,
        policy_version_id,
      })),
    }),
    response_json_schema: REPLAY_SCHEMA,
  });
}

async function finishReplayItem(
  base44: Base44Client,
  item: EntityRecord["ReplayItem"],
): Promise<void> {
  await base44.asServiceRole.entities.ReplayItem.update(item.id, {
    status: "completed",
  });
  const pending = await base44.asServiceRole.entities.ReplayItem.filter(
    { replay_job_id: item.replay_job_id, status: ["pending", "running"] },
    "-created_date",
    1,
  );
  const completed = await base44.asServiceRole.entities.ReplayItem.filter(
    { replay_job_id: item.replay_job_id, status: "completed" },
    "-created_date",
    500,
  );
  await base44.asServiceRole.entities.ReplayJob.update(item.replay_job_id, {
    completed_count: completed.length,
    status: pending.length === 0 ? "completed" : "running",
  });
}

type ReplayContext = {
  clauses: EntityRecord["PolicyClause"][];
  guidance: EntityRecord["Guidance"];
  item: EntityRecord["ReplayItem"];
  job: EntityRecord["ReplayJob"];
};

async function loadReplayContext(
  base44: Base44Client,
  itemId: string,
): Promise<ReplayContext> {
  const item = await base44.asServiceRole.entities.ReplayItem.get(itemId);
  const job = await base44.asServiceRole.entities.ReplayJob.get(
    item.replay_job_id,
  );
  const guidance = await base44.asServiceRole.entities.Guidance.get(
    item.guidance_id,
  );
  const clauses = await base44.asServiceRole.entities.PolicyClause.filter(
    { policy_version_id: [job.old_version_id, job.new_version_id] },
    "ordinal",
    500,
  );
  return { clauses, guidance, item, job };
}

async function createFinding(
  base44: Base44Client,
  context: ReplayContext,
  output: unknown,
): Promise<EntityRecord["Finding"]> {
  const { clauses, guidance, item, job } = context;
  const candidate = validateReplayCandidate(output, {
    allowedEvidenceClauseIds: clauses.map(({ id }) => id),
    newVersionId: job.new_version_id,
    oldVersionId: job.old_version_id,
  });
  return base44.asServiceRole.entities.Finding.create({
    classification: candidate.classification,
    correction_draft: readCorrectionDraft(output),
    dedupe_key: item.id,
    evidence_clause_ids: candidate.evidenceClauseIds,
    guidance_id: guidance.id,
    model_name: "gpt_5_mini",
    model_output_hash: await sha256Hex(JSON.stringify(output)),
    new_version_id: job.new_version_id,
    old_version_id: job.old_version_id,
    organization_id: item.organization_id,
    rationale: candidate.rationale,
    replay_item_id: item.id,
    status: "pending_review",
  });
}

function readCorrectionDraft(output: unknown): string {
  if (
    output &&
    typeof output === "object" &&
    "correction_draft" in output &&
    typeof output.correction_draft === "string"
  ) {
    return output.correction_draft;
  }
  return "";
}

async function processReplay(
  base44: Base44Client,
  itemId: string,
): Promise<EntityRecord["Finding"]> {
  const [existing] = await base44.asServiceRole.entities.Finding.filter(
    { dedupe_key: itemId },
    "-created_date",
    1,
  );
  if (existing) {
    return existing;
  }
  const context = await loadReplayContext(base44, itemId);
  const output = await invokeReplayModel(
    base44,
    context.guidance,
    context.job,
    context.clauses,
  );
  const finding = await createFindingOrReadWinner(base44, context, output);
  await finishReplayItem(base44, context.item);
  return finding;
}

async function createFindingOrReadWinner(
  base44: Base44Client,
  context: ReplayContext,
  output: unknown,
): Promise<EntityRecord["Finding"]> {
  try {
    return await createFinding(base44, context, output);
  } catch (error) {
    const [winner] = await base44.asServiceRole.entities.Finding.filter(
      { dedupe_key: context.item.id },
      "-created_date",
      1,
    );
    if (!winner) {
      throw error;
    }
    return winner;
  }
}

serveBase44Function(async (request) => {
  const base44 = createClientFromRequest(request);
  const body = await readJsonObject(request);
  const finding = await processReplay(
    base44,
    readResourceId(body, "replay_item_id"),
  );
  return Response.json(finding);
});
