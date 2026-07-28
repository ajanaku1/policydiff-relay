import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type ClaimResult,
  type CorrectionSender,
  type DeliveryClaim,
  type DeliveryClaimRepository,
  AmbiguousSendError,
  sendCorrectionOnce,
} from "../../base44/shared/delivery.ts";

class AtomicMemoryDeliveryClaims implements DeliveryClaimRepository {
  readonly #claims = new Map<string, DeliveryClaim>();

  async claim(
    deliveryId: string,
    idempotencyKey: string,
  ): Promise<ClaimResult> {
    const current = this.#claims.get(idempotencyKey);
    if (current?.messageId) {
      return { kind: "already_sent" as const, messageId: current.messageId };
    }
    if (current) {
      return { kind: "busy" as const };
    }

    this.#claims.set(idempotencyKey, { deliveryId, idempotencyKey });
    return { kind: "claimed" as const };
  }

  async markSent(idempotencyKey: string, messageId: string): Promise<void> {
    const claim = this.#claims.get(idempotencyKey);
    assert.ok(claim);
    this.#claims.set(idempotencyKey, { ...claim, messageId });
  }

  async markRetryable(
    idempotencyKey: string,
    errorCode: string,
  ): Promise<void> {
    const claim = this.#claims.get(idempotencyKey);
    assert.ok(claim);
    this.#claims.set(idempotencyKey, { ...claim, errorCode });
  }
}

class RecordingCorrectionSender implements CorrectionSender {
  calls = 0;

  async send(): Promise<{ messageId: string }> {
    this.calls += 1;
    await Promise.resolve();
    return { messageId: "gmail-message-1" };
  }
}

class AmbiguousCorrectionSender implements CorrectionSender {
  async send(): Promise<{ messageId: string }> {
    throw new AmbiguousSendError();
  }
}

const approvedCorrection = {
  approvalId: "approval-1",
  deliveryId: "delivery-1",
  idempotencyKey: "approval-1:recipient-1:revision-1",
  recipient: "casey@example.test",
  subject: "Updated eligibility guidance",
  text: "The eligibility rule changed. Please review the corrected guidance.",
};

describe("delivery contract", () => {
  it("allows one external send across concurrent retries", async () => {
    const claims = new AtomicMemoryDeliveryClaims();
    const sender = new RecordingCorrectionSender();

    const results = await Promise.all([
      sendCorrectionOnce(approvedCorrection, claims, sender),
      sendCorrectionOnce(approvedCorrection, claims, sender),
    ]);

    assert.equal(sender.calls, 1);
    assert.equal(
      results.filter((result) => result.kind === "sent").length,
      1,
    );
    assert.equal(
      results.filter((result) => result.kind === "duplicate_suppressed").length,
      1,
    );
  });

  it("returns the stored message ID on a retry after success", async () => {
    const claims = new AtomicMemoryDeliveryClaims();
    const sender = new RecordingCorrectionSender();

    await sendCorrectionOnce(approvedCorrection, claims, sender);
    const retry = await sendCorrectionOnce(approvedCorrection, claims, sender);

    assert.deepEqual(retry, {
      kind: "already_sent",
      messageId: "gmail-message-1",
    });
    assert.equal(sender.calls, 1);
  });

  it("leaves an ambiguous connector outcome claimed for reconciliation", async () => {
    const claims = new AtomicMemoryDeliveryClaims();

    await assert.rejects(
      sendCorrectionOnce(
        approvedCorrection,
        claims,
        new AmbiguousCorrectionSender(),
      ),
      { code: "GMAIL_OUTCOME_AMBIGUOUS" },
    );

    const retry = await claims.claim(
      approvedCorrection.deliveryId,
      approvedCorrection.idempotencyKey,
    );
    assert.deepEqual(retry, { kind: "busy" });
  });
});
