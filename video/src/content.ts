import type { SceneId } from "./constants";

export const TEXT = {
  hook: {
    changed: "ONE SENTENCE CHANGED",
    question: "Which answers are wrong now?",
    source: "POLICY §4.2",
    answers: ["STILL VALID", "UNCERTAIN", "AFFECTED"],
  },
  problem: {
    title: "A document diff stops too early.",
    oldLabel: "DOCUMENT DIFF",
    oldLines: ["Shows what changed", "Loses downstream context"],
    newLabel: "POLICYDIFF RELAY",
    newLines: ["Finds dependent answers", "Routes correction to closure"],
  },
  incident: {
    title: "A live change becomes an incident.",
    source: "Google Drive file.update",
    versions: ["v4", "v5"],
    replay: "3 / 3 REPLAYED",
    labels: ["STILL VALID", "UNCERTAIN", "AFFECTED"],
  },
  evidence: {
    title: "Only the answers touched by evidence move.",
    section: "§4.2 ENROLLMENT AGE",
    oldClause: "Applicants must be at least 18.",
    newClause: "Applicants must be at least 21.",
    labels: ["STILL VALID", "UNCERTAIN", "AFFECTED"],
  },
  closure: {
    title: "The correction stays human-owned.",
    steps: [
      ["01", "REVIEW", "Dahunsi approves"],
      ["02", "DELIVER", "Gmail sends once"],
      ["03", "ACKNOWLEDGE", "Single-use link"],
      ["04", "CLOSE", "Ledger completes"],
    ],
    status: "DELIVERY ACKNOWLEDGED",
  },
  agentAudit: {
    title: "Bounded agent. Complete proof.",
    agentLabel: "POLICY OPS",
    tool: "explainFinding",
    answer: "Uncertain: the policy does not define whether contractors count as applicants.",
    auditLabel: "PRIVATE AUDIT PACKET",
    auditItems: ["Versions", "Finding", "Approval", "Delivery", "Receipt"],
    signed: "5-MINUTE SIGNED URL",
  },
  close: {
    title: "From change to closure.",
    stats: [
      ["17", "TRUSTED FUNCTIONS"],
      ["7", "ACTIVE WORKFLOWS"],
      ["3", "ANSWERS REPLAYED"],
      ["1", "VERIFIED CORRECTION"],
    ],
  },
  social: {
    beats: [
      ["1", "POLICY SENTENCE CHANGED"],
      ["3", "PAST ANSWERS DEPENDED ON IT"],
      ["1", "IS NOW WRONG"],
    ],
    question: "Which answers are wrong now?",
    close: "Trace every answer it touched.",
  },
} as const;

export const SUBTITLE_SENTENCES: Record<SceneId, readonly string[]> = {
  hook: [
    "One sentence changed.",
    "A support answer that was safe yesterday is wrong today.",
    "The dangerous part? It is already sitting in someone's inbox.",
    "PolicyDiff Relay finds it.",
  ],
  problem: [
    "Normal document diffs stop at the page.",
    "They cannot tell you which past decisions depended on the line that moved.",
  ],
  incident: [
    "This is the live incident.",
    "Google Drive reports the policy edit.",
    "Base44 stores version five, compares it with version four, then replays exactly three cited answers.",
    "No bulk guessing.",
    "Three dependencies, three classifications.",
  ],
  evidence: [
    "The blast radius separates signal from noise.",
    "Green stays valid.",
    "Amber needs a human classification.",
    "Red cites the changed age rule directly.",
    "Open it and the old clause, new clause, rationale, and correction appear in one evidence chain.",
  ],
  closure: [
    "The model proposes; Dahunsi decides.",
    "Approval locks a delivery revision.",
    "Gmail sends the correction once.",
    "The recipient opens a single-use acknowledgement link, and the ledger closes in real time.",
    "Retry it, and the token is rejected.",
  ],
  agentAudit: [
    "Policy Ops can explain evidence or open reviewer work, but it cannot approve or send.",
    "Its answer is checked against the trusted finding before display.",
    "Then one private audit export proves the whole trail: versions, finding, approval, delivery, and receipt.",
  ],
  close: [
    "One edit.",
    "Three answers.",
    "One verified correction.",
    "PolicyDiff Relay traces policy change all the way to human closure.",
  ],
};
