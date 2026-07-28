interface OrganizationScoped {
  organization_id: string;
}

export interface Acknowledgement extends OrganizationScoped {
  delivery_id: string;
  dedupe_key: string;
  acknowledged_at: string;
  request_fingerprint_hash?: string;
}

export interface Approval extends OrganizationScoped {
  finding_id: string;
  reviewer_id: string;
  decision: "approved" | "dismissed";
  correction_revision: number;
  correction_text?: string;
  reason?: string;
  dedupe_key: string;
}

export interface AuditPacket extends OrganizationScoped {
  requested_by_user_id: string;
  trail_cutoff_at: string;
  private_file_uri: string;
  packet_hash: string;
  dedupe_key: string;
}

export interface Delivery extends OrganizationScoped {
  approval_id: string;
  correction_revision: number;
  guidance_id: string;
  idempotency_key: string;
  status: "queued" | "sending" | "retry_wait" | "sent" | "acknowledged" | "acknowledgement_expired" | "failed";
  connector_message_id?: string;
  lease_expires_at?: string;
  attempt?: number;
  next_attempt_at?: string;
  safe_error_code?: string;
}

export interface DeliverySecret extends OrganizationScoped {
  delivery_id: string;
  recipient_name?: string;
  recipient_email: string;
  token_hash: string;
  expires_at: string;
  used_at?: string;
}

export interface Finding extends OrganizationScoped {
  replay_item_id: string;
  dedupe_key: string;
  guidance_id: string;
  old_version_id: string;
  new_version_id: string;
  classification: "affected" | "still_valid" | "uncertain";
  confidence?: number;
  evidence_clause_ids: string[];
  rationale?: string;
  correction_draft?: string;
  status: "pending_review" | "approved" | "dismissed" | "superseded";
  model_name?: string;
  model_output_hash?: string;
}

export interface Guidance extends OrganizationScoped {
  policy_id: string;
  policy_version_id: string;
  audience: string;
  effective_on: string;
  question: string;
  answer: string;
  cited_clause_ids: string[];
  recipient_name?: string;
  recipient_email: string;
}

export interface OperationEvent extends OrganizationScoped {
  correlation_id: string;
  resource_type: string;
  resource_id: string;
  operation: string;
  from_state?: string;
  to_state?: string;
  outcome: "succeeded" | "rejected" | "retryable" | "failed";
  safe_error_code?: string;
  attempt?: number;
  duration_ms?: number;
}

export interface Organization {
  organization_id: string;
  name: string;
  slug: string;
}

export interface Policy extends OrganizationScoped {
  name: string;
  source_file_id: string;
  active_version_id?: string;
  dedupe_key: string;
}

export interface PolicyClause extends OrganizationScoped {
  policy_version_id: string;
  clause_key: string;
  heading: string;
  body: string;
  body_hash: string;
  ordinal: number;
  dedupe_key: string;
}

export interface PolicyDelta extends OrganizationScoped {
  policy_id: string;
  old_version_id: string;
  new_version_id: string;
  materiality: "material" | "non_material" | "uncertain";
  changed_clause_ids: string[];
  summary?: string;
  dedupe_key: string;
}

export interface PolicyVersion extends OrganizationScoped {
  policy_id: string;
  source_file_id: string;
  source_revision?: string;
  content_hash: string;
  content_text: string;
  status: "ingesting" | "extracted" | "compared" | "active" | "failed";
  created_by_event_id: string;
  dedupe_key: string;
  error_code?: string;
}

export interface ReplayItem extends OrganizationScoped {
  replay_job_id: string;
  guidance_id: string;
  match_reasons: string[];
  status: "pending" | "running" | "completed" | "failed";
  dedupe_key: string;
}

export interface ReplayJob extends OrganizationScoped {
  old_version_id: string;
  new_version_id: string;
  status: "pending" | "running" | "retry_wait" | "completed" | "failed";
  candidate_count?: number;
  completed_count?: number;
  attempt?: number;
  next_attempt_at?: string;
  dedupe_key: string;
}

export interface ReviewTask extends OrganizationScoped {
  finding_id: string;
  created_by_user_id: string;
  dedupe_key: string;
  assigned_reviewer_id?: string;
  status: "open" | "in_progress" | "completed" | "cancelled";
  created_by_kind: "system" | "staff" | "agent";
  note?: string;
}

export interface User extends OrganizationScoped {
  policy_role: "policy_admin" | "reviewer" | "auditor" | "staff";
}

declare module "@base44/sdk" {
  interface EntityTypeRegistry {
    Acknowledgement: Acknowledgement; Approval: Approval;
    AuditPacket: AuditPacket; Delivery: Delivery;
    DeliverySecret: DeliverySecret; Finding: Finding;
    Guidance: Guidance; OperationEvent: OperationEvent;
    Organization: Organization; Policy: Policy;
    PolicyClause: PolicyClause; PolicyDelta: PolicyDelta;
    PolicyVersion: PolicyVersion; ReplayItem: ReplayItem;
    ReplayJob: ReplayJob; ReviewTask: ReviewTask;
    User: User;
  }

  interface FunctionNameRegistry {
    acknowledgeDelivery: true; activatePolicyVersion: true;
    approveFinding: true; comparePolicyVersions: true;
    createAuditPacket: true; createGuidance: true;
    createReplayJob: true; createReviewerTask: true;
    explainFinding: true; extractPolicyClauses: true;
    ingestPolicyVersion: true; loadControlRoomData: true;
    reconcileDeliveries: true; replayGuidance: true;
    seedDemoIncident: true; seedDemoWorkspace: true;
    sendCorrection: true;
  }

  interface AgentNameRegistry { policy_ops: true; }

  interface ConnectorTypeRegistry { gmail: true; googledrive: true; }
}
