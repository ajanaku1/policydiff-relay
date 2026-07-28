import {
  createClientFromRequest,
  type Base44Client,
  type EntityRecord,
} from "@base44/sdk";

import {
  type AcknowledgementRecord,
  type AcknowledgementRepository,
  acknowledgeDelivery,
} from "../../shared/closure.ts";
import {
  readJsonObject,
  readRequiredString,
  serveBase44Function,
} from "../../shared/base44-http.ts";

class Base44Acknowledgements implements AcknowledgementRepository {
  constructor(private readonly base44: Base44Client) {}

  async consumeTokenAndCreate(
    tokenHash: string,
    acknowledgedAt: string,
  ): Promise<AcknowledgementRecord | undefined> {
    const secret = await this.findSecret(tokenHash);
    if (!secret || secret.used_at || secret.expires_at <= acknowledgedAt) {
      return undefined;
    }
    if (!await this.claimDelivery(secret.delivery_id)) {
      return undefined;
    }
    try {
      const record = await this.createAcknowledgement(secret, acknowledgedAt);
      await this.base44.asServiceRole.entities.DeliverySecret.update(secret.id, {
        used_at: acknowledgedAt,
      });
      return record;
    } catch (error) {
      await this.releaseDelivery(secret.delivery_id);
      throw error;
    }
  }

  private async claimDelivery(deliveryId: string): Promise<boolean> {
    const result =
      await this.base44.asServiceRole.entities.Delivery.updateMany(
        { id: deliveryId, status: "sent" },
        { $set: { status: "acknowledged" } },
      );
    return result.updated === 1;
  }

  private async createAcknowledgement(
    secret: EntityRecord["DeliverySecret"],
    acknowledgedAt: string,
  ): Promise<AcknowledgementRecord> {
    const record =
      await this.base44.asServiceRole.entities.Acknowledgement.create({
        acknowledged_at: acknowledgedAt,
        dedupe_key: secret.delivery_id,
        delivery_id: secret.delivery_id,
        organization_id: secret.organization_id,
      });
    return {
      acknowledgedAt: record.acknowledged_at,
      deliveryId: record.delivery_id,
      id: record.id,
      organizationId: record.organization_id,
    };
  }

  private async releaseDelivery(deliveryId: string): Promise<void> {
    await this.base44.asServiceRole.entities.Delivery.updateMany(
      { id: deliveryId, status: "acknowledged" },
      { $set: { status: "sent" } },
    );
  }

  private async findSecret(
    tokenHash: string,
  ): Promise<EntityRecord["DeliverySecret"] | undefined> {
    const [secret] =
      await this.base44.asServiceRole.entities.DeliverySecret.filter(
        { token_hash: tokenHash },
        "-created_date",
        1,
      );
    return secret;
  }
}

async function readToken(request: Request): Promise<string> {
  if (request.method === "GET") {
    return readRequiredString(
      { token: new URL(request.url).searchParams.get("token") },
      "token",
    );
  }
  return readRequiredString(await readJsonObject(request), "token");
}

serveBase44Function(async (request) => {
  const base44 = createClientFromRequest(request);
  const acknowledgement = await acknowledgeDelivery(
    await readToken(request),
    new Date().toISOString(),
    new Base44Acknowledgements(base44),
  );
  return Response.json({
    acknowledged_at: acknowledgement.acknowledgedAt,
    delivery_id: acknowledgement.deliveryId,
  });
});
