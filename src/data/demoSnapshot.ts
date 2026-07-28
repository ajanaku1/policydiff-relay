import type { ControlRoomSnapshot } from "../types/controlRoom";

const evidence = {
  clauseKey: "§4.2",
  heading: "Eligibility age",
  newText:
    "Applicants must be at least 21 years old on the date of enrollment.",
  oldText:
    "Applicants must be at least 18 years old on the date of enrollment.",
};

const demoSnapshot: ControlRoomSnapshot = {
    actor: {
      email: "jordan.lee@example.test",
      fullName: "Jordan Lee",
      id: "user-reviewer-01",
      organizationId: "org-northstar",
      role: "reviewer",
    },
    deltaSummary:
      "The minimum enrollment age moved from 18 to 21. Guidance that relied on §4.2 was replayed; unrelated waiting-period guidance stayed valid.",
    findings: [
      {
        classification: "affected",
        confidence: 0.96,
        correctionDraft:
          "A policy update changed the minimum enrollment age from 18 to 21. The earlier answer you received is no longer current. You will be eligible once you are 21.",
        deliveryId: "delivery-casey",
        deliveryStatus: "queued",
        evidence: [evidence],
        guidanceId: "guidance-casey",
        id: "finding-casey",
        initials: "CM",
        label: "Guidance 01",
        originalAnswer:
          "Yes. At 19, you meet the policy's minimum age requirement.",
        question: "Can a 19-year-old applicant enroll this summer?",
        rationale:
          "The answer cites §4.2 directly, and the applicant now falls below the revised age threshold.",
        status: "pending_review",
      },
      {
        classification: "still_valid",
        confidence: 0.99,
        correctionDraft: "",
        evidence: [],
        guidanceId: "guidance-rowan",
        id: "finding-rowan",
        initials: "RK",
        label: "Guidance 02",
        originalAnswer:
          "The 30-day waiting period starts on the confirmed application date.",
        question: "When does the waiting period begin?",
        rationale:
          "The answer depends on §7.1. That clause did not change in this version.",
        status: "pending_review",
      },
      {
        classification: "uncertain",
        confidence: 0.58,
        correctionDraft: "",
        evidence: [evidence],
        guidanceId: "guidance-amari",
        id: "finding-amari",
        initials: "AL",
        label: "Guidance 03",
        originalAnswer:
          "Contractors follow the same age rule unless their agreement says otherwise.",
        question: "Does the new threshold apply to contractors?",
        rationale:
          "The cited clause changed, but the policy does not define whether contractors are applicants. A reviewer must resolve the missing classification evidence.",
        status: "pending_review",
        taskStatus: "open",
      },
    ],
    ledger: [
      {
        detail: "Drive event · content hash locked",
        id: "ledger-version",
        label: "Version v5 ingested",
        status: "complete",
        timestamp: "09:41",
      },
      {
        detail: "Three candidates · deterministic scope",
        id: "ledger-replay",
        label: "Guidance replay completed",
        status: "complete",
        timestamp: "09:42",
      },
      {
        detail: "One affected answer needs a decision",
        id: "ledger-review",
        label: "Human review",
        status: "current",
        timestamp: "Now",
      },
      {
        detail: "Gmail send waits for approval",
        id: "ledger-delivery",
        label: "Correction delivery",
        status: "waiting",
        timestamp: "Next",
      },
      {
        detail: "Single-use recipient link",
        id: "ledger-ack",
        label: "Acknowledgement",
        status: "waiting",
        timestamp: "Then",
      },
    ],
    policyId: "policy-eligibility",
    policyName: "Eligibility Policy",
    replay: {
      candidateCount: 3,
      completedCount: 3,
      id: "replay-v4-v5",
      status: "completed",
    },
    source: "demo",
    sourceLabel: "Local preview · production reads Base44",
    versions: {
      current: {
        id: "version-v5",
        label: "v5",
        revision: "28 Jul 2026",
        status: "active",
      },
      previous: {
        id: "version-v4",
        label: "v4",
        revision: "01 Jun 2026",
        status: "compared",
      },
    },
};

export function loadDemoSnapshot(): ControlRoomSnapshot {
  return structuredClone(demoSnapshot);
}
