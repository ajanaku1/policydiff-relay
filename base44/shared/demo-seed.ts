import { createSafeError } from "./base44-error.ts";
import {
  buildPolicyVersionDedupeKey,
  canonicalizePolicyText,
  sha256Hex,
} from "./ingestion.ts";
import type { WorkflowActor } from "./workflow.ts";

export interface DemoClausePlan {
  body: string;
  clauseKey: string;
  dedupeKey: string;
  heading: string;
  ordinal: number;
}

export interface DemoGuidancePlan {
  answer: string;
  audience: string;
  citedClauseKeys: string[];
  effectiveOn: string;
  label: "affected" | "still_valid" | "uncertain";
  question: string;
  recipientEmail: string;
  recipientName: string;
}

export interface DemoSeedPlan {
  clauses: DemoClausePlan[];
  guidance: DemoGuidancePlan[];
  organization: { id: string; name: string; slug: string };
  policy: { dedupeKey: string; name: string; sourceFileId: string };
  version: {
    contentHash: string;
    contentText: string;
    dedupeKey: string;
    sourceRevision: string;
  };
}

const baselineClauses = [
  {
    body: "Applicants must be at least 18 years old on the date of enrollment.",
    clauseKey: "4.2",
    heading: "Eligibility age",
    ordinal: 1,
  },
  {
    body: "The 30-day waiting period begins on the confirmed application date.",
    clauseKey: "7.1",
    heading: "Waiting period",
    ordinal: 2,
  },
  {
    body: "Contractor eligibility follows the applicable written agreement.",
    clauseKey: "9.3",
    heading: "Contractor classification",
    ordinal: 3,
  },
] as const;

const demoGuidance: DemoGuidancePlan[] = [
  {
    answer: "Yes. At 19, you meet the policy's minimum age requirement.",
    audience: "applicant",
    citedClauseKeys: ["4.2"],
    effectiveOn: "2026-06-01",
    label: "affected",
    question: "Can a 19-year-old applicant enroll this summer?",
    recipientEmail: "casey.morgan@example.test",
    recipientName: "Casey Morgan",
  },
  {
    answer: "The 30-day waiting period starts on the confirmed application date.",
    audience: "applicant",
    citedClauseKeys: ["7.1"],
    effectiveOn: "2026-06-01",
    label: "still_valid",
    question: "When does the waiting period begin?",
    recipientEmail: "rowan.kim@example.test",
    recipientName: "Rowan Kim",
  },
  {
    answer: "Contractors follow the same age rule unless their agreement says otherwise.",
    audience: "contractor",
    citedClauseKeys: ["4.2", "9.3"],
    effectiveOn: "2026-06-01",
    label: "uncertain",
    question: "Does the age threshold apply to contractors?",
    recipientEmail: "amari.lee@example.test",
    recipientName: "Amari Lee",
  },
];

export async function buildDemoSeedPlan(
  actor: WorkflowActor,
  sourceFileId: string,
  deliveryRecipientEmail = "casey.morgan@example.test",
): Promise<DemoSeedPlan> {
  assertSeedAccess(actor, sourceFileId);
  const fileId = sourceFileId.trim();
  const contentText = canonicalizePolicyText(buildBaselineText());
  const contentHash = await sha256Hex(contentText);
  const policyDedupeKey = `${actor.organizationId}:eligibility-policy`;
  return {
    clauses: buildClauses(actor.organizationId, contentHash),
    guidance: buildGuidance(deliveryRecipientEmail),
    organization: buildOrganization(actor.organizationId),
    policy: {
      dedupeKey: policyDedupeKey,
      name: "Eligibility Policy",
      sourceFileId: fileId,
    },
    version: {
      contentHash,
      contentText,
      dedupeKey: buildPolicyVersionDedupeKey(fileId, contentHash),
      sourceRevision: "demo-v4",
    },
  };
}

function buildOrganization(organizationId: string): DemoSeedPlan["organization"] {
  return {
    id: organizationId,
    name: "Northstar Benefits",
    slug: "northstar-benefits",
  };
}

function assertSeedAccess(actor: WorkflowActor, sourceFileId: string): void {
  if (actor.policyRole !== "policy_admin") {
    throw createSafeError("POLICY_ADMIN_REQUIRED");
  }
  if (!sourceFileId.trim()) {
    throw createSafeError("DRIVE_FILE_ID_REQUIRED");
  }
}

function buildBaselineText(): string {
  return baselineClauses
    .map((clause) => `§${clause.clauseKey} ${clause.heading}\n${clause.body}`)
    .join("\n\n");
}

function buildClauses(
  organizationId: string,
  contentHash: string,
): DemoClausePlan[] {
  return baselineClauses.map((clause) => ({
    ...clause,
    dedupeKey: `${organizationId}:${contentHash}:${clause.clauseKey}`,
  }));
}

function buildGuidance(deliveryRecipientEmail: string): DemoGuidancePlan[] {
  return demoGuidance.map((guidance) => ({
    ...guidance,
    citedClauseKeys: [...guidance.citedClauseKeys],
    recipientEmail: guidance.label === "affected"
      ? deliveryRecipientEmail
      : guidance.recipientEmail,
  }));
}
