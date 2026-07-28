# PolicyDiff Relay architecture

Status: Phase 0 decision record
Scope: the single-document, single-sender journey in `Goal.md`

## System boundary

Base44 owns authentication, the User extension, entities, security rules, Deno
functions, automations, connector credentials, realtime subscriptions, private
files, the staff agent, and hosting. The React client is an untrusted control
surface: it may query records permitted by RLS/FLS and invoke functions, but it
never activates a policy, approves a finding, sends mail, consumes an
acknowledgement token, or creates an audit packet directly.

Google Drive is the policy-source boundary. Gmail is the delivery boundary.
`InvokeLLM` proposes structured clause and replay candidates; deterministic
filters and server-side state transitions remain authoritative.

## Golden event path

1. A policy admin records three guidance answers against `Policy.active_version_id`.
2. The shared Google Drive connector emits `file.update` for the one configured
   `source_file_id`.
3. `ingestPolicyVersion` rejects a mismatched file, exports Google Docs text
   through the shared connector, canonicalizes it, and hashes it.
4. The function claims `source_file_id + content_hash` before creating a version.
   A duplicate event returns the existing version and performs no downstream work.
5. `extractPolicyClauses` asks `InvokeLLM` for structured clause candidates and
   validates the result. It persists immutable clauses tied to the new version.
6. `comparePolicyVersions` compares the prior active version with the candidate
   version. Deterministic exact/heading checks wrap the model's semantic change
   candidates. The output is an immutable `PolicyDelta`.
7. `activatePolicyVersion` uses a compare-and-set transition. It advances the
   policy's active version only after extraction and comparison succeed.
8. `createReplayJob` stores explicit old and new version IDs plus the changed
   clause IDs. It selects only guidance whose policy version is the old version
   and whose cited clauses or deterministic keywords overlap the delta.
9. `replayGuidance` asks `InvokeLLM` for a structured candidate classification
   (`affected`, `still_valid`, or `uncertain`) with evidence. Schema and version
   checks run before each immutable finding is stored.
10. A reviewer approves a proposed correction through `approveFinding`. The
    function re-reads the finding, role, organization, versions, and current state.
11. `sendCorrection` atomically claims the delivery idempotency key. Only the
    claimant calls the shared Gmail connector. Retries reconcile the stored Gmail
    message ID instead of sending again.
12. The recipient opens a public acknowledgement function with an opaque token.
    The function hashes it, atomically changes an unused/unexpired token to used,
    and records exactly one acknowledgement.
13. Base44 entity subscriptions update findings, approval, delivery, and
    acknowledgement views. A scheduled reconciler repairs jobs left in retryable
    intermediate states.
14. An auditor invokes `createAuditPacket`. The function reads the organization
    trail with service-role access, writes a private file, and returns a short-lived
    signed URL.

## Trust boundaries

| Boundary | Accepted input | Required server checks |
|---|---|---|
| Drive automation | Connector event envelope | event type, provider, exact configured file ID, export response, content hash |
| Authenticated function | Base44 user context + schema-validated body | organization, role, entity ownership, current state, allowed transition |
| InvokeLLM | Prompt plus constrained source records | strict output schema, enum values, cited IDs exist in supplied set, explicit version IDs |
| Gmail connector | Approved immutable delivery | approval is current, delivery claim won, recipient fields read only under service role |
| Acknowledgement URL | random raw token | SHA-256 lookup, expiry, unused state, atomic consume |
| Agent tool | authenticated staff request | allowlisted read/task operations only; no generic entity mutation tool |

Service-role access is confined to narrow backend functions. It is never exposed
to the browser or to the agent prompt.

## State machines

### Policy version

```text
ingesting -> extracted -> compared -> active
    |           |           |
    +---------> failed <-----+
```

Only one active version exists per policy. `active` is reached with a
compare-and-set on the prior `Policy.active_version_id`. Failed records retain
their error code and correlation ID; they are never silently deleted.

### Replay job

```text
pending -> running -> completed
              |
              +-> retry_wait -> running
              |
              +-> failed
```

The job key is `organization_id + old_version_id + new_version_id`. Each replay
item key adds `guidance_id`, so a job or item can be safely retried.

### Finding review

```text
pending_review -> approved -> delivery_queued
       |              |
       +-> dismissed  +-> superseded
```

Approval is an append-only record, not a mutable flag supplied by the client.
A changed finding or version creates a new review target and supersedes the old
approval.

### Delivery

```text
queued -> sending -> sent -> acknowledged
             |        |
             |        +-> acknowledgement_expired
             +-> retry_wait -> sending
             +-> failed
```

`sending` is a lease with an expiry. The unique delivery key prevents two sends.
Ambiguous connector outcomes remain `sending` for reconciliation; they are not
immediately retried.

## Idempotency and retries

- Ingestion key: `source_file_id + sha256(canonical_export)`.
- Delta key: `old_version_id + new_version_id`.
- Replay job key: `organization_id + old_version_id + new_version_id`.
- Replay item key: `replay_job_id + guidance_id`.
- Delivery key: `approved_finding_id + recipient_id + correction_revision`.
- Acknowledgement uniqueness: `delivery_id`; the stored token hash is also unique.
- Audit packet key: caller-supplied request ID plus organization and trail cutoff.

Database uniqueness is the final arbiter. Functions may first query for a fast
path, but they must tolerate a concurrent create losing the uniqueness race.
Retryable failures use bounded exponential backoff with jitter. Validation,
authorization, and illegal-state errors are terminal. Connector timeouts after a
request may have reached Gmail are ambiguous and go to reconciliation rather than
automatic resend.

## Failure semantics and observability

Every function emits structured events with `correlation_id`, `organization_id`,
function name, resource IDs, attempt, previous state, next state, duration, and a
safe error code. Recipient addresses, raw tokens, exported document text, and
correction bodies are excluded from logs.

Operational views require:

- ingestion dedupe count and failed export count;
- extraction/diff schema rejection count;
- replay candidate and completion counts;
- approval-to-send latency;
- delivery retry, ambiguous outcome, and duplicate-suppression counts;
- acknowledgement replay rejection count;
- reconciliation backlog age.

A scheduled sweep retries only records in `retry_wait` whose `next_attempt_at` is
due, recovers expired leases, and marks exhausted attempts `failed`. Operators can
see failures and create reviewer tasks; no recovery bypasses authorization or
transition validation.

## Deployment sequence

1. Push User extensions and entity schemas with deny-by-default RLS/FLS.
2. Run authorization and cross-organization tests.
3. Deploy functions with connector automations disabled.
4. Connect one shared Drive account and one shared Gmail account.
5. Set the allowlisted file ID and verify read/export scopes.
6. Seed fictional policy and guidance through authenticated functions.
7. Enable Drive automation; exercise duplicate-event ingestion without sending.
8. Verify Gmail with a user-approved test recipient.
9. Deploy the React control room and run the browser journey.

Rollback disables automations first, then frontend entry points. Immutable ledger
records remain available for audit.
