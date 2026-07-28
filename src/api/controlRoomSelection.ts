type IncidentDelta = {
  id: string;
  new_version_id: string;
};

type IncidentFinding = {
  new_version_id: string;
};

type ReplayJobRecord = {
  candidate_count?: number;
  completed_count?: number;
  id: string;
  status: "pending" | "running" | "retry_wait" | "completed" | "failed";
};

export function selectIncidentDelta<Delta extends IncidentDelta>(
  deltas: Delta[],
  findings: IncidentFinding[],
  activeVersionId: string | undefined,
): Delta {
  const versionsWithFindings = new Set(
    findings.map((finding) => finding.new_version_id),
  );
  const active = deltas.find((delta) =>
    delta.new_version_id === activeVersionId &&
    versionsWithFindings.has(delta.new_version_id)
  );
  const selected = active ??
    deltas.find((delta) => versionsWithFindings.has(delta.new_version_id));
  if (!selected) {
    throw new Error("No replayed policy comparison is available");
  }
  return selected;
}

export function summarizeReplay(
  job: ReplayJobRecord | undefined,
  findingCount: number,
): {
  candidateCount: number;
  completedCount: number;
  id: string;
  status: ReplayJobRecord["status"];
} {
  const completedCount = Math.max(job?.completed_count ?? 0, findingCount);
  const candidateCount = Math.max(
    job?.candidate_count ?? 0,
    completedCount,
  );
  return {
    candidateCount,
    completedCount,
    id: job?.id ?? "replay-pending",
    status: job?.status ?? (findingCount > 0 ? "completed" : "pending"),
  };
}
