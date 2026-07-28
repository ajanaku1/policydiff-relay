import type { FindingView } from "../types/controlRoom.ts";

export interface ReviewDecision {
  kind: "approve" | "task" | "send" | "done";
  label: string;
  note: string;
}

export function reviewDecision(finding: FindingView): ReviewDecision {
  if (finding.deliveryStatus === "acknowledged") {
    return done("Acknowledged", "The recipient acknowledged this correction.");
  }
  if (finding.deliveryStatus === "sent") {
    return done("Awaiting acknowledgement", "The correction was sent once.");
  }
  if (finding.deliveryStatus === "queued" && finding.status === "approved") {
    return action("send", "Send correction", "Approval is locked. Gmail send is ready.");
  }
  if (finding.status === "approved") {
    return done("Approved", "This finding has been approved.");
  }
  if (finding.classification === "affected") {
    return action("approve", "Approve correction", "A human decision is required before delivery.");
  }
  if (finding.classification === "uncertain" && !finding.taskStatus) {
    return action("task", "Create reviewer task", "Preserve uncertainty and route the evidence gap.");
  }
  if (finding.classification === "uncertain") {
    return done("Reviewer task open", "The evidence gap is assigned for human review.");
  }
  return done("No correction needed", "The cited policy basis is unchanged.");
}

function action(
  kind: "approve" | "task" | "send",
  label: string,
  note: string,
): ReviewDecision {
  return { kind, label, note };
}

function done(label: string, note: string): ReviewDecision {
  return { kind: "done", label, note };
}
