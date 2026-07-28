# PolicyDiff Relay demo runbook

Target duration: 90 seconds

## Before the demo

- Sign in as the fictional reviewer.
- Confirm the Google Drive and Gmail connectors are authorized.
- Paste `demo/eligibility-policy-v4.txt` into the shared Google Doc.
- Confirm the v4 baseline and three guidance records exist.
- Keep the acknowledgement link available in a separate browser profile.
- Open the Google Doc and the control room in separate tabs.

## Walkthrough

### 0:00 to 0:12

Change the age line in the Google Doc from 18 to 21, then return to the control
room as the Drive event moves through ingestion and replay.

Say:

> One clause moved the minimum age from 18 to 21. PolicyDiff locked the new
> Google Doc revision, compared it with v4, and replayed three prior answers.

### 0:12 to 0:32

Use the orbit map to select each result.

- Red is affected because it cites the changed age clause.
- Green remains valid because its waiting-period clause did not change.
- Amber is uncertain because the policy does not classify contractors.

### 0:32 to 0:52

Return to the red finding. Show the prior answer, before and now clause text,
rationale, and correction draft. Approve the correction.

Say:

> The model proposes the finding. A reviewer owns the decision. Approval runs
> on the server, rechecks the organization and finding state, then creates one
> locked delivery.

### 0:52 to 1:07

Send the correction. Point to the ledger moving from review to delivery.

Say:

> The send function reloads the approved aggregate and claims a sending lease.
> Concurrent retries cannot send a second Gmail message.

### 1:07 to 1:19

Open the recipient link and acknowledge the correction. Return to the control
room and show the realtime ledger update.

### 1:19 to 1:30

Ask Policy Ops what blocks the amber finding, then export the private audit
packet.

Say:

> The staff agent can explain evidence and open a reviewer task. It cannot
> approve, send, mutate arbitrary records, or delete anything.

## Recovery lines

If Gmail is delayed:

> Delivery is still claimed, so the reconciler will inspect the ambiguous
> attempt without blindly resending it.

If Drive does not fire:

> The automation is file-scoped. I can invoke the same ingestion boundary with
> the captured event payload while preserving the allowlist and content hash.

If acknowledgement is already used:

> The token is single-use. Replay rejection is the expected state, and the
> original acknowledgement remains in the audit trail.
