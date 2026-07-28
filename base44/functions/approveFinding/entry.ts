import {
  createClientFromRequest,
  type Base44Client,
  type EntityRecord,
} from "@base44/sdk";

import {
  buildWorkflowActor,
  readJsonObject,
  readRequiredString,
  serveBase44Function,
} from "../../shared/base44-http.ts";
import {
  type ApprovalRecord,
  type ApprovalRepository,
  type ApprovalRevisionInput,
  approveFinding,
} from "../../shared/workflow.ts";

class Base44Approvals implements ApprovalRepository {
  constructor(private readonly base44: Base44Client) {}

  async approveRevision(
    input: ApprovalRevisionInput,
  ): Promise<ApprovalRecord | undefined> {
    const dedupeKey =
      `${input.findingId}:${input.correctionRevision}:approved`;
    const existing = await this.findByDedupeKey(dedupeKey);
    if (existing) {
      return toApprovalRecord(existing);
    }
    if (!await this.claimFinding(input)) {
      return undefined;
    }
    try {
      return toApprovalRecord(await this.create(input, dedupeKey));
    } catch (error) {
      const winner = await this.findByDedupeKey(dedupeKey);
      if (winner) {
        return toApprovalRecord(winner);
      }
      if (input.correctionRevision === 1) {
        await this.releaseFinding(input.findingId);
      }
      throw error;
    }
  }

  private async claimFinding(input: {
    correctionRevision: number;
    findingId: string;
    organizationId: string;
  }): Promise<boolean> {
    const expectedStatus =
      input.correctionRevision === 1 ? "pending_review" : "approved";
    const result = await this.base44.asServiceRole.entities.Finding.updateMany(
      {
        id: input.findingId,
        organization_id: input.organizationId,
        status: expectedStatus,
      },
      { $set: { status: "approved" } },
    );
    return result.updated === 1;
  }

  private create(
    input: ApprovalRevisionInput,
    dedupeKey: string,
  ): Promise<EntityRecord["Approval"]> {
    return this.base44.asServiceRole.entities.Approval.create({
      correction_revision: input.correctionRevision,
      correction_text: input.correctionText,
      decision: "approved",
      dedupe_key: dedupeKey,
      finding_id: input.findingId,
      organization_id: input.organizationId,
      reviewer_id: input.reviewerId,
    });
  }

  private async releaseFinding(findingId: string): Promise<void> {
    await this.base44.asServiceRole.entities.Finding.updateMany(
      { id: findingId, status: "approved" },
      { $set: { status: "pending_review" } },
    );
  }

  async findLatest(
    findingId: string,
    organizationId: string,
  ): Promise<ApprovalRecord | undefined> {
    const [approval] =
      await this.base44.asServiceRole.entities.Approval.filter(
        { finding_id: findingId, organization_id: organizationId },
        "-correction_revision",
        1,
      );
    return approval ? toApprovalRecord(approval) : undefined;
  }

  private async findByDedupeKey(
    dedupeKey: string,
  ): Promise<EntityRecord["Approval"] | undefined> {
    const [approval] =
      await this.base44.asServiceRole.entities.Approval.filter(
        { dedupe_key: dedupeKey },
        "-created_date",
        1,
      );
    return approval;
  }
}

function toApprovalRecord(
  approval: EntityRecord["Approval"],
): ApprovalRecord {
  return {
    correctionRevision: approval.correction_revision,
    correctionText: approval.correction_text ?? "",
    decision: approval.decision,
    findingId: approval.finding_id,
    id: approval.id,
    organizationId: approval.organization_id,
    reviewerId: approval.reviewer_id,
  };
}

async function createOrGetDelivery(
  base44: Base44Client,
  approval: ApprovalRecord,
  guidanceId: string,
): Promise<EntityRecord["Delivery"]> {
  const idempotencyKey = `${approval.id}:${guidanceId}:${approval.correctionRevision}`;
  const existing = await findDelivery(base44, idempotencyKey);
  if (existing) {
    return existing;
  }
  try {
    return await base44.asServiceRole.entities.Delivery.create({
      approval_id: approval.id,
      attempt: 0,
      correction_revision: approval.correctionRevision,
      guidance_id: guidanceId,
      idempotency_key: idempotencyKey,
      organization_id: approval.organizationId,
      status: "queued",
    });
  } catch (error) {
    const winner = await findDelivery(base44, idempotencyKey);
    if (!winner) {
      throw error;
    }
    return winner;
  }
}

async function findDelivery(
  base44: Base44Client,
  idempotencyKey: string,
): Promise<EntityRecord["Delivery"] | undefined> {
  const [delivery] = await base44.asServiceRole.entities.Delivery.filter(
    { idempotency_key: idempotencyKey },
    "-created_date",
    1,
  );
  return delivery;
}

serveBase44Function(async (request) => {
  const base44 = createClientFromRequest(request);
  const actor = buildWorkflowActor(await base44.auth.me());
  const body = await readJsonObject(request);
  const findingId = readRequiredString(body, "finding_id");
  const finding =
    await base44.asServiceRole.entities.Finding.get(findingId);
  const approval = await approveFinding(
    {
      actor,
      correctionText: readRequiredString(body, "correction_text"),
      findingId,
      findingOrganizationId: finding.organization_id,
    },
    new Base44Approvals(base44),
  );
  const delivery = await createOrGetDelivery(
    base44,
    approval,
    finding.guidance_id,
  );
  return Response.json({ approval, delivery_id: delivery.id });
});
