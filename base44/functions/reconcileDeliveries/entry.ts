import {
  createClientFromRequest,
  type Base44Client,
  type EntityRecord,
} from "@base44/sdk";

import { serveBase44Function } from "../../shared/base44-http.ts";
import { decideDeliveryAction } from "../../shared/workflow.ts";

async function reconcileDelivery(
  base44: Base44Client,
  delivery: EntityRecord["Delivery"],
  now: string,
): Promise<string> {
  const action = decideDeliveryAction(
    {
      ...(delivery.lease_expires_at
        ? { leaseExpiresAt: delivery.lease_expires_at }
        : {}),
      ...(delivery.next_attempt_at
        ? { nextAttemptAt: delivery.next_attempt_at }
        : {}),
      status: delivery.status,
    },
    now,
  );
  if (action === "send") {
    await invokeSend(base44, delivery.id);
  }
  if (action === "reconcile") {
    await base44.asServiceRole.entities.Delivery.update(delivery.id, {
      safe_error_code: "AMBIGUOUS_SEND_REQUIRES_REVIEW",
      status: "failed",
    });
  }
  return action;
}

async function invokeSend(
  base44: Base44Client,
  deliveryId: string,
): Promise<void> {
  const response = await base44.asServiceRole.functions.fetch("sendCorrection", {
    body: JSON.stringify({ delivery_id: deliveryId }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("DELIVERY_RETRY_INVOCATION_FAILED");
  }
}

serveBase44Function(async (request) => {
  const base44 = createClientFromRequest(request);
  const deliveries = await base44.asServiceRole.entities.Delivery.filter(
    { status: ["queued", "retry_wait", "sending"] },
    "next_attempt_at",
    500,
  );
  const now = new Date().toISOString();
  const outcomes: Array<{ action: string; delivery_id: string }> = [];
  for (const delivery of deliveries) {
    const action = await reconcileDelivery(base44, delivery, now);
    outcomes.push({ action, delivery_id: delivery.id });
  }
  return Response.json({ outcomes });
});
