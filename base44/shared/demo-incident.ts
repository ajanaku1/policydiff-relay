import {
  buildPolicyVersionDedupeKey,
  canonicalizePolicyText,
  sha256Hex,
} from "./ingestion.ts";
import type { WorkflowActor } from "./workflow.ts";

interface IncidentInput {
  guidance: Array<{ id: string; question: string }>;
  oldVersionId: string;
  policyId: string;
  sourceFileId: string;
}

interface IncidentClause {
  body: string;
  bodyHash: string;
  changed: boolean;
  clauseKey: string;
  dedupeKey: string;
  heading: string;
  ordinal: number;
}

interface IncidentFinding {
  classification: "affected" | "still_valid" | "uncertain";
  confidence: number;
  correctionDraft: string;
  dedupeKey: string;
  evidenceClauseKeys: string[];
  guidanceId: string;
  rationale: string;
  requiresTask: boolean;
}

export interface DemoIncidentPlan {
  clauses: IncidentClause[];
  delta: { dedupeKey: string; summary: string };
  findings: IncidentFinding[];
  oldVersionId: string;
  organizationId: string;
  policyId: string;
  replay: { candidateCount: number; dedupeKey: string };
  sourceFileId: string;
  version: {
    contentHash: string;
    contentText: string;
    dedupeKey: string;
    sourceRevision: string;
  };
}

const clauseSource = [
  {
    body: "Applicants must be at least 21 years old on the date of enrollment.",
    changed: true,
    clauseKey: "4.2",
    heading: "Eligibility age",
    ordinal: 1,
  },
  {
    body: "The 30-day waiting period begins on the confirmed application date.",
    changed: false,
    clauseKey: "7.1",
    heading: "Waiting period",
    ordinal: 2,
  },
  {
    body: "Contractor eligibility follows the applicable written agreement.",
    changed: false,
    clauseKey: "9.3",
    heading: "Contractor classification",
    ordinal: 3,
  },
] as const;

const findingSource = [
  {
    classification: "affected",
    confidence: 0.96,
    correctionDraft:
      "A policy update changed the minimum enrollment age from 18 to 21. The earlier answer is no longer current. Eligibility begins at age 21.",
    evidenceClauseKeys: ["4.2"],
    question: "Can a 19-year-old applicant enroll this summer?",
    rationale:
      "The answer cites §4.2 directly, and the applicant now falls below the revised age threshold.",
    requiresTask: false,
  },
  {
    classification: "still_valid",
    confidence: 0.99,
    correctionDraft: "",
    evidenceClauseKeys: [],
    question: "When does the waiting period begin?",
    rationale: "The answer depends on §7.1, which did not change.",
    requiresTask: false,
  },
  {
    classification: "uncertain",
    confidence: 0.58,
    correctionDraft: "",
    evidenceClauseKeys: ["4.2"],
    question: "Does the age threshold apply to contractors?",
    rationale:
      "The age clause changed, but the policy does not define whether contractors are applicants.",
    requiresTask: true,
  },
] as const;

export async function buildDemoIncidentPlan(
  actor: WorkflowActor,
  input: IncidentInput,
): Promise<DemoIncidentPlan> {
  const guidance = matchGuidance(input.guidance);
  const contentText = canonicalizePolicyText(buildContentText());
  const contentHash = await sha256Hex(contentText);
  const clauses = await buildClauses(actor.organizationId, contentHash);
  const findings = buildFindings(actor.organizationId, contentHash, guidance);
  return assemblePlan(actor, input, contentText, contentHash, clauses, findings);
}

function buildFindings(
  organizationId: string,
  contentHash: string,
  guidance: Map<string, string>,
): IncidentFinding[] {
  return findingSource.map((source) => ({
    ...source,
    dedupeKey: `${organizationId}:${guidance.get(source.question)}:${contentHash}`,
    evidenceClauseKeys: [...source.evidenceClauseKeys],
    guidanceId: guidance.get(source.question) as string,
  }));
}

function assemblePlan(
  actor: WorkflowActor,
  input: IncidentInput,
  contentText: string,
  contentHash: string,
  clauses: IncidentClause[],
  findings: IncidentFinding[],
): DemoIncidentPlan {
  return {
    clauses,
    delta: {
      dedupeKey: `${input.oldVersionId}:${contentHash}:delta`,
      summary:
        "The minimum enrollment age moved from 18 to 21. Guidance tied to §4.2 requires targeted review.",
    },
    findings,
    oldVersionId: input.oldVersionId,
    organizationId: actor.organizationId,
    policyId: input.policyId,
    replay: {
      candidateCount: findings.length,
      dedupeKey: `${input.oldVersionId}:${contentHash}:replay`,
    },
    sourceFileId: input.sourceFileId,
    version: {
      contentHash,
      contentText,
      dedupeKey: buildPolicyVersionDedupeKey(input.sourceFileId, contentHash),
      sourceRevision: "demo-v5",
    },
  };
}

function matchGuidance(
  guidance: IncidentInput["guidance"],
): Map<string, string> {
  const byQuestion = new Map(guidance.map((item) => [item.question, item.id]));
  if (findingSource.some((finding) => !byQuestion.has(finding.question))) {
    throw new Error("DEMO_GUIDANCE_INCOMPLETE");
  }
  return byQuestion;
}

function buildContentText(): string {
  return clauseSource
    .map((clause) => `§${clause.clauseKey} ${clause.heading}\n${clause.body}`)
    .join("\n\n");
}

async function buildClauses(
  organizationId: string,
  contentHash: string,
): Promise<IncidentClause[]> {
  return Promise.all(clauseSource.map(async (clause) => ({
    ...clause,
    bodyHash: await sha256Hex(clause.body),
    dedupeKey: `${organizationId}:${contentHash}:${clause.clauseKey}`,
  })));
}
