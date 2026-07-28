import assert from "node:assert/strict";
import { test } from "node:test";

import {
  readAcknowledgementToken,
} from "../../src/domain/acknowledgementRoute.ts";

test("reads the single-use token only from the acknowledgement route", () => {
  assert.equal(
    readAcknowledgementToken(
      "https://policydiff.example/acknowledge?token=delivery.signature",
    ),
    "delivery.signature",
  );
  assert.equal(
    readAcknowledgementToken(
      "https://policydiff.example/?token=delivery.signature",
    ),
    undefined,
  );
  assert.equal(
    readAcknowledgementToken(
      "https://policydiff.example/acknowledge?token=",
    ),
    undefined,
  );
});
