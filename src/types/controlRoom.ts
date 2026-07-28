export type Classification = "affected" | "still_valid" | "uncertain";

export type FindingStatus =
  | "pending_review"
  | "approved"
  | "dismissed"
  | "superseded";

export type DeliveryStatus =
  | "queued"
  | "sending"
  | "retry_wait"
  | "sent"
  | "acknowledged"
  | "acknowledgement_expired"
  | "failed";

export type PolicyRole = "policy_admin" | "reviewer" | "auditor" | "staff";

export interface Actor {
  email: string;
  fullName: string;
  id: string;
  organizationId: string;
  role: PolicyRole;
}

export interface VersionSummary {
  id: string;
  label: string;
  revision: string;
  status: "ingesting" | "extracted" | "compared" | "active" | "failed";
}

export interface ClauseEvidence {
  clauseKey: string;
  heading: string;
  newText: string;
  oldText: string;
}

export interface FindingView {
  classification: Classification;
  confidence?: number;
  correctionDraft: string;
  deliveryId?: string;
  deliveryStatus?: DeliveryStatus;
  evidence: ClauseEvidence[];
  guidanceId: string;
  id: string;
  initials: string;
  label: string;
  originalAnswer: string;
  question: string;
  rationale: string;
  status: FindingStatus;
  taskStatus?: "open" | "in_progress" | "completed" | "cancelled";
}

export interface ReplaySummary {
  candidateCount: number;
  completedCount: number;
  id: string;
  status: "pending" | "running" | "retry_wait" | "completed" | "failed";
}

export interface LedgerEntry {
  detail: string;
  id: string;
  label: string;
  status: "complete" | "current" | "waiting" | "failed";
  timestamp: string;
}

export interface ControlRoomSnapshot {
  actor: Actor;
  deltaSummary: string;
  findings: FindingView[];
  ledger: LedgerEntry[];
  policyId: string;
  policyName: string;
  replay: ReplaySummary;
  source: "base44" | "demo";
  sourceLabel: string;
  versions: {
    current: VersionSummary;
    previous: VersionSummary;
  };
}

export interface AsyncActionState {
  kind: "idle" | "working" | "success" | "error";
  message: string;
}

export interface AuditPacketResult {
  packetHash: string;
  signedUrl: string;
}
