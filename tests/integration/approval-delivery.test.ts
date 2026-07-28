import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  CorrectionSender,
  DeliveryClaimRepository,
} from "../../base44/shared/delivery.ts";
import {
  type ApprovalRecord,
  type ApprovalRepository,
  type ApprovedDeliveryAggregate,
  type ApprovedDeliveryRepository,
  approveFinding,
  decideDeliveryAction,
  sendValidatedCorrection,
} from "../../base44/shared/workflow.ts";

class MemoryApprovals implements ApprovalRepository {
  approval: ApprovalRecord | undefined;

  async approveIfPending(input: {
    correctionText: string;
    findingId: string;
    organizationId: string;
    reviewerId: string;
  }): Promise<ApprovalRecord | undefined> {
    if (this.approval) {
      return undefined;
    }
    this.approval = {
      correctionRevision: 1,
      correctionText: input.correctionText,
      decision: "approved",
      findingId: input.findingId,
      id: "approval-1",
      organizationId: input.organizationId,
      reviewerId: input.reviewerId,
    };
    return this.approval;
  }
}

class FixedApprovedDelivery implements ApprovedDeliveryRepository {
  readonly aggregate: ApprovedDeliveryAggregate;

  constructor(aggregate: ApprovedDeliveryAggregate) {
    this.aggregate = aggregate;
  }

  async load(): Promise<ApprovedDeliveryAggregate> {
    return this.aggregate;
  }
}

class AtomicClaims implements DeliveryClaimRepository {
  claimed = false;
  messageId: string | undefined;

  async claim() {
    if (this.messageId) {
      return { kind: "already_sent" as const, messageId: this.messageId };
    }
    if (this.claimed) {
      return { kind: "busy" as const };
    }
    this.claimed = true;
    return { kind: "claimed" as const };
  }

  async markRetryable(): Promise<void> {
    this.claimed = false;
  }

  async markSent(_idempotencyKey: string, messageId: string): Promise<void> {
    this.messageId = messageId;
  }
}

class RecordingSender implements CorrectionSender {
  calls = 0;

  async send(): Promise<{ messageId: string }> {
    this.calls += 1;
    return { messageId: "gmail-message-1" };
  }
}

const reviewer = {
  id: "reviewer-1",
  organizationId: "organization-1",
  policyRole: "reviewer" as const,
};

const approvedAggregate: ApprovedDeliveryAggregate = {
  approval: {
    correctionRevision: 1,
    correctionText: "The minimum eligibility age is now 21.",
    decision: "approved",
    findingId: "finding-1",
    id: "approval-1",
    organizationId: "organization-1",
    reviewerId: "reviewer-1",
  },
  delivery: {
    approvalId: "approval-1",
    correctionRevision: 1,
    id: "delivery-1",
    idempotencyKey: "approval-1:recipient-1:revision-1",
    organizationId: "organization-1",
    status: "queued",
  },
  finding: {
    id: "finding-1",
    organizationId: "organization-1",
    status: "approved",
  },
  recipient: {
    email: "casey@example.test",
  },
};

describe("human approval", () => {
  it("creates one approval for a same-organization reviewer", async () => {
    const approvals = new MemoryApprovals();
    const approval = await approveFinding(
      {
        actor: reviewer,
        correctionText: "The minimum eligibility age is now 21.",
        findingId: "finding-1",
        findingOrganizationId: "organization-1",
      },
      approvals,
    );

    assert.equal(approval.decision, "approved");
    await assert.rejects(
      approveFinding(
        {
          actor: reviewer,
          correctionText: "Duplicate approval.",
          findingId: "finding-1",
          findingOrganizationId: "organization-1",
        },
        approvals,
      ),
      { code: "FINDING_NOT_PENDING" },
    );
  });

  it("rejects staff and cross-organization approval attempts", async () => {
    const approvals = new MemoryApprovals();
    await assert.rejects(
      approveFinding(
        {
          actor: { ...reviewer, policyRole: "staff" },
          correctionText: "Unauthorized.",
          findingId: "finding-1",
          findingOrganizationId: "organization-1",
        },
        approvals,
      ),
      { code: "REVIEWER_REQUIRED" },
    );
    await assert.rejects(
      approveFinding(
        {
          actor: reviewer,
          correctionText: "Wrong organization.",
          findingId: "finding-2",
          findingOrganizationId: "organization-2",
        },
        approvals,
      ),
      { code: "ORGANIZATION_MISMATCH" },
    );
  });
});

describe("server-validated delivery", () => {
  it("rejects a staff caller before sending a correction", async () => {
    const sender = new RecordingSender();

    await assert.rejects(
      sendValidatedCorrection(
        "delivery-1",
        new FixedApprovedDelivery(approvedAggregate),
        new AtomicClaims(),
        sender,
        { ...reviewer, policyRole: "staff" },
      ),
      { code: "REVIEWER_REQUIRED" },
    );
    assert.equal(sender.calls, 0);
  });

  it("rejects a reviewer from another organization before sending", async () => {
    const sender = new RecordingSender();

    await assert.rejects(
      sendValidatedCorrection(
        "delivery-1",
        new FixedApprovedDelivery(approvedAggregate),
        new AtomicClaims(),
        sender,
        { ...reviewer, organizationId: "organization-2" },
      ),
      { code: "ORGANIZATION_MISMATCH" },
    );
    assert.equal(sender.calls, 0);
  });

  it("allows a policy admin from the delivery organization to send", async () => {
    const sender = new RecordingSender();

    const result = await sendValidatedCorrection(
      "delivery-1",
      new FixedApprovedDelivery(approvedAggregate),
      new AtomicClaims(),
      sender,
      { ...reviewer, policyRole: "policy_admin" },
    );

    assert.deepEqual(result, {
      kind: "sent",
      messageId: "gmail-message-1",
    });
    assert.equal(sender.calls, 1);
  });

  it("sends only after re-reading a matching approved aggregate", async () => {
    const sender = new RecordingSender();
    const result = await sendValidatedCorrection(
      "delivery-1",
      new FixedApprovedDelivery(approvedAggregate),
      new AtomicClaims(),
      sender,
      reviewer,
    );

    assert.deepEqual(result, {
      kind: "sent",
      messageId: "gmail-message-1",
    });
    assert.equal(sender.calls, 1);
  });

  it("does not call Gmail when approval state is stale", async () => {
    const sender = new RecordingSender();
    const stale = {
      ...approvedAggregate,
      finding: { ...approvedAggregate.finding, status: "pending_review" as const },
    };

    await assert.rejects(
      sendValidatedCorrection(
        "delivery-1",
        new FixedApprovedDelivery(stale),
        new AtomicClaims(),
        sender,
        reviewer,
      ),
      { code: "DELIVERY_NOT_APPROVED" },
    );
    assert.equal(sender.calls, 0);
  });

  it("does not send a delivery queued for another correction revision", async () => {
    const sender = new RecordingSender();
    const stale = {
      ...approvedAggregate,
      delivery: { ...approvedAggregate.delivery, correctionRevision: 2 },
    };

    await assert.rejects(
      sendValidatedCorrection(
        "delivery-1",
        new FixedApprovedDelivery(stale),
        new AtomicClaims(),
        sender,
        reviewer,
      ),
      { code: "DELIVERY_NOT_APPROVED" },
    );
    assert.equal(sender.calls, 0);
  });

  it("returns the stored Gmail ID when a validated sent delivery is retried", async () => {
    const sender = new RecordingSender();
    const claims = new AtomicClaims();
    claims.messageId = "gmail-message-1";
    const sent = {
      ...approvedAggregate,
      delivery: { ...approvedAggregate.delivery, status: "sent" as const },
    };

    const result = await sendValidatedCorrection(
      "delivery-1",
      new FixedApprovedDelivery(sent),
      claims,
      sender,
      reviewer,
    );

    assert.deepEqual(result, {
      kind: "already_sent",
      messageId: "gmail-message-1",
    });
    assert.equal(sender.calls, 0);
  });
});

describe("delivery reconciliation", () => {
  it("reconciles an expired sending lease instead of resending", () => {
    assert.equal(
      decideDeliveryAction(
        {
          leaseExpiresAt: "2026-07-27T09:00:00.000Z",
          status: "sending",
        },
        "2026-07-27T09:05:00.000Z",
      ),
      "reconcile",
    );
  });

  it("sends queued and due retry records but waits for future retries", () => {
    assert.equal(
      decideDeliveryAction({ status: "queued" }, "2026-07-27T09:05:00.000Z"),
      "send",
    );
    assert.equal(
      decideDeliveryAction(
        {
          nextAttemptAt: "2026-07-27T09:00:00.000Z",
          status: "retry_wait",
        },
        "2026-07-27T09:05:00.000Z",
      ),
      "send",
    );
    assert.equal(
      decideDeliveryAction(
        {
          nextAttemptAt: "2026-07-27T10:00:00.000Z",
          status: "retry_wait",
        },
        "2026-07-27T09:05:00.000Z",
      ),
      "wait",
    );
  });
});
