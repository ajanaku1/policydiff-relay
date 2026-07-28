import type {
  Classification,
  FindingStatus,
} from "../types/controlRoom.ts";

export interface FindingExplanation {
  classification: Classification;
  evidence: Array<{
    clauseId: string;
    excerpt: string;
  }>;
  findingId: string;
  organizationId: string;
  rationale: string;
  status: FindingStatus;
}

export function formatFindingExplanation(
  explanation: FindingExplanation,
): string {
  const evidence = explanation.evidence
    .map(({ excerpt }) => `“${excerpt}”`)
    .join(" ");
  const prefix = `This finding is ${explanation.classification.replace("_", " ")}.`;
  return evidence
    ? `${prefix} ${explanation.rationale} Evidence: ${evidence}`
    : `${prefix} ${explanation.rationale}`;
}

export function isGroundedAgentAnswer(
  answer: string,
  explanation: FindingExplanation,
): boolean {
  const normalized = normalize(answer);
  return !hasRetrievalFailure(normalized) &&
    normalized.includes(normalize(explanation.classification)) &&
    normalized.includes(normalize(explanation.rationale)) &&
    explanation.evidence.every(({ excerpt }) =>
      normalized.includes(normalize(excerpt))
    );
}

export function isGroundedTaskConfirmation(
  answer: string,
  explanation: FindingExplanation,
): boolean {
  const normalized = normalize(answer);
  const confirmsTask = normalized.includes("task") &&
    ["assigned", "created", "open", "opened"].some((word) =>
      normalized.includes(word)
    );
  return confirmsTask && isGroundedAgentAnswer(answer, explanation);
}

export function isReviewerTaskRequest(question: string): boolean {
  const normalized = question.toLowerCase();
  return normalized.includes("task") &&
    ["assign", "create", "open"].some((verb) => normalized.includes(verb));
}

export function toPlainAgentAnswer(answer: string): string {
  return answer
    .replaceAll(/\*{1,2}/g, "")
    .replaceAll(/^#{1,6}\s*/gm, "")
    .replaceAll(/^-\s*/gm, "")
    .trim();
}

function normalize(value: string): string {
  return value.toLowerCase().replaceAll(/\s+/g, " ").trim();
}

function hasRetrievalFailure(answer: string): boolean {
  return [
    "cannot retrieve",
    "couldn't retrieve",
    "issue retrieving",
    "unable to retrieve",
  ].some((phrase) => answer.includes(phrase));
}
