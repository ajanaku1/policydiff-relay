# PolicyDiff Relay entity graph

Status: Phase 0 design
Database: Base44 entities (MongoDB-compatible NoSQL)

The schema stays normalized around immutable versions and ledger events. Small
display snapshots may be copied into audit output, but security decisions always
join through IDs and re-read authoritative records in a backend function.

## Entities

| Entity | Purpose | Key fields and references |
|---|---|---|
| User extension | Staff identity and authorization attributes | `organization_id`, `policy_role` (`policy_admin`, `reviewer`, `auditor`, `staff`) |
| Organization | Tenant boundary | `name`, `slug` |
| Policy | Stable source identity and active pointer | `organization_id`, `name`, `source_file_id`, `active_version_id` |
| PolicyVersion | Immutable exported source version | `organization_id`, `policy_id`, `content_hash`, `source_revision`, `status`, `created_by_event_id` |
| PolicyClause | Immutable normalized clause | `organization_id`, `policy_version_id`, `clause_key`, `heading`, `body`, `body_hash`, `ordinal` |
| Guidance | Historical answer and exact dependency | `organization_id`, `policy_id`, `policy_version_id`, `audience`, `effective_on`, `question`, `answer`, `cited_clause_ids`, protected recipient fields |
| PolicyDelta | Immutable old/new comparison | `organization_id`, `policy_id`, `old_version_id`, `new_version_id`, `materiality`, `changed_clause_ids`, evidence |
| ReplayJob | Durable replay orchestration | `organization_id`, `old_version_id`, `new_version_id`, `status`, counters, retry metadata |
| ReplayItem | One guidance candidate within a job | `organization_id`, `replay_job_id`, `guidance_id`, deterministic match reasons, status |
| Finding | Structured model candidate, never a decision | `organization_id`, `replay_item_id`, explicit version IDs, classification, confidence, evidence, correction draft, status |
| ReviewTask | Human work queue, including agent-created tasks | `organization_id`, `finding_id`, `assigned_reviewer_id`, `status`, `created_by_kind` |
| Approval | Append-only human decision | `organization_id`, `finding_id`, `reviewer_id`, `decision`, `correction_revision`, `reason` |
| Delivery | External-send ledger and idempotency owner | `organization_id`, `approval_id`, `guidance_id`, `idempotency_key`, status, connector message ID, lease/retry fields |
| DeliverySecret | Isolated recipient and token data | `organization_id`, `delivery_id`, recipient address, `token_hash`, `expires_at`, `used_at` |
| Acknowledgement | Append-only close-loop event | `organization_id`, `delivery_id`, `acknowledged_at`, minimal request metadata |
| AuditPacket | Private export metadata | `organization_id`, requested-by user, cutoff, private file URI, hash, expiry metadata |
| OperationEvent | Safe operational ledger | `organization_id`, correlation ID, resource type/ID, operation, from/to state, outcome, safe error code |

All business records carry `organization_id` directly. This deliberate
denormalization makes organization-scoped RLS queryable without trusting a
multi-hop relationship.

## Relationship sketch

```text
Organization
  +-- User
  +-- Policy
      +-- PolicyVersion
          +-- PolicyClause
          +-- Guidance (historical dependency)
          +-- PolicyDelta (old_version -> new_version)
              +-- ReplayJob
                  +-- ReplayItem
                      +-- Finding
                          +-- ReviewTask
                          +-- Approval
                              +-- Delivery
                                  +-- DeliverySecret
                                  +-- Acknowledgement
  +-- AuditPacket
  +-- OperationEvent
```

## Required uniqueness

Base44 schema validation alone may not express every compound unique constraint.
Each trusted create therefore also stores a deterministic `dedupe_key`; the entity
schema marks that scalar unique when supported, and the function handles a
concurrent conflict by reading the winning record.

| Entity | Unique value |
|---|---|
| Policy | `organization_id + source_file_id` |
| PolicyVersion | `source_file_id + content_hash` |
| PolicyClause | `policy_version_id + clause_key` |
| PolicyDelta | `old_version_id + new_version_id` |
| ReplayJob | `organization_id + old_version_id + new_version_id` |
| ReplayItem | `replay_job_id + guidance_id` |
| Approval | `finding_id + correction_revision + reviewer decision` |
| Delivery | `approval_id + recipient_id + correction_revision` |
| DeliverySecret | unique `delivery_id`; unique `token_hash` |
| Acknowledgement | unique `delivery_id` |

## Query-shaped indexes

Compound indexes put equality fields first and time/range fields last.

| Entity | Index | Supports |
|---|---|---|
| Policy | `(organization_id, source_file_id)` unique | allowlisted event lookup |
| PolicyVersion | `(policy_id, created_date desc)` | timeline |
| PolicyVersion | `(source_file_id, content_hash)` unique | ingestion dedupe |
| PolicyClause | `(policy_version_id, clause_key)` unique | exact clause comparison |
| Guidance | `(organization_id, policy_version_id, effective_on)` | deterministic replay filter |
| PolicyDelta | `(old_version_id, new_version_id)` unique | explicit comparison lookup |
| ReplayJob | `(organization_id, status, next_attempt_at)` | retry sweep |
| ReplayItem | `(replay_job_id, status)` | progress and worker selection |
| Finding | `(organization_id, status, created_date desc)` | review queue/realtime screen |
| ReviewTask | `(organization_id, assigned_reviewer_id, status)` | reviewer inbox |
| Approval | `(finding_id, created_date desc)` | current decision validation |
| Delivery | `(organization_id, status, next_attempt_at)` | send/reconciliation sweep |
| Delivery | `(idempotency_key)` unique | send exactly-once claim |
| DeliverySecret | `(token_hash)` unique | acknowledgement lookup |
| Acknowledgement | `(delivery_id)` unique | replay prevention |
| OperationEvent | `(organization_id, correlation_id, created_date)` | incident trace |

## RLS and FLS policy

RLS is deny-by-default. A record is readable only when its `organization_id`
matches `user.data.organization_id` and its entity/operation permits the user's
`data.policy_role`.

| Role | Entity access |
|---|---|
| policy_admin | read organization policy trail; create guidance through function; invoke ingestion/activation controls |
| reviewer | read policy evidence, findings, tasks, and redacted delivery state; approve/dismiss through function |
| auditor | read immutable trail and audit metadata; request export through function; no workflow mutation |
| staff | read allowed policy/finding summaries; create guidance and agent review tasks through narrow functions |
| service role | narrow function-only access; never a browser or agent credential |

Direct client create/update/delete is denied for versions, clauses, deltas, replay
records, findings, approvals, deliveries, secrets, acknowledgements, audit
packets, and operation events. Workflow mutation is function-only.

FLS protects:

- `Guidance.recipient_email`, recipient name, and free-form recipient context;
- `Delivery.connector_message_id` and connector diagnostics;
- every `DeliverySecret` field;
- `AuditPacket.private_file_uri`;
- internal model prompts/raw responses and operational diagnostics.

Reviewers receive only the recipient display value needed to verify a correction.
Auditors receive recipient identifiers only inside the authorized private packet.
The staff agent receives redacted finding evidence and task fields, never delivery
secrets or recipient addresses.

## Retention and deletion

MVP records are append-only where they establish chain of custody. No user role
has direct delete permission. A future retention job may tombstone recipient
fields separately from the policy/finding trail, but automated deletion is out of
scope for the golden journey.
