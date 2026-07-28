import type { EntityRecord } from "@base44/sdk";

import { base44 } from "./base44Client";
import { loadDemoSnapshot } from "../data/demoSnapshot";
import type {
  Actor,
  AuditPacketResult,
  ClauseEvidence,
  ControlRoomSnapshot,
  FindingView,
  LedgerEntry,
  PolicyRole,
  VersionSummary,
} from "../types/controlRoom";

interface LoadedRecords {
  acknowledgements: EntityRecord["Acknowledgement"][];
  clauses: EntityRecord["PolicyClause"][];
  deliveries: EntityRecord["Delivery"][];
  deltas: EntityRecord["PolicyDelta"][];
  findings: EntityRecord["Finding"][];
  guidance: EntityRecord["Guidance"][];
  policies: EntityRecord["Policy"][];
  replayJobs: EntityRecord["ReplayJob"][];
  reviewTasks: EntityRecord["ReviewTask"][];
  versions: EntityRecord["PolicyVersion"][];
}

const roles: PolicyRole[] = ["policy_admin", "reviewer", "auditor", "staff"];

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Sign in with Google to open the control room");
    this.name = "AuthenticationRequiredError";
  }
}

export async function loadControlRoom(): Promise<ControlRoomSnapshot> {
  try {
    await ensureAuthenticated();
    const actor = await loadActor();
    const records = await loadRecords();
    return buildSnapshot(actor, records);
  } catch (error) {
    if (import.meta.env.DEV) {
      return loadDemoSnapshot();
    }
    throw error;
  }
}

async function ensureAuthenticated(): Promise<void> {
  if (import.meta.env.DEV) return;
  if (await base44.auth.isAuthenticated()) return;
  throw new AuthenticationRequiredError();
}

export function beginSignIn(): void {
  base44.auth.loginWithProvider("google", `${window.location.origin}/`);
}

export function isAuthenticationRequired(error: unknown): boolean {
  return error instanceof AuthenticationRequiredError;
}

async function loadActor(): Promise<Actor> {
  const user = await base44.auth.me();
  const claims = user as unknown as Record<string, unknown>;
  return {
    email: user.email,
    fullName: user.full_name ?? "Policy operator",
    id: user.id,
    organizationId: readClaim(claims, "organization_id"),
    role: readRole(claims.policy_role),
  };
}

function readClaim(claims: Record<string, unknown>, key: string): string {
  const value = claims[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing authenticated ${key}`);
  }
  return value;
}

function readRole(value: unknown): PolicyRole {
  if (typeof value === "string" && roles.includes(value as PolicyRole)) {
    return value as PolicyRole;
  }
  throw new Error("Missing authenticated policy role");
}

async function loadRecords(): Promise<LoadedRecords> {
  const response = await base44.functions.invoke("loadControlRoomData", {});
  const value = readFunctionData(response);
  const keys: Array<keyof LoadedRecords> = [
    "acknowledgements", "clauses", "deliveries", "deltas", "findings",
    "guidance", "policies", "replayJobs", "reviewTasks", "versions",
  ];
  if (keys.some((key) => !Array.isArray(value[key]))) {
    throw new Error("Control room data returned an invalid record set");
  }
  return value as unknown as LoadedRecords;
}

function buildSnapshot(
  actor: Actor,
  records: LoadedRecords,
): ControlRoomSnapshot {
  const policy = requireFirst(records.policies, "No policy is available");
  const delta = requireFirst(records.deltas, "No policy comparison is available");
  const versions = buildVersions(records.versions, delta);
  const findings = buildFindings(records, delta);
  return {
    actor,
    deltaSummary: delta.summary ?? "A material policy change requires review.",
    findings,
    ledger: buildLedger(records, findings),
    policyId: policy.id,
    policyName: policy.name,
    replay: buildReplay(records.replayJobs, delta),
    source: "base44",
    sourceLabel: "Source locked · Google Drive",
    versions,
  };
}

function requireFirst<T>(values: T[], message: string): T {
  const first = values[0];
  if (!first) {
    throw new Error(message);
  }
  return first;
}

function buildVersions(
  versions: EntityRecord["PolicyVersion"][],
  delta: EntityRecord["PolicyDelta"],
): ControlRoomSnapshot["versions"] {
  return {
    current: toVersion(findVersion(versions, delta.new_version_id), "v5"),
    previous: toVersion(findVersion(versions, delta.old_version_id), "v4"),
  };
}

function findVersion(
  versions: EntityRecord["PolicyVersion"][],
  id: string,
): EntityRecord["PolicyVersion"] {
  const version = versions.find((candidate) => candidate.id === id);
  if (!version) {
    throw new Error(`Policy version ${id} is not readable`);
  }
  return version;
}

function toVersion(
  version: EntityRecord["PolicyVersion"],
  label: string,
): VersionSummary {
  return {
    id: version.id,
    label,
    revision: formatDate(version.created_date),
    status: version.status,
  };
}

function buildFindings(
  records: LoadedRecords,
  delta: EntityRecord["PolicyDelta"],
): FindingView[] {
  return records.findings
    .filter((finding) => finding.new_version_id === delta.new_version_id)
    .map((finding, index) => toFindingView(finding, index, records));
}

function toFindingView(
  finding: EntityRecord["Finding"],
  index: number,
  records: LoadedRecords,
): FindingView {
  const guidance = records.guidance.find((item) => item.id === finding.guidance_id);
  if (!guidance) {
    throw new Error(`Guidance ${finding.guidance_id} is not readable`);
  }
  const delivery = records.deliveries.find(
    (item) => item.guidance_id === guidance.id,
  );
  const task = records.reviewTasks.find((item) => item.finding_id === finding.id);
  return compactFinding(finding, guidance, delivery, task, index, records.clauses);
}

function compactFinding(
  finding: EntityRecord["Finding"],
  guidance: EntityRecord["Guidance"],
  delivery: EntityRecord["Delivery"] | undefined,
  task: EntityRecord["ReviewTask"] | undefined,
  index: number,
  clauses: EntityRecord["PolicyClause"][],
): FindingView {
  const alias = findingAlias(index);
  return {
    classification: finding.classification,
    ...(finding.confidence === undefined ? {} : { confidence: finding.confidence }),
    correctionDraft: finding.correction_draft ?? "",
    ...(delivery ? { deliveryId: delivery.id, deliveryStatus: delivery.status } : {}),
    evidence: buildEvidence(finding, clauses),
    guidanceId: guidance.id,
    id: finding.id,
    initials: alias.initials,
    label: alias.label,
    originalAnswer: guidance.answer,
    question: guidance.question,
    rationale: finding.rationale ?? "This finding is waiting for reviewer context.",
    status: finding.status,
    ...(task ? { taskStatus: task.status } : {}),
  };
}

function findingAlias(index: number): { initials: string; label: string } {
  const initials = ["CM", "RK", "AL"][index] ?? `G${index + 1}`;
  return { initials, label: `Guidance ${String(index + 1).padStart(2, "0")}` };
}

function buildEvidence(
  finding: EntityRecord["Finding"],
  clauses: EntityRecord["PolicyClause"][],
): ClauseEvidence[] {
  const current = clauses.filter((clause) =>
    finding.evidence_clause_ids.includes(clause.id)
  );
  return current.map((clause) => ({
    clauseKey: clause.clause_key,
    heading: clause.heading,
    newText: clause.body,
    oldText: previousClauseBody(clause, clauses, finding.old_version_id),
  }));
}

function previousClauseBody(
  current: EntityRecord["PolicyClause"],
  clauses: EntityRecord["PolicyClause"][],
  oldVersionId: string,
): string {
  return clauses.find(
    (clause) =>
      clause.policy_version_id === oldVersionId &&
      clause.clause_key === current.clause_key,
  )?.body ?? "Previous clause text is not available.";
}

function buildReplay(
  jobs: EntityRecord["ReplayJob"][],
  delta: EntityRecord["PolicyDelta"],
): ControlRoomSnapshot["replay"] {
  const job = jobs.find((item) => item.new_version_id === delta.new_version_id);
  return {
    candidateCount: job?.candidate_count ?? 0,
    completedCount: job?.completed_count ?? 0,
    id: job?.id ?? "replay-pending",
    status: job?.status ?? "pending",
  };
}

function buildLedger(
  records: LoadedRecords,
  findings: FindingView[],
): LedgerEntry[] {
  const delivery = records.deliveries[0];
  const acknowledged = records.acknowledgements.length > 0;
  return [
    ledgerItem("version", "Version ingested", "Content hash locked", "complete"),
    ledgerItem("replay", "Guidance replay completed", `${findings.length} findings`, "complete"),
    reviewLedger(findings),
    deliveryLedger(delivery),
    acknowledgementLedger(acknowledged),
  ];
}

function ledgerItem(
  id: string,
  label: string,
  detail: string,
  status: LedgerEntry["status"],
): LedgerEntry {
  return { detail, id, label, status, timestamp: status === "complete" ? "Done" : "Now" };
}

function reviewLedger(findings: FindingView[]): LedgerEntry {
  const pending = findings.filter((finding) => finding.status === "pending_review").length;
  return ledgerItem(
    "review",
    "Human review",
    reviewDetail(pending),
    pending === 0 ? "complete" : "current",
  );
}

function reviewDetail(pending: number): string {
  if (pending === 0) return "All findings decided";
  return `${pending} ${pending === 1 ? "decision" : "decisions"} open`;
}

function deliveryLedger(
  delivery: EntityRecord["Delivery"] | undefined,
): LedgerEntry {
  if (!delivery) {
    return ledgerItem("delivery", "Correction delivery", "Waiting for approval", "waiting");
  }
  const complete = delivery.status === "sent" || delivery.status === "acknowledged";
  const failed = delivery.status === "failed";
  return ledgerItem(
    "delivery",
    "Correction delivery",
    delivery.status.replaceAll("_", " "),
    deliveryLedgerStatus(failed, complete),
  );
}

function deliveryLedgerStatus(
  failed: boolean,
  complete: boolean,
): LedgerEntry["status"] {
  if (failed) return "failed";
  if (complete) return "complete";
  return "current";
}

function acknowledgementLedger(acknowledged: boolean): LedgerEntry {
  return ledgerItem(
    "acknowledgement",
    "Acknowledgement",
    acknowledged ? "Receipt recorded once" : "Single-use recipient link",
    acknowledged ? "complete" : "waiting",
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export async function approveFinding(
  findingId: string,
  correctionText: string,
): Promise<void> {
  await base44.functions.invoke("approveFinding", {
    correction_text: correctionText,
    finding_id: findingId,
  });
}

export async function createReviewerTask(
  findingId: string,
  note: string,
): Promise<void> {
  await base44.functions.invoke("createReviewerTask", {
    finding_id: findingId,
    note,
  });
}

export async function sendCorrection(deliveryId: string): Promise<void> {
  await base44.functions.invoke("sendCorrection", { delivery_id: deliveryId });
}

export async function createAuditPacket(
  organizationId: string,
): Promise<AuditPacketResult> {
  const response = await base44.functions.invoke("createAuditPacket", {
    organization_id: organizationId,
    trail_cutoff_at: new Date().toISOString(),
  });
  return readAuditResult(response);
}

function readAuditResult(value: unknown): AuditPacketResult {
  const record = readFunctionData(value);
  if (typeof record.packet_hash !== "string" || typeof record.signed_url !== "string") {
    throw new Error("Audit export is missing its signed URL");
  }
  return { packetHash: record.packet_hash, signedUrl: record.signed_url };
}

function readFunctionData(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || !("data" in value)) {
    throw new Error("Trusted function returned no data");
  }
  const data = value.data;
  if (!data || typeof data !== "object") {
    throw new Error("Trusted function returned invalid data");
  }
  return data as Record<string, unknown>;
}
