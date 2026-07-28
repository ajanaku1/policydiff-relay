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
  readRuntimeSecret,
  serveBase44Function,
} from "../../shared/base44-http.ts";
import { createDeliveryToken } from "../../shared/delivery-token.ts";
import {
  AmbiguousSendError,
  type ApprovedCorrection,
  type ClaimResult,
  type CorrectionSender,
  type DeliveryClaimRepository,
} from "../../shared/delivery.ts";
import { buildGmailSendRequest } from "../../shared/google-api.ts";
import { sha256Hex } from "../../shared/ingestion.ts";
import {
  type ApprovedDeliveryAggregate,
  type ApprovedDeliveryRepository,
  sendValidatedCorrection,
} from "../../shared/workflow.ts";

class Base44ApprovedDelivery implements ApprovedDeliveryRepository {
  constructor(private readonly base44: Base44Client) {}

  async load(deliveryId: string): Promise<ApprovedDeliveryAggregate> {
    const delivery =
      await this.base44.asServiceRole.entities.Delivery.get(deliveryId);
    const approval = await this.base44.asServiceRole.entities.Approval.get(
      delivery.approval_id,
    );
    const finding = await this.base44.asServiceRole.entities.Finding.get(
      approval.finding_id,
    );
    const guidance = await this.base44.asServiceRole.entities.Guidance.get(
      delivery.guidance_id,
    );
    if (
      delivery.status !== "queued" &&
      delivery.status !== "retry_wait" &&
      delivery.status !== "sent"
    ) {
      throw createSafeError("DELIVERY_NOT_SENDABLE");
    }
    return toApprovedAggregate(delivery, approval, finding, guidance);
  }
}

function toApprovedAggregate(
  delivery: EntityRecord["Delivery"],
  approval: EntityRecord["Approval"],
  finding: EntityRecord["Finding"],
  guidance: EntityRecord["Guidance"],
): ApprovedDeliveryAggregate {
  return {
    approval: toWorkflowApproval(approval),
    delivery: toWorkflowDelivery(delivery),
    finding: toWorkflowFinding(finding),
    recipient: { email: guidance.recipient_email },
  };
}

function toWorkflowApproval(
  approval: EntityRecord["Approval"],
): ApprovedDeliveryAggregate["approval"] {
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

function toWorkflowDelivery(
  delivery: EntityRecord["Delivery"],
): ApprovedDeliveryAggregate["delivery"] {
  return {
    approvalId: delivery.approval_id,
    correctionRevision: delivery.correction_revision,
    id: delivery.id,
    idempotencyKey: delivery.idempotency_key,
    organizationId: delivery.organization_id,
    status: assertSendableStatus(delivery.status),
  };
}

function toWorkflowFinding(
  finding: EntityRecord["Finding"],
): ApprovedDeliveryAggregate["finding"] {
  return {
    id: finding.id,
    organizationId: finding.organization_id,
    status: finding.status,
  };
}

class Base44DeliveryClaims implements DeliveryClaimRepository {
  constructor(private readonly base44: Base44Client) {}

  async claim(deliveryId: string, idempotencyKey: string): Promise<ClaimResult> {
    const delivery =
      await this.base44.asServiceRole.entities.Delivery.get(deliveryId);
    if (delivery.connector_message_id) {
      return {
        kind: "already_sent",
        messageId: delivery.connector_message_id,
      };
    }
    if (delivery.status !== "queued" && delivery.status !== "retry_wait") {
      return { kind: "busy" };
    }
    const claimed = await this.tryClaim(delivery, idempotencyKey);
    return claimed ? { kind: "claimed" } : { kind: "busy" };
  }

  private async tryClaim(
    delivery: EntityRecord["Delivery"],
    idempotencyKey: string,
  ): Promise<boolean> {
    const result = await this.base44.asServiceRole.entities.Delivery.updateMany(
      {
        id: delivery.id,
        idempotency_key: idempotencyKey,
        status: delivery.status,
      },
      {
        $inc: { attempt: 1 },
        $set: {
          lease_expires_at: addMinutes(new Date(), 5),
          status: "sending",
        },
      },
    );
    return result.updated === 1;
  }

  async markRetryable(
    idempotencyKey: string,
    errorCode: string,
  ): Promise<void> {
    await this.base44.asServiceRole.entities.Delivery.updateMany(
      { idempotency_key: idempotencyKey, status: "sending" },
      {
        $set: {
          next_attempt_at: addMinutes(new Date(), 5),
          safe_error_code: errorCode,
          status: "retry_wait",
        },
        $unset: { lease_expires_at: "" },
      },
    );
  }

  async markSent(idempotencyKey: string, messageId: string): Promise<void> {
    await this.base44.asServiceRole.entities.Delivery.updateMany(
      { idempotency_key: idempotencyKey, status: "sending" },
      {
        $set: { connector_message_id: messageId, status: "sent" },
        $unset: { lease_expires_at: "", next_attempt_at: "", safe_error_code: "" },
      },
    );
  }
}

class GmailCorrectionSender implements CorrectionSender {
  constructor(
    private readonly base44: Base44Client,
    private readonly acknowledgementSecret: string,
    private readonly publicAppUrl: string,
  ) {}

  async send(input: ApprovedCorrection): Promise<{ messageId: string }> {
    const rawToken =
      await createDeliveryToken(input.deliveryId, this.acknowledgementSecret);
    await ensureDeliverySecret(this.base44, input, rawToken);
    return sendGmail(
      this.base44,
      input,
      buildAcknowledgementUrl(this.publicAppUrl, rawToken),
    );
  }
}

async function sendGmail(
  base44: Base44Client,
  input: ApprovedCorrection,
  acknowledgementUrl: string,
): Promise<{ messageId: string }> {
  const connection =
    await base44.asServiceRole.connectors.getConnection("gmail");
  const gmailRequest = buildGmailSendRequest({
    recipient: input.recipient,
    subject: input.subject,
    text: `${input.text}\n\nAcknowledge receipt: ${acknowledgementUrl}`,
  }, connection.accessToken);
  const response = await fetchGmail(gmailRequest.url, gmailRequest);
  const output: unknown = await response.json();
  if (!output || typeof output !== "object" || !("id" in output) ||
      typeof output.id !== "string") {
    throw createSafeError("GMAIL_RESPONSE_INVALID");
  }
  return { messageId: output.id };
}

async function fetchGmail(url: string, init: RequestInit): Promise<Response> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      throw createSafeError(`GMAIL_HTTP_${response.status}`);
    }
    return response;
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      throw error;
    }
    throw new AmbiguousSendError();
  }
}

function buildAcknowledgementUrl(publicAppUrl: string, token: string): string {
  return `${publicAppUrl.replace(/\/$/, "")}/acknowledge?token=${
    encodeURIComponent(token)
  }`;
}

async function ensureDeliverySecret(
  base44: Base44Client,
  correction: ApprovedCorrection,
  rawToken: string,
): Promise<void> {
  const existing = await findDeliverySecret(base44, correction.deliveryId);
  const tokenHash = await sha256Hex(rawToken);
  if (existing) {
    if (existing.token_hash !== tokenHash) {
      throw createSafeError("DELIVERY_TOKEN_CONFLICT");
    }
    return;
  }
  try {
    await createDeliverySecret(base44, correction, tokenHash);
  } catch (error) {
    const winner = await findDeliverySecret(base44, correction.deliveryId);
    if (!winner || winner.token_hash !== tokenHash) {
      throw error;
    }
  }
}

async function createDeliverySecret(
  base44: Base44Client,
  correction: ApprovedCorrection,
  tokenHash: string,
): Promise<void> {
  const delivery =
    await base44.asServiceRole.entities.Delivery.get(correction.deliveryId);
  await base44.asServiceRole.entities.DeliverySecret.create({
    delivery_id: correction.deliveryId,
    expires_at: addMinutes(new Date(), 10_080),
    organization_id: delivery.organization_id,
    recipient_email: correction.recipient,
    token_hash: tokenHash,
  });
}

async function findDeliverySecret(
  base44: Base44Client,
  deliveryId: string,
): Promise<EntityRecord["DeliverySecret"] | undefined> {
  const [secret] = await base44.asServiceRole.entities.DeliverySecret.filter(
    { delivery_id: deliveryId },
    "-created_date",
    1,
  );
  return secret;
}

function addMinutes(date: Date, minutes: number): string {
  return new Date(date.getTime() + minutes * 60_000).toISOString();
}

function assertSendableStatus(
  status: EntityRecord["Delivery"]["status"],
): ApprovedDeliveryAggregate["delivery"]["status"] {
  if (status === "queued" || status === "retry_wait" || status === "sent") {
    return status;
  }
  throw createSafeError("DELIVERY_NOT_SENDABLE");
}

serveBase44Function(async (request) => {
  const base44 = createClientFromRequest(request);
  const actor = buildWorkflowActor(await base44.auth.me());
  const body = await readJsonObject(request);
  const result = await sendValidatedCorrection(
    readRequiredString(body, "delivery_id"),
    new Base44ApprovedDelivery(base44),
    new Base44DeliveryClaims(base44),
    new GmailCorrectionSender(
      base44,
      readRuntimeSecret("ACKNOWLEDGEMENT_SECRET"),
      readRuntimeSecret("PUBLIC_APP_URL"),
    ),
    actor,
  );
  return Response.json(result);
});
