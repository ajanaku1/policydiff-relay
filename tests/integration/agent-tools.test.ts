import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type AgentFindingReader,
  type AgentFindingView,
  type ReviewerTaskRecord,
  type ReviewerTaskRepository,
  createReviewerTask,
  explainFinding,
} from "../../base44/shared/agent-tools.ts";

class FixedFindingReader implements AgentFindingReader {
  async load(): Promise<AgentFindingView> {
    const storedFinding: AgentFindingView & { recipientEmail: string } = {
      classification: "affected",
      evidence: [
        {
          clauseId: "new-clause-eligibility",
          excerpt: "Employees aged 21 or older are eligible.",
        },
      ],
      findingId: "finding-1",
      organizationId: "organization-1",
      recipientEmail: "casey@example.test",
      rationale: "The minimum age changed from 18 to 21.",
      status: "pending_review",
    };
    return storedFinding;
  }
}

class MemoryReviewerTasks implements ReviewerTaskRepository {
  task: ReviewerTaskRecord | undefined;

  async createOrGet(input: {
    createdByUserId: string;
    findingId: string;
    note: string;
    organizationId: string;
  }): Promise<ReviewerTaskRecord> {
    this.task ??= {
      createdByUserId: input.createdByUserId,
      findingId: input.findingId,
      id: "review-task-1",
      note: input.note,
      organizationId: input.organizationId,
      status: "open",
    };
    return this.task;
  }
}

const staffActor = {
  id: "staff-1",
  organizationId: "organization-1",
  policyRole: "staff" as const,
};

describe("policy operations agent tools", () => {
  it("returns a redacted, evidence-bound finding explanation", async () => {
    const explanation = await explainFinding(
      {
        actor: staffActor,
        findingId: "finding-1",
      },
      new FixedFindingReader(),
    );

    assert.equal(explanation.classification, "affected");
    assert.equal(explanation.evidence[0]?.clauseId, "new-clause-eligibility");
    assert.equal("recipientEmail" in explanation, false);
    assert.equal("correctionText" in explanation, false);
  });

  it("creates one reviewer task without exposing generic entity mutation", async () => {
    const tasks = new MemoryReviewerTasks();
    const input = {
      actor: staffActor,
      findingId: "finding-1",
      findingOrganizationId: "organization-1",
      note: "Please verify the audience and correction wording.",
    };

    const first = await createReviewerTask(input, tasks);
    const duplicate = await createReviewerTask(input, tasks);

    assert.equal(first.id, duplicate.id);
    assert.equal(first.status, "open");
  });

  it("rejects cross-organization agent tool requests", async () => {
    await assert.rejects(
      createReviewerTask(
        {
          actor: staffActor,
          findingId: "finding-2",
          findingOrganizationId: "organization-2",
          note: "Out of scope.",
        },
        new MemoryReviewerTasks(),
      ),
      { code: "AGENT_ORGANIZATION_MISMATCH" },
    );
  });
});
