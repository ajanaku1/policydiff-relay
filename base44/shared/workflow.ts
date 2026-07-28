import {
  type ApprovedCorrection,
  type CorrectionSender,
  type DeliveryClaimRepository,
  type SendCorrectionResult,
  sendCorrectionOnce,
} from "./delivery.ts";

export type PolicyRole = "auditor" | "policy_admin" | "reviewer" | "staff";

export type WorkflowActor = {
  id: string;
  organizationId: string;
  policyRole: PolicyRole;
};

export type ApprovalRecord = {
  correctionRevision: number;
  correctionText: string;
  decision: "approved" | "dismissed";
  findingId: string;
  id: string;
  organizationId: string;
  reviewerId: string;
};

export interface ApprovalRepository {
  approveIfPending(input: {
    correctionText: string;
    findingId: string;
    organizationId: string;
    reviewerId: string;
  }): Promise<ApprovalRecord | undefined>;
}

export type ApproveFindingInput = {
  actor: WorkflowActor;
  correctionText: string;
  findingId: string;
  findingOrganizationId: string;
};

export type ApprovedDeliveryAggregate = {
  approval: ApprovalRecord;
  delivery: {
    approvalId: string;
    correctionRevision: number;
    id: string;
    idempotencyKey: string;
    organizationId: string;
    status: "queued" | "retry_wait" | "sending" | "sent";
  };
  finding: {
    id: string;
    organizationId: string;
    status: "approved" | "dismissed" | "pending_review" | "superseded";
  };
  recipient: {
    email: string;
  };
};

export interface ApprovedDeliveryRepository {
  load(deliveryId: string): Promise<ApprovedDeliveryAggregate>;
}

export type ReconciledDelivery = {
  leaseExpiresAt?: string;
  nextAttemptAt?: string;
  status:
    | "acknowledged"
    | "acknowledgement_expired"
    | "failed"
    | "queued"
    | "retry_wait"
    | "sending"
    | "sent";
};

export type DeliveryAction = "done" | "reconcile" | "send" | "wait";

type WorkflowErrorCode =
  | "DELIVERY_NOT_APPROVED"
  | "FINDING_NOT_PENDING"
  | "ORGANIZATION_MISMATCH"
  | "REVIEWER_REQUIRED";

export class WorkflowError extends Error {
  readonly code: WorkflowErrorCode;

  constructor(code: WorkflowErrorCode) {
    super(code);
    this.name = "WorkflowError";
    this.code = code;
  }
}

export async function approveFinding(
  input: ApproveFindingInput,
  approvals: ApprovalRepository,
): Promise<ApprovalRecord> {
  if (input.actor.policyRole !== "reviewer") {
    throw new WorkflowError("REVIEWER_REQUIRED");
  }
  if (input.actor.organizationId !== input.findingOrganizationId) {
    throw new WorkflowError("ORGANIZATION_MISMATCH");
  }
  const approval = await approvals.approveIfPending({
    correctionText: input.correctionText,
    findingId: input.findingId,
    organizationId: input.actor.organizationId,
    reviewerId: input.actor.id,
  });
  if (!approval) {
    throw new WorkflowError("FINDING_NOT_PENDING");
  }
  return approval;
}

export async function sendValidatedCorrection(
  deliveryId: string,
  deliveries: ApprovedDeliveryRepository,
  claims: DeliveryClaimRepository,
  sender: CorrectionSender,
): Promise<SendCorrectionResult> {
  const aggregate = await deliveries.load(deliveryId);
  const correction = toApprovedCorrection(deliveryId, aggregate);
  return sendCorrectionOnce(correction, claims, sender);
}

export function decideDeliveryAction(
  delivery: ReconciledDelivery,
  now: string,
): DeliveryAction {
  if (delivery.status === "queued") {
    return "send";
  }
  if (delivery.status === "retry_wait") {
    return delivery.nextAttemptAt && delivery.nextAttemptAt <= now
      ? "send"
      : "wait";
  }
  if (delivery.status === "sending") {
    return delivery.leaseExpiresAt && delivery.leaseExpiresAt <= now
      ? "reconcile"
      : "wait";
  }
  return "done";
}

function toApprovedCorrection(
  deliveryId: string,
  aggregate: ApprovedDeliveryAggregate,
): ApprovedCorrection {
  if (!isApprovedDelivery(deliveryId, aggregate)) {
    throw new WorkflowError("DELIVERY_NOT_APPROVED");
  }
  return {
    approvalId: aggregate.approval.id,
    deliveryId: aggregate.delivery.id,
    idempotencyKey: aggregate.delivery.idempotencyKey,
    recipient: aggregate.recipient.email,
    subject: "Updated policy guidance",
    text: aggregate.approval.correctionText,
  };
}

function isApprovedDelivery(
  deliveryId: string,
  aggregate: ApprovedDeliveryAggregate,
): boolean {
  const { approval, delivery, finding } = aggregate;
  const organizationMatches =
    approval.organizationId === delivery.organizationId &&
    finding.organizationId === delivery.organizationId;
  const referencesMatch =
    delivery.id === deliveryId &&
    delivery.approvalId === approval.id &&
    approval.findingId === finding.id;
  const stateAllowsSend =
    approval.decision === "approved" &&
    finding.status === "approved" &&
    (
      delivery.status === "queued" ||
      delivery.status === "retry_wait" ||
      delivery.status === "sent"
    );
  return (
    organizationMatches &&
    referencesMatch &&
    stateAllowsSend &&
    delivery.correctionRevision === approval.correctionRevision
  );
}
