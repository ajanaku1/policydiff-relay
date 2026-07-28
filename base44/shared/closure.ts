import type { WorkflowActor } from "./workflow.ts";
import { sha256Hex } from "./ingestion.ts";

export type AcknowledgementRecord = {
  acknowledgedAt: string;
  deliveryId: string;
  id: string;
  organizationId: string;
};

export interface AcknowledgementRepository {
  consumeTokenAndCreate(
    tokenHash: string,
    acknowledgedAt: string,
  ): Promise<AcknowledgementRecord | undefined>;
}

export type AuditTrail = {
  acknowledgements: Array<Record<string, unknown>>;
  approvals: Array<Record<string, unknown>>;
  deliveries: Array<Record<string, unknown>>;
  findings: Array<Record<string, unknown>>;
  versions: Array<Record<string, unknown>>;
};

export interface AuditTrailSource {
  load(
    organizationId: string,
    trailCutoffAt: string,
  ): Promise<AuditTrail>;
}

export interface AuditFileStore {
  createSignedUrl(fileUri: string, expiresIn: number): Promise<string>;
  uploadPrivate(content: string): Promise<string>;
}

export type AuditPacketRequest = {
  actor: WorkflowActor;
  organizationId: string;
  trailCutoffAt: string;
};

export type AuditPacketResult = {
  packetHash: string;
  privateFileUri: string;
  signedUrl: string;
};

type ClosureErrorCode =
  | "ACKNOWLEDGEMENT_TOKEN_INVALID"
  | "AUDIT_ORGANIZATION_MISMATCH"
  | "AUDITOR_REQUIRED";

export class ClosureError extends Error {
  readonly code: ClosureErrorCode;

  constructor(code: ClosureErrorCode) {
    super(code);
    this.name = "ClosureError";
    this.code = code;
  }
}

export async function acknowledgeDelivery(
  rawToken: string,
  acknowledgedAt: string,
  repository: AcknowledgementRepository,
): Promise<AcknowledgementRecord> {
  if (!rawToken) {
    throw new ClosureError("ACKNOWLEDGEMENT_TOKEN_INVALID");
  }
  const tokenHash = await sha256Hex(rawToken);
  const acknowledgement = await repository.consumeTokenAndCreate(
    tokenHash,
    acknowledgedAt,
  );
  if (!acknowledgement) {
    throw new ClosureError("ACKNOWLEDGEMENT_TOKEN_INVALID");
  }
  return acknowledgement;
}

export async function createAuditPacket(
  request: AuditPacketRequest,
  source: AuditTrailSource,
  files: AuditFileStore,
): Promise<AuditPacketResult> {
  assertAuditAccess(request);
  const trail = await source.load(
    request.organizationId,
    request.trailCutoffAt,
  );
  const content = serializeAuditPacket(request, trail);
  const packetHash = await sha256Hex(content);
  const privateFileUri = await files.uploadPrivate(content);
  const signedUrl = await files.createSignedUrl(privateFileUri, 300);
  return { packetHash, privateFileUri, signedUrl };
}

export function withinAuditCutoff<T extends { created_date?: unknown }>(
  records: T[],
  trailCutoffAt: string,
): T[] {
  const cutoff = Date.parse(trailCutoffAt);
  return records.filter(({ created_date: createdDate }) =>
    typeof createdDate === "string" &&
    Date.parse(createdDate) <= cutoff
  );
}

function assertAuditAccess(request: AuditPacketRequest): void {
  const allowed =
    request.actor.policyRole === "auditor" ||
    request.actor.policyRole === "policy_admin";
  if (!allowed) {
    throw new ClosureError("AUDITOR_REQUIRED");
  }
  if (request.actor.organizationId !== request.organizationId) {
    throw new ClosureError("AUDIT_ORGANIZATION_MISMATCH");
  }
}

function serializeAuditPacket(
  request: AuditPacketRequest,
  trail: AuditTrail,
): string {
  return JSON.stringify(
    {
      organization_id: request.organizationId,
      schema_version: 1,
      trail,
      trail_cutoff_at: request.trailCutoffAt,
    },
    null,
    2,
  );
}
