import {
  assertAllowlistedDriveUpdate,
  buildPolicyVersionDedupeKey,
  canonicalizePolicyText,
  type DriveAutomationEvent,
  sha256Hex,
} from "./ingestion.ts";

export type PolicySource = {
  id: string;
  organizationId: string;
  sourceFileId: string;
};

export type IngestPolicyVersionInput = {
  event: DriveAutomationEvent;
  eventId: string;
  policy: PolicySource;
};

export type NewPolicyVersion = {
  contentHash: string;
  contentText: string;
  createdByEventId: string;
  dedupeKey: string;
  organizationId: string;
  policyId: string;
  sourceFileId: string;
  sourceRevision: string;
  status: "ingesting";
};

export type PolicyVersionRecord = NewPolicyVersion & {
  id: string;
};

export interface DocumentExporter {
  exportText(fileId: string): Promise<{
    sourceRevision: string;
    text: string;
  }>;
}

export interface PolicyVersionRepository {
  createOrGet(input: NewPolicyVersion): Promise<{
    created: boolean;
    record: PolicyVersionRecord;
  }>;
}

export type IngestPolicyVersionResult = {
  kind: "created" | "duplicate";
  version: PolicyVersionRecord;
};

export async function ingestPolicyVersion(
  input: IngestPolicyVersionInput,
  exporter: DocumentExporter,
  versions: PolicyVersionRepository,
): Promise<IngestPolicyVersionResult> {
  assertAllowlistedDriveUpdate(input.event, input.policy.sourceFileId);
  const exported = await exporter.exportText(input.policy.sourceFileId);
  const contentText = canonicalizePolicyText(exported.text);
  const contentHash = await sha256Hex(contentText);
  const dedupeKey = buildPolicyVersionDedupeKey(
    input.policy.sourceFileId,
    contentHash,
  );
  const persisted = await versions.createOrGet({
    contentHash,
    contentText,
    createdByEventId: input.eventId,
    dedupeKey,
    organizationId: input.policy.organizationId,
    policyId: input.policy.id,
    sourceFileId: input.policy.sourceFileId,
    sourceRevision: exported.sourceRevision,
    status: "ingesting",
  });
  return {
    kind: persisted.created ? "created" : "duplicate",
    version: persisted.record,
  };
}
