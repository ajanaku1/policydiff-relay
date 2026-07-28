import assert from "node:assert/strict";
import test from "node:test";

import { reviewDecision } from "../../src/domain/reviewDecision.ts";
import type { FindingView } from "../../src/types/controlRoom.ts";

const finding: FindingView = {
  classification: "uncertain",
  correctionDraft: "",
  evidence: [],
  guidanceId: "guidance-1",
  id: "finding-1",
  initials: "AL",
  label: "Guidance 03",
  originalAnswer: "Prior answer",
  question: "Does this apply?",
  rationale: "Evidence is missing.",
  status: "pending_review",
};

test("does not offer a duplicate reviewer task when one is open", () => {
  const decision = reviewDecision({ ...finding, taskStatus: "open" });

  assert.equal(decision.kind, "done");
  assert.equal(decision.label, "Reviewer task open");
});

test("offers delivery only after approval has created a queued delivery", () => {
  const decision = reviewDecision({
    ...finding,
    classification: "affected",
    deliveryId: "delivery-1",
    deliveryStatus: "queued",
    status: "approved",
  });

  assert.equal(decision.kind, "send");
});

test("reports sent delivery as waiting for acknowledgement", () => {
  const decision = reviewDecision({
    ...finding,
    classification: "affected",
    deliveryId: "delivery-1",
    deliveryStatus: "sent",
    status: "approved",
  });

  assert.equal(decision.kind, "done");
  assert.equal(decision.label, "Awaiting acknowledgement");
});
