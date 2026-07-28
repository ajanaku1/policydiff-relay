# Phase 0 evidence

Date: 2026-07-27
Scope: risky seams only. No Base44 resource was deployed and no email was sent.

## What is now fixed in the design

- Base44 is the trust boundary. The browser cannot activate a version, approve a
  finding, send a correction, consume a token, or build an audit packet.
- Every replay stores its old and new version IDs. Model output is a candidate;
  deterministic filters and a reviewer decide what happens next.
- Drive ingestion deduplicates on the allowlisted file ID and a SHA-256 hash of a
  canonical text export.
- Delivery needs a storage-level claim before Gmail is called. An uncertain send
  result goes to reconciliation instead of an automatic resend.
- Recipient and acknowledgement secrets live outside the general delivery record.
  RLS is organization-scoped, FLS hides protected fields, and workflow entities
  deny direct client writes.

The full decisions are in `reports/architecture.md` and
`reports/data-model.md`.

## Test evidence

The test suite was written before the implementation. The first behavioral run
failed with seven `Not implemented` failures. A second red/green cycle added three
Google API contract failures before the adapter code was written.

Final commands:

```bash
npm run typecheck
npm test
```

Final result:

```text
TypeScript: pass
Suites: 3 passed
Tests: 10 passed, 0 failed
Duration: 458.236392 ms
```

Covered behavior:

- exact `googledrive` / `file.update` validation;
- one allowlisted file ID;
- oversized connector-payload rejection;
- stable text canonicalization and SHA-256 hashing;
- source-and-content-bound version dedupe keys;
- Google Docs plain-text export request construction;
- Gmail base64url MIME request construction;
- Gmail header-injection rejection;
- one sender call under two concurrent delivery attempts;
- stored Gmail message ID reuse after a successful send.

## Review and simplification

The code review checked security boundaries, async failures, duplicated logic,
types, and function size. It found one blocking scaffold problem: an automation
manifest referenced a function entry point that did not exist. That manifest was
removed until Phase 1 implements the function. Optional auth and agent paths were
also removed from `base44/config.jsonc` until their resources exist.

The simplify pass then:

- made Google GET and POST request types explicit;
- added return types to test doubles;
- widened webhook envelope fields to reflect untrusted runtime input;
- formatted the base64url conversion for readability.

Afterward, strict TypeScript and all tests still passed. Production TypeScript has
no `any` usage. No function exceeds 30 lines, no logic is duplicated more than
twice, there are no React components yet, and the only async operation with an
external side effect has explicit error handling.

The local secret-pattern scan found no API keys or private keys. `npm audit` was
not run because this machine points it at an external registry mirror, which
would receive private package metadata. No production dependency is installed;
the four installed packages are TypeScript's compiler and Node type tooling.

## What cannot be proved locally yet

The Base44 CLI is not installed, this folder is not linked to a Base44 project,
and no Google connector credentials or allowlisted document ID are available.
The current official docs also do not show the raw Drive `file.update` data shape
or state the atomicity guarantee needed for a one-record delivery claim.

The documentation gap and safe workaround are recorded in
`reports/2026-07-27-base44-atomic-claim-and-drive-payload-doc-gap.md`.

Phase 1 must prove these against the hosted backend before Gmail delivery is
enabled:

1. capture one real Drive event and lock the payload adapter;
2. export the allowlisted Google Doc and compare its hash;
3. prove a conditional entity claim under concurrency;
4. get explicit approval before authorizing connectors or sending a test email.

## Official references checked

- https://docs.base44.com/developers/backend/resources/backend-functions/automations
- https://docs.base44.com/developers/backend/resources/connectors/shared-connectors
- https://docs.base44.com/developers/backend/resources/entities/security
- https://docs.base44.com/developers/references/sdk/docs/type-aliases/entities
- https://docs.base44.com/developers/backend/overview/project-structure
