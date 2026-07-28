# Base44 atomic-claim and Drive payload documentation gap

Status: local documentation review; not posted upstream
Date: 2026-07-27

## Environment

- Product: Base44 developer backend and connector automations
- Documentation reviewed: official Base44 developer documentation available on
  2026-07-28
- Local runtime: Node 26.5.0
- Base44 CLI: 0.1.5

## Minimal reproduction

1. Define a connector automation with `integration_type: "googledrive"`,
   `events: ["file.update"]`, and an exact `resource_id`.
2. Attempt to implement a handler that independently verifies the changed file ID
   from the documented function payload.
3. Attempt to implement a delivery worker that atomically changes one queued
   record to sending only if its expected state and lease match.
4. Consult the connector automation payload and entity SDK references.

## Expected

- A complete, typed `payload.data` example for Google Drive `file.update`,
  including the canonical field that contains the changed file ID.
- A documented single-record conditional update/compare-and-set primitive, or a
  documented compound uniqueness mechanism, suitable for an external-send claim.

## Actual

- The automation reference documents the outer envelope and says `data` contains
  the raw webhook payload, but does not show the Drive `file.update` data shape.
- The entity SDK documents `update(id, data)` and conditional `updateMany(query,
  update operators)`. It does not state transaction/atomicity guarantees for
  using `updateMany` as a one-record claim, and the reviewed entity schema
  material does not document compound unique indexes.

## Impact

The product can scope an automation to a specific Drive resource, but a defensive
handler cannot be finalized from documentation alone. Exactly-once external
delivery also depends on a storage-level atomic claim; a read-then-update sequence
is unsafe under concurrent retries.

## Workaround

- Configure the exact Google Drive file ID as the automation `resource_id`, as
  required by the current automation reference. Unwrap the documented
  `body.payload` envelope, then validate the observed raw-data file ID through a
  narrow adapter once an actual event is captured.
- Chain internal extraction, comparison, and replay functions explicitly rather
  than depending on an undocumented entity-automation request body.
- Model the delivery seam behind `DeliveryClaimRepository`. During the Base44
  spike, prove whether a conditional `updateMany` reports exactly one updated
  record atomically. If not, use a supported unique scalar `idempotency_key`
  create as the claim. Do not enable Gmail delivery until the concurrency test
  passes against the hosted backend.

## Upstream request

Add a full Drive `file.update` payload example and explicitly document the
atomicity/concurrency guarantees of conditional entity updates and unique fields.
