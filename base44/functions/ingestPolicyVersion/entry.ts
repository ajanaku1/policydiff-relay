import {
  createClientFromRequest,
  type Base44Client,
  type EntityRecord,
} from "@base44/sdk";

import { invokeFunction } from "../../shared/base44-invoke.ts";
import {
  readAutomationPayload,
  readJsonObject,
  readRequiredString,
  serveBase44Function,
} from "../../shared/base44-http.ts";
import { buildGoogleDocExportRequest } from "../../shared/google-api.ts";
import type { DriveAutomationEvent } from "../../shared/ingestion.ts";
import {
  type DocumentExporter,
  type NewPolicyVersion,
  type PolicyVersionRecord,
  type PolicyVersionRepository,
  ingestPolicyVersion,
} from "../../shared/version-ingestion.ts";

class GoogleDriveExporter implements DocumentExporter {
  constructor(private readonly base44: Base44Client) {}

  async exportText(fileId: string): Promise<{
    sourceRevision: string;
    text: string;
  }> {
    const connection =
      await this.base44.asServiceRole.connectors.getConnection("googledrive");
    const request = buildGoogleDocExportRequest(fileId, connection.accessToken);
    const response = await fetch(request.url, request);
    if (!response.ok) {
      throw new HostedFunctionError("DRIVE_EXPORT_FAILED");
    }
    return {
      sourceRevision: response.headers.get("etag") ?? "unversioned",
      text: await response.text(),
    };
  }
}

class Base44PolicyVersions implements PolicyVersionRepository {
  constructor(private readonly base44: Base44Client) {}

  async createOrGet(input: NewPolicyVersion): Promise<{
    created: boolean;
    record: PolicyVersionRecord;
  }> {
    const existing = await this.find(input.dedupeKey);
    if (existing) {
      return { created: false, record: toVersionRecord(existing) };
    }
    try {
      return {
        created: true,
        record: toVersionRecord(await this.create(input)),
      };
    } catch (error) {
      const winner = await this.find(input.dedupeKey);
      if (!winner) {
        throw error;
      }
      return { created: false, record: toVersionRecord(winner) };
    }
  }

  private create(
    input: NewPolicyVersion,
  ): Promise<EntityRecord["PolicyVersion"]> {
    return this.base44.asServiceRole.entities.PolicyVersion.create({
      content_hash: input.contentHash,
      content_text: input.contentText,
      created_by_event_id: input.createdByEventId,
      dedupe_key: input.dedupeKey,
      organization_id: input.organizationId,
      policy_id: input.policyId,
      source_file_id: input.sourceFileId,
      source_revision: input.sourceRevision,
      status: input.status,
    });
  }

  private async find(
    dedupeKey: string,
  ): Promise<EntityRecord["PolicyVersion"] | undefined> {
    const [version] =
      await this.base44.asServiceRole.entities.PolicyVersion.filter(
        { dedupe_key: dedupeKey },
        "-created_date",
        1,
      );
    return version;
  }
}

class HostedFunctionError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "HostedFunctionError";
  }
}

function toVersionRecord(
  version: EntityRecord["PolicyVersion"],
): PolicyVersionRecord {
  return {
    contentHash: version.content_hash,
    contentText: version.content_text,
    createdByEventId: version.created_by_event_id,
    dedupeKey: version.dedupe_key,
    id: version.id,
    organizationId: version.organization_id,
    policyId: version.policy_id,
    sourceFileId: version.source_file_id,
    sourceRevision: version.source_revision ?? "unversioned",
    status: "ingesting",
  };
}

function readEventFileId(body: Record<string, unknown>): string {
  const data = body.data;
  return readRequiredString(
    data && typeof data === "object" && !Array.isArray(data)
      ? data as Record<string, unknown>
      : {},
    "file_id",
  );
}

async function findPolicy(
  base44: Base44Client,
  sourceFileId: string,
): Promise<EntityRecord["Policy"]> {
  const [policy] = await base44.asServiceRole.entities.Policy.filter(
    { source_file_id: sourceFileId },
    "-created_date",
    2,
  );
  if (!policy) {
    throw new HostedFunctionError("DRIVE_FILE_NOT_ALLOWLISTED");
  }
  return policy;
}

serveBase44Function(async (request) => {
  const base44 = createClientFromRequest(request);
  const body = await readJsonObject(request);
  const payload = readAutomationPayload(body);
  const policy = await findPolicy(base44, readEventFileId(payload));
  const result = await ingestPolicyVersion(
    {
      event: payload as unknown as DriveAutomationEvent,
      eventId: crypto.randomUUID(),
      policy: {
        id: policy.id,
        organizationId: policy.organization_id,
        sourceFileId: policy.source_file_id,
      },
    },
    new GoogleDriveExporter(base44),
    new Base44PolicyVersions(base44),
  );
  if (result.kind === "created") {
    await invokeFunction(
      base44.asServiceRole.functions,
      "extractPolicyClauses",
      { policy_version_id: result.version.id },
    );
  }
  return Response.json(result);
});
