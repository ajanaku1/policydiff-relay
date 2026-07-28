# Phase 4 hardening evidence

Verified: 2026-07-28

PolicyDiff Relay's failure tests exercise the transitions most likely to create
an incorrect policy incident or duplicate correction.

| Risk | Expected behavior | Test evidence |
|---|---|---|
| Duplicate Drive delivery | Equivalent source content creates one immutable version | `tests/integration/version-ingestion.test.ts` |
| Concurrent ingestion | Racing events resolve to the same dedupe winner | `tests/integration/version-ingestion.test.ts` |
| Wrong source file | A non-allowlisted file is rejected before export | `tests/unit/ingestion-contract.test.ts` |
| Broad replay | Version, audience, date, and clause filters narrow candidates before model use | `tests/unit/policy-analysis.test.ts` |
| Cross-organization review | Approval and agent tools reject organization mismatch | `tests/integration/approval-delivery.test.ts`, `tests/integration/agent-tools.test.ts` |
| Unauthorized correction send | Staff and cross-organization callers are rejected before Gmail access | `tests/integration/approval-delivery.test.ts` |
| Edited correction approval | Changed text increments the correction revision; identical retries reuse the current revision | `tests/integration/approval-delivery.test.ts` |
| Agent overreach | The agent has explanation and reviewer-task tools only | `tests/integration/agent-config.test.ts` |
| Stale approval | Delivery reloads and validates the complete approved aggregate | `tests/integration/approval-delivery.test.ts` |
| Concurrent Gmail retry | One caller owns the sending lease and one message is sent | `tests/unit/delivery-contract.test.ts` |
| Ambiguous Gmail response | The claim remains in `sending` for reconciliation; it is not blindly resent | `tests/unit/delivery-contract.test.ts` |
| Expired sending lease | Reconciliation quarantines the ambiguous attempt | `tests/integration/approval-delivery.test.ts` |
| Token replay | A hashed, expiring acknowledgement token closes one delivery once | `tests/integration/closure-audit.test.ts` |
| Private audit leakage | Only the same organization reviewer or auditor receives a five-minute signed URL | `tests/integration/closure-audit.test.ts` |
| Duplicate reviewer task | The control room disables task creation when one is already open | `tests/unit/review-decision.test.ts` |

Local browser verification covered the selected Evidence Cartography interface
at 1440px and 375px widths. The affected path advances from review to queued
delivery, the send path advances to acknowledgement wait, and the uncertain
path preserves the open reviewer task.

The full verification command is:

```bash
npm test && npm run typecheck && npm run build && npx base44 types generate
```

Result: 84 tests passed. TypeScript, the Vite production build, and Base44 type
generation completed without errors.
