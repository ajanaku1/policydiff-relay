import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DriveAutomationEvent } from "../../base44/shared/ingestion.ts";
import {
  type DocumentExporter,
  type NewPolicyVersion,
  type PolicyVersionRecord,
  type PolicyVersionRepository,
  ingestPolicyVersion,
} from "../../base44/shared/version-ingestion.ts";

class MemoryPolicyVersions implements PolicyVersionRepository {
  readonly records: PolicyVersionRecord[] = [];

  async createOrGet(input: NewPolicyVersion): Promise<{
    created: boolean;
    record: PolicyVersionRecord;
  }> {
    const existing = this.records.find(
      (record) => record.dedupeKey === input.dedupeKey,
    );
    if (existing) {
      return { created: false, record: existing };
    }
    const record = { ...input, id: `version-${this.records.length + 1}` };
    this.records.push(record);
    return { created: true, record };
  }
}

class FixedDocumentExporter implements DocumentExporter {
  calls = 0;

  async exportText(): Promise<{
    sourceRevision: string;
    text: string;
  }> {
    this.calls += 1;
    return {
      sourceRevision: "drive-revision-2",
      text: "\r\nEligibility  \r\nEmployees must be 18 or older.\r\n",
    };
  }
}

const event: DriveAutomationEvent = {
  automation: {
    id: "automation-1",
    name: "on_allowlisted_policy_update",
    type: "connector",
  },
  event: {
    integration_type: "googledrive",
    provider_identifier: "shared-policy-drive",
    type: "file.update",
  },
  data: { file_id: "policy-doc-123" },
  payload_too_large: false,
};

const policy = {
  id: "policy-1",
  organizationId: "organization-1",
  sourceFileId: "policy-doc-123",
};

describe("policy version ingestion", () => {
  it("stores one immutable version for duplicate Drive content", async () => {
    const versions = new MemoryPolicyVersions();
    const exporter = new FixedDocumentExporter();
    const input = {
      event,
      eventId: "drive-event-1",
      policy,
    };

    const first = await ingestPolicyVersion(input, exporter, versions);
    const duplicate = await ingestPolicyVersion(input, exporter, versions);

    assert.equal(first.kind, "created");
    assert.equal(duplicate.kind, "duplicate");
    assert.equal(first.version.id, duplicate.version.id);
    assert.equal(versions.records.length, 1);
    assert.equal(first.version.contentText.endsWith("\n"), true);
    assert.match(first.version.contentHash, /^[a-f0-9]{64}$/);
  });

  it("stores one version when duplicate events run concurrently", async () => {
    const versions = new MemoryPolicyVersions();
    const exporter = new FixedDocumentExporter();
    const input = {
      event,
      eventId: "drive-event-1",
      policy,
    };

    const results = await Promise.all([
      ingestPolicyVersion(input, exporter, versions),
      ingestPolicyVersion(input, exporter, versions),
    ]);

    assert.equal(versions.records.length, 1);
    assert.equal(
      results.filter((result) => result.kind === "created").length,
      1,
    );
    assert.equal(
      results.filter((result) => result.kind === "duplicate").length,
      1,
    );
  });

  it("rejects another Drive file before export or persistence", async () => {
    const versions = new MemoryPolicyVersions();
    const exporter = new FixedDocumentExporter();
    const wrongFileEvent = {
      ...event,
      data: { file_id: "not-the-policy" },
    };

    await assert.rejects(
      ingestPolicyVersion(
        { event: wrongFileEvent, eventId: "drive-event-2", policy },
        exporter,
        versions,
      ),
      { code: "DRIVE_FILE_NOT_ALLOWLISTED" },
    );
    assert.equal(exporter.calls, 0);
    assert.equal(versions.records.length, 0);
  });
});
