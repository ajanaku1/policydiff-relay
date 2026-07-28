import type { WorkflowActor } from "./workflow.ts";

export type AgentFindingView = {
  classification: "affected" | "still_valid" | "uncertain";
  evidence: Array<{
    clauseId: string;
    excerpt: string;
  }>;
  findingId: string;
  organizationId: string;
  rationale: string;
  status: "approved" | "dismissed" | "pending_review" | "superseded";
};

export interface AgentFindingReader {
  load(findingId: string): Promise<AgentFindingView>;
}

export type ReviewerTaskRecord = {
  createdByUserId: string;
  findingId: string;
  id: string;
  note: string;
  organizationId: string;
  status: "open";
};

export interface ReviewerTaskRepository {
  createOrGet(input: {
    createdByUserId: string;
    findingId: string;
    note: string;
    organizationId: string;
  }): Promise<ReviewerTaskRecord>;
}

export class AgentToolError extends Error {
  readonly code = "AGENT_ORGANIZATION_MISMATCH";

  constructor() {
    super("AGENT_ORGANIZATION_MISMATCH");
    this.name = "AgentToolError";
  }
}

export async function explainFinding(
  input: {
    actor: WorkflowActor;
    findingId: string;
  },
  reader: AgentFindingReader,
): Promise<AgentFindingView> {
  const finding = await reader.load(input.findingId);
  assertSameOrganization(input.actor, finding.organizationId);
  return {
    classification: finding.classification,
    evidence: finding.evidence,
    findingId: finding.findingId,
    organizationId: finding.organizationId,
    rationale: finding.rationale,
    status: finding.status,
  };
}

export async function createReviewerTask(
  input: {
    actor: WorkflowActor;
    findingId: string;
    findingOrganizationId: string;
    note: string;
  },
  tasks: ReviewerTaskRepository,
): Promise<ReviewerTaskRecord> {
  assertSameOrganization(input.actor, input.findingOrganizationId);
  return tasks.createOrGet({
    createdByUserId: input.actor.id,
    findingId: input.findingId,
    note: input.note,
    organizationId: input.actor.organizationId,
  });
}

function assertSameOrganization(
  actor: WorkflowActor,
  organizationId: string,
): void {
  if (actor.organizationId !== organizationId) {
    throw new AgentToolError();
  }
}
