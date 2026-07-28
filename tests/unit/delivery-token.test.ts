import assert from "node:assert/strict";
import { it } from "node:test";

import {
  createDeliveryToken,
} from "../../base44/shared/delivery-token.ts";

it("derives a stable opaque token from the delivery and server secret", async () => {
  const first = await createDeliveryToken("delivery-1", "server-secret");
  const retry = await createDeliveryToken("delivery-1", "server-secret");
  const other = await createDeliveryToken("delivery-2", "server-secret");

  assert.equal(first, retry);
  assert.notEqual(first, other);
  assert.match(first, /^delivery-1\.[a-f0-9]{64}$/);
  assert.equal(first.includes("server-secret"), false);
});
