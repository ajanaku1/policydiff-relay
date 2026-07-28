import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatFindingExplanation,
  isGroundedAgentAnswer,
  isGroundedTaskConfirmation,
  isReviewerTaskRequest,
  toPlainAgentAnswer,
} from "../../src/domain/policyOpsAnswer.ts";

const explanation = {
  classification: "uncertain" as const,
  evidence: [
    {
      clauseId: "clause-4-2",
      excerpt: "Applicants must be at least 21 years old on enrollment.",
    },
  ],
  findingId: "finding-1",
  organizationId: "organization-1",
  rationale:
    "The policy does not define whether contractors are applicants.",
  status: "pending_review" as const,
};

test("formats a finding explanation from trusted evidence", () => {
  assert.equal(
    formatFindingExplanation(explanation),
    "This finding is uncertain. The policy does not define whether contractors are applicants. Evidence: “Applicants must be at least 21 years old on enrollment.”",
  );
});

test("accepts only agent replies grounded in the trusted explanation", () => {
  assert.equal(
    isGroundedAgentAnswer(
      "Uncertain. The policy does not define whether contractors are applicants. Applicants must be at least 21 years old on enrollment.",
      explanation,
    ),
    true,
  );
  assert.equal(
    isGroundedAgentAnswer(
      "There was an issue retrieving the finding.",
      explanation,
    ),
    false,
  );
  assert.equal(
    isGroundedAgentAnswer(
      "I am unable to retrieve the finding. Uncertain. The policy does not define whether contractors are applicants. Applicants must be at least 21 years old on enrollment.",
      explanation,
    ),
    false,
  );
});

test("requires grounded evidence in an agent task confirmation", () => {
  assert.equal(
    isGroundedTaskConfirmation(
      "Task opened. Uncertain. The policy does not define whether contractors are applicants. Applicants must be at least 21 years old on enrollment.",
      explanation,
    ),
    true,
  );
  assert.equal(
    isGroundedTaskConfirmation("Reviewer task opened.", explanation),
    false,
  );
});

test("recognizes only explicit reviewer task requests", () => {
  assert.equal(
    isReviewerTaskRequest("Please open a reviewer task for this gap."),
    true,
  );
  assert.equal(
    isReviewerTaskRequest("What evidence is missing?"),
    false,
  );
});

test("removes markdown markers from a validated agent reply", () => {
  assert.equal(
    toPlainAgentAnswer(
      "### Classification\n**Uncertain**\n- Evidence: Applicants are 21.",
    ),
    "Classification\nUncertain\nEvidence: Applicants are 21.",
  );
});
