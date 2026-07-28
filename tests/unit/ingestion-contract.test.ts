import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertAllowlistedDriveUpdate,
  buildPolicyVersionDedupeKey,
  canonicalizePolicyText,
  sha256Hex,
} from "../../base44/shared/ingestion.ts";

const driveUpdate = {
  automation: {
    id: "automation-1",
    name: "on_allowlisted_policy_update",
    type: "connector" as const,
  },
  event: {
    integration_type: "googledrive",
    provider_identifier: "shared-policy-drive",
    type: "file.update",
  },
  data: {
    file_id: "policy-doc-123",
  },
  payload_too_large: false,
};

describe("Drive ingestion contract", () => {
  it("accepts only the configured Google Drive file.update event", () => {
    const result = assertAllowlistedDriveUpdate(
      driveUpdate,
      "policy-doc-123",
    );

    assert.deepEqual(result, {
      fileId: "policy-doc-123",
      providerIdentifier: "shared-policy-drive",
    });
  });

  it("rejects an update for any other file", () => {
    assert.throws(
      () => assertAllowlistedDriveUpdate(driveUpdate, "different-doc"),
      { code: "DRIVE_FILE_NOT_ALLOWLISTED" },
    );
  });

  it("rejects oversized connector events before reading data", () => {
    assert.throws(
      () =>
        assertAllowlistedDriveUpdate(
          { ...driveUpdate, data: null, payload_too_large: true },
          "policy-doc-123",
        ),
      { code: "DRIVE_EVENT_PAYLOAD_TOO_LARGE" },
    );
  });

  it("canonicalizes equivalent document exports identically", async () => {
    const windowsExport = "\nEligibility  \r\nAge 18+\r\n\r\n";
    const unixExport = "Eligibility\nAge 18+\n";

    const canonicalWindows = canonicalizePolicyText(windowsExport);
    const canonicalUnix = canonicalizePolicyText(unixExport);

    assert.equal(canonicalWindows, canonicalUnix);
    assert.equal(
      await sha256Hex(canonicalWindows),
      await sha256Hex(canonicalUnix),
    );
  });

  it("binds the version dedupe key to both source and content", async () => {
    const contentHash = await sha256Hex("Eligibility\nAge 18+");

    assert.equal(
      buildPolicyVersionDedupeKey("policy-doc-123", contentHash),
      `policy-doc-123:${contentHash}`,
    );
    assert.notEqual(
      buildPolicyVersionDedupeKey("other-doc", contentHash),
      buildPolicyVersionDedupeKey("policy-doc-123", contentHash),
    );
  });
});
