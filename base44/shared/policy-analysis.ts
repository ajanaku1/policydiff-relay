export type ClauseCandidate = {
  body: string;
  clauseKey: string;
  heading: string;
};

export type PolicyClause = ClauseCandidate & {
  bodyHash: string;
  id: string;
  versionId: string;
};

export type ClauseChange = {
  clauseKey: string;
  newClauseId?: string;
  oldClauseId?: string;
  type: "added" | "modified" | "removed";
};

export type PolicyDeltaCandidate = {
  changedClauses: ClauseChange[];
  materiality: "material" | "non_material";
  newVersionId: string;
  oldVersionId: string;
};

export type GuidanceDependency = {
  audience: string;
  citedClauseIds: string[];
  effectiveOn: string;
  id: string;
  policyVersionId: string;
};

export type ReplayFilter = {
  allowedAudiences: string[];
  changedOldClauseIds: string[];
  effectiveThrough: string;
  oldVersionId: string;
};

export type ReplaySelection = {
  guidance: GuidanceDependency;
  reasons: string[];
};

export type ReplayCandidate = {
  classification: "affected" | "still_valid" | "uncertain";
  evidenceClauseIds: string[];
  newVersionId: string;
  oldVersionId: string;
  rationale: string;
};

export type ReplayValidationContext = {
  allowedEvidenceClauseIds: string[];
  newVersionId: string;
  oldVersionId: string;
};

type AnalysisErrorCode = "CLAUSE_OUTPUT_INVALID" | "REPLAY_OUTPUT_INVALID";

export class PolicyAnalysisError extends Error {
  readonly code: AnalysisErrorCode;

  constructor(code: AnalysisErrorCode) {
    super(code);
    this.name = "PolicyAnalysisError";
    this.code = code;
  }
}

export function validateClauseCandidates(output: unknown): ClauseCandidate[] {
  if (!isRecord(output) || !Array.isArray(output.clauses)) {
    throw new PolicyAnalysisError("CLAUSE_OUTPUT_INVALID");
  }
  const candidates = output.clauses.map(readClauseCandidate);
  const uniqueKeys = new Set(candidates.map((clause) => clause.clauseKey));
  if (candidates.length === 0 || uniqueKeys.size !== candidates.length) {
    throw new PolicyAnalysisError("CLAUSE_OUTPUT_INVALID");
  }
  return candidates;
}

export function compareClauseSets(
  oldVersionId: string,
  newVersionId: string,
  oldClauses: PolicyClause[],
  newClauses: PolicyClause[],
): PolicyDeltaCandidate {
  const oldByKey = new Map(oldClauses.map((clause) => [clause.clauseKey, clause]));
  const newByKey = new Map(newClauses.map((clause) => [clause.clauseKey, clause]));
  const allKeys = new Set([...oldByKey.keys(), ...newByKey.keys()]);
  const changedClauses = Array.from(allKeys)
    .map((key) => compareClause(key, oldByKey.get(key), newByKey.get(key)))
    .filter((change): change is ClauseChange => change !== undefined);

  return {
    changedClauses,
    materiality: changedClauses.length > 0 ? "material" : "non_material",
    newVersionId,
    oldVersionId,
  };
}

export function selectReplayCandidates(
  guidance: GuidanceDependency[],
  filter: ReplayFilter,
): ReplaySelection[] {
  const changedClauses = new Set(filter.changedOldClauseIds);
  return guidance
    .filter((item) => item.policyVersionId === filter.oldVersionId)
    .filter((item) => filter.allowedAudiences.includes(item.audience))
    .filter((item) => item.effectiveOn <= filter.effectiveThrough)
    .filter((item) =>
      item.citedClauseIds.some((clauseId) => changedClauses.has(clauseId)),
    )
    .map((item) => ({
      guidance: item,
      reasons: ["version", "audience", "date", "changed_clause"],
    }));
}

export function validateReplayCandidate(
  output: unknown,
  context: ReplayValidationContext,
): ReplayCandidate {
  if (!isReplayOutput(output, context)) {
    throw new PolicyAnalysisError("REPLAY_OUTPUT_INVALID");
  }
  return {
    classification: output.classification,
    evidenceClauseIds: output.evidence_clause_ids,
    newVersionId: output.new_version_id,
    oldVersionId: output.old_version_id,
    rationale: output.rationale,
  };
}

function readClauseCandidate(value: unknown): ClauseCandidate {
  if (!isRecord(value)) {
    throw new PolicyAnalysisError("CLAUSE_OUTPUT_INVALID");
  }
  const heading = readRequiredString(value.heading, "CLAUSE_OUTPUT_INVALID");
  return {
    body: readRequiredString(value.body, "CLAUSE_OUTPUT_INVALID"),
    clauseKey: stableClauseKey(
      heading,
      readRequiredString(value.clause_key, "CLAUSE_OUTPUT_INVALID"),
    ),
    heading,
  };
}

function stableClauseKey(heading: string, fallback: string): string {
  const section = heading.match(/^\s*§?\s*(\d+(?:\.\d+)+)\b/);
  return section?.[1] ?? fallback;
}

function compareClause(
  clauseKey: string,
  oldClause: PolicyClause | undefined,
  newClause: PolicyClause | undefined,
): ClauseChange | undefined {
  if (!oldClause && newClause) {
    return { clauseKey, newClauseId: newClause.id, type: "added" };
  }
  if (oldClause && !newClause) {
    return { clauseKey, oldClauseId: oldClause.id, type: "removed" };
  }
  if (oldClause && newClause && oldClause.bodyHash !== newClause.bodyHash) {
    return {
      clauseKey,
      newClauseId: newClause.id,
      oldClauseId: oldClause.id,
      type: "modified",
    };
  }
  return undefined;
}

function isReplayOutput(
  value: unknown,
  context: ReplayValidationContext,
): value is {
  classification: ReplayCandidate["classification"];
  evidence_clause_ids: string[];
  new_version_id: string;
  old_version_id: string;
  rationale: string;
} {
  if (!isRecord(value) || !isClassification(value.classification)) {
    return false;
  }
  if (
    value.old_version_id !== context.oldVersionId ||
    value.new_version_id !== context.newVersionId
  ) {
    return false;
  }
  if (!isNonEmptyStringArray(value.evidence_clause_ids)) {
    return false;
  }
  const allowedEvidence = new Set(context.allowedEvidenceClauseIds);
  return (
    value.evidence_clause_ids.every((id) => allowedEvidence.has(id)) &&
    typeof value.rationale === "string" &&
    value.rationale.trim().length > 0
  );
}

function isClassification(
  value: unknown,
): value is ReplayCandidate["classification"] {
  return (
    value === "affected" || value === "still_valid" || value === "uncertain"
  );
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string" && item.length > 0)
  );
}

function readRequiredString(
  value: unknown,
  errorCode: AnalysisErrorCode,
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PolicyAnalysisError(errorCode);
  }
  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
