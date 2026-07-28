import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sha256Hex } from "../../base44/shared/ingestion.ts";
import {
  type AcknowledgementRecord,
  type AcknowledgementRepository,
  type AuditFileStore,
  type AuditTrail,
  type AuditTrailSource,
  acknowledgeDelivery,
  createAuditPacket,
} from "../../base44/shared/closure.ts";

class SingleUseAcknowledgements implements AcknowledgementRepository {
  consumed = false;
  readonly expectedHash: string;
  readonly expiresAt: string;

  constructor(expectedHash: string, expiresAt: string) {
    this.expectedHash = expectedHash;
    this.expiresAt = expiresAt;
  }

  async consumeTokenAndCreate(
    tokenHash: string,
    acknowledgedAt: string,
  ): Promise<AcknowledgementRecord | undefined> {
    if (
      this.consumed ||
      tokenHash !== this.expectedHash ||
      acknowledgedAt > this.expiresAt
    ) {
      return undefined;
    }
    this.consumed = true;
    return {
      acknowledgedAt,
      deliveryId: "delivery-1",
      id: "acknowledgement-1",
      organizationId: "organization-1",
    };
  }
}

class FixedAuditTrail implements AuditTrailSource {
  async load(): Promise<AuditTrail> {
    return {
      acknowledgements: [],
      approvals: [{ id: "approval-1" }],
      deliveries: [{ id: "delivery-1", status: "sent" }],
      findings: [{ classification: "affected", id: "finding-1" }],
      versions: [{ content_hash: "abc123", id: "version-2" }],
    };
  }
}

class RecordingPrivateFiles implements AuditFileStore {
  content = "";
  expiresIn = 0;

  async createSignedUrl(
    _fileUri: string,
    expiresIn: number,
  ): Promise<string> {
    this.expiresIn = expiresIn;
    return "https://private.example.test/audit?signature=short-lived";
  }

  async uploadPrivate(content: string): Promise<string> {
    this.content = content;
    return "private/organization-1/audit-packet.json";
  }
}

describe("single-use acknowledgement", () => {
  it("records one acknowledgement and rejects token replay", async () => {
    const rawToken = "opaque-delivery-token";
    const repository = new SingleUseAcknowledgements(
      await sha256Hex(rawToken),
      "2026-07-27T10:00:00.000Z",
    );

    const acknowledgement = await acknowledgeDelivery(
      rawToken,
      "2026-07-27T09:00:00.000Z",
      repository,
    );
    assert.equal(acknowledgement.deliveryId, "delivery-1");

    await assert.rejects(
      acknowledgeDelivery(
        rawToken,
        "2026-07-27T09:01:00.000Z",
        repository,
      ),
      { code: "ACKNOWLEDGEMENT_TOKEN_INVALID" },
    );
  });

  it("rejects an expired acknowledgement token", async () => {
    const rawToken = "expired-token";
    const repository = new SingleUseAcknowledgements(
      await sha256Hex(rawToken),
      "2026-07-27T08:59:00.000Z",
    );

    await assert.rejects(
      acknowledgeDelivery(
        rawToken,
        "2026-07-27T09:00:00.000Z",
        repository,
      ),
      { code: "ACKNOWLEDGEMENT_TOKEN_INVALID" },
    );
  });
});

describe("private audit export", () => {
  it("writes the organization trail and returns a five-minute signed URL", async () => {
    const files = new RecordingPrivateFiles();
    const result = await createAuditPacket(
      {
        actor: {
          id: "auditor-1",
          organizationId: "organization-1",
          policyRole: "auditor",
        },
        organizationId: "organization-1",
        trailCutoffAt: "2026-07-27T09:00:00.000Z",
      },
      new FixedAuditTrail(),
      files,
    );

    assert.equal(files.expiresIn, 300);
    assert.match(files.content, /"approval-1"/);
    assert.match(result.packetHash, /^[a-f0-9]{64}$/);
    assert.match(result.signedUrl, /^https:\/\/private\.example\.test\//);
  });

  it("rejects staff and cross-organization audit requests", async () => {
    const files = new RecordingPrivateFiles();
    const source = new FixedAuditTrail();
    await assert.rejects(
      createAuditPacket(
        {
          actor: {
            id: "staff-1",
            organizationId: "organization-1",
            policyRole: "staff",
          },
          organizationId: "organization-1",
          trailCutoffAt: "2026-07-27T09:00:00.000Z",
        },
        source,
        files,
      ),
      { code: "AUDITOR_REQUIRED" },
    );
    await assert.rejects(
      createAuditPacket(
        {
          actor: {
            id: "auditor-1",
            organizationId: "organization-1",
            policyRole: "auditor",
          },
          organizationId: "organization-2",
          trailCutoffAt: "2026-07-27T09:00:00.000Z",
        },
        source,
        files,
      ),
      { code: "AUDIT_ORGANIZATION_MISMATCH" },
    );
  });
});
