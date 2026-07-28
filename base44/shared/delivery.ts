export type DeliveryClaim = {
  deliveryId: string;
  errorCode?: string;
  idempotencyKey: string;
  messageId?: string;
};

export type ClaimResult =
  | { kind: "already_sent"; messageId: string }
  | { kind: "busy" }
  | { kind: "claimed" };

export interface DeliveryClaimRepository {
  claim(deliveryId: string, idempotencyKey: string): Promise<ClaimResult>;
  markRetryable(idempotencyKey: string, errorCode: string): Promise<void>;
  markSent(idempotencyKey: string, messageId: string): Promise<void>;
}

export interface CorrectionSender {
  send(input: ApprovedCorrection): Promise<{ messageId: string }>;
}

export class AmbiguousSendError extends Error {
  readonly code = "GMAIL_OUTCOME_AMBIGUOUS";

  constructor() {
    super("GMAIL_OUTCOME_AMBIGUOUS");
    this.name = "AmbiguousSendError";
  }
}

export type ApprovedCorrection = {
  approvalId: string;
  deliveryId: string;
  idempotencyKey: string;
  recipient: string;
  subject: string;
  text: string;
};

export type SendCorrectionResult =
  | { kind: "already_sent"; messageId: string }
  | { kind: "duplicate_suppressed" }
  | { kind: "sent"; messageId: string };

export async function sendCorrectionOnce(
  correction: ApprovedCorrection,
  claims: DeliveryClaimRepository,
  sender: CorrectionSender,
): Promise<SendCorrectionResult> {
  const claim = await claims.claim(
    correction.deliveryId,
    correction.idempotencyKey,
  );
  if (claim.kind === "already_sent") {
    return claim;
  }
  if (claim.kind === "busy") {
    return { kind: "duplicate_suppressed" };
  }

  try {
    const sent = await sender.send(correction);
    await claims.markSent(correction.idempotencyKey, sent.messageId);
    return { kind: "sent", messageId: sent.messageId };
  } catch (error: unknown) {
    if (!(error instanceof AmbiguousSendError)) {
      await claims.markRetryable(
        correction.idempotencyKey,
        toSafeErrorCode(error),
      );
    }
    throw error;
  }
}

function toSafeErrorCode(error: unknown): string {
  return error instanceof Error && error.name
    ? `SENDER_${error.name.toUpperCase()}`
    : "SENDER_UNKNOWN";
}
