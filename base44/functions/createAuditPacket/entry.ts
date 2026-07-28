import {
  createClientFromRequest,
  type Base44Client,
} from "@base44/sdk";

import {
  type AuditFileStore,
  type AuditTrail,
  type AuditTrailSource,
  createAuditPacket,
} from "../../shared/closure.ts";
import {
  buildWorkflowActor,
  readJsonObject,
  readRequiredString,
  serveBase44Function,
} from "../../shared/base44-http.ts";

class Base44AuditTrail implements AuditTrailSource {
  constructor(private readonly base44: Base44Client) {}

  async load(
    organizationId: string,
    trailCutoffAt: string,
  ): Promise<AuditTrail> {
    const query = {
      created_date: { $lte: trailCutoffAt },
      organization_id: organizationId,
    };
    const [versions, findings, approvals, deliveries, acknowledgements] =
      await Promise.all([
        this.base44.asServiceRole.entities.PolicyVersion.filter(query, "created_date", 500),
        this.base44.asServiceRole.entities.Finding.filter(query, "created_date", 500),
        this.base44.asServiceRole.entities.Approval.filter(query, "created_date", 500),
        this.base44.asServiceRole.entities.Delivery.filter(query, "created_date", 500),
        this.base44.asServiceRole.entities.Acknowledgement.filter(
          query,
          "created_date",
          500,
        ),
      ]);
    return {
      acknowledgements: acknowledgements.map(toPlainRecord),
      approvals: approvals.map(toPlainRecord),
      deliveries: deliveries.map(toPlainRecord),
      findings: findings.map(toPlainRecord),
      versions: versions.map(toPlainRecord),
    };
  }
}

class Base44AuditFiles implements AuditFileStore {
  constructor(private readonly base44: Base44Client) {}

  async uploadPrivate(content: string): Promise<string> {
    const result =
      await this.base44.asServiceRole.integrations.Core.UploadPrivateFile({
        file: new File(
          [content],
          `policydiff-audit-${new Date().toISOString()}.json`,
          { type: "application/json" },
        ),
      });
    return result.file_uri;
  }

  async createSignedUrl(fileUri: string, expiresIn: number): Promise<string> {
    const result =
      await this.base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
        expires_in: expiresIn,
        file_uri: fileUri,
      });
    return result.signed_url;
  }
}

function toPlainRecord(value: object): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

serveBase44Function(async (request) => {
  const base44 = createClientFromRequest(request);
  const actor = buildWorkflowActor(await base44.auth.me());
  const body = await readJsonObject(request);
  const organizationId =
    readRequiredString(body, "organization_id");
  const trailCutoffAt = readRequiredString(body, "trail_cutoff_at");
  const result = await createAuditPacket(
    { actor, organizationId, trailCutoffAt },
    new Base44AuditTrail(base44),
    new Base44AuditFiles(base44),
  );
  const dedupeKey =
    `${organizationId}:${actor.id}:${trailCutoffAt}`;
  await base44.asServiceRole.entities.AuditPacket.create({
    dedupe_key: dedupeKey,
    organization_id: organizationId,
    packet_hash: result.packetHash,
    private_file_uri: result.privateFileUri,
    requested_by_user_id: actor.id,
    trail_cutoff_at: trailCutoffAt,
  });
  return Response.json({
    packet_hash: result.packetHash,
    signed_url: result.signedUrl,
  });
});
