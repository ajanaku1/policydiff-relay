import { useEffect, useState } from "react";

import {
  reviewDecision,
  type ReviewDecision,
} from "../domain/reviewDecision";
import type { AsyncActionState, FindingView } from "../types/controlRoom";

interface ReviewActions {
  approve: (correctionText: string) => Promise<void>;
  createTask: () => Promise<void>;
  send: () => Promise<void>;
}

interface ReviewModel {
  action: AsyncActionState;
  actions: ReviewActions;
  finding: FindingView;
}

export function EvidenceReview({ model }: { model: ReviewModel }) {
  const [correction, setCorrection] = useState(model.finding.correctionDraft);
  useEffect(() => setCorrection(model.finding.correctionDraft), [model.finding.id]);
  const decision = reviewDecision(model.finding);
  return (
    <section className="evidence-card" aria-labelledby="evidence-title">
      <ReviewHeading finding={model.finding} />
      <QuestionAnswer finding={model.finding} />
      <EvidenceRiver finding={model.finding} />
      <p className="rationale"><strong>Why it was flagged</strong>{model.finding.rationale}</p>
      <CorrectionEditor
        correction={correction}
        disabled={decision.kind !== "approve"}
        onChange={setCorrection}
      />
      <ReviewFooter
        model={{
          action: model.action,
          actions: model.actions,
          correction,
          decision,
        }}
      />
    </section>
  );
}

function ReviewHeading({ finding }: { finding: FindingView }) {
  const confidence = finding.confidence === undefined
    ? "Not scored"
    : `${Math.round(finding.confidence * 100)}% model confidence`;
  return (
    <header className="card-heading review-heading">
      <div>
        <p className="eyebrow">Evidence review</p>
        <h2 id="evidence-title">{finding.label}</h2>
      </div>
      <span className={`status-chip ${finding.classification}`}>
        {classificationLabel(finding.classification)}
        <small>{confidence}</small>
      </span>
    </header>
  );
}

function QuestionAnswer({ finding }: { finding: FindingView }) {
  return (
    <div className="qa-grid">
      <div><span>Question asked</span><p>{finding.question}</p></div>
      <div><span>Prior guidance</span><p>{finding.originalAnswer}</p></div>
    </div>
  );
}

function EvidenceRiver({ finding }: { finding: FindingView }) {
  if (finding.evidence.length === 0) {
    return <div className="unchanged-note">No changed clause appears in this answer's citations.</div>;
  }
  return (
    <div className="evidence-river">
      {finding.evidence.map((clause) => (
        <article className="clause-diff" key={clause.clauseKey}>
          <header><strong>{clause.clauseKey}</strong><span>{clause.heading}</span></header>
          <div className="diff-row removed"><span>Before</span><p>{clause.oldText}</p></div>
          <div className="diff-row added"><span>Now</span><p>{clause.newText}</p></div>
        </article>
      ))}
    </div>
  );
}

function CorrectionEditor({
  correction,
  disabled,
  onChange,
}: {
  correction: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="correction-editor">
      <span>Correction draft</span>
      <textarea
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={disabled ? "No correction draft is needed." : "Write the correction recipients will receive."}
        rows={5}
        value={correction}
      />
    </label>
  );
}

interface ReviewFooterModel {
  action: AsyncActionState;
  actions: ReviewActions;
  correction: string;
  decision: ReviewDecision;
}

function ReviewFooter({ model }: { model: ReviewFooterModel }) {
  const { action, actions, correction, decision } = model;
  const callback = decisionCallback(model);
  return (
    <footer className="review-footer">
      <p aria-live="polite" className={`action-note ${action.kind}`}>
        {action.message || decision.note}
      </p>
      <button
        className="primary-button"
        disabled={!callback || action.kind === "working" || (decision.kind === "approve" && !correction.trim())}
        onClick={() => void callback?.()}
        type="button"
      >
        {action.kind === "working" ? "Working…" : decision.label}
      </button>
    </footer>
  );
}

function decisionCallback(
  model: ReviewFooterModel,
): (() => Promise<void>) | undefined {
  if (model.decision.kind === "approve") {
    return () => model.actions.approve(model.correction);
  }
  if (model.decision.kind === "task") return model.actions.createTask;
  if (model.decision.kind === "send") return model.actions.send;
  return undefined;
}

function classificationLabel(value: FindingView["classification"]): string {
  const labels = {
    affected: "Affected",
    still_valid: "Still valid",
    uncertain: "Uncertain",
  };
  return labels[value];
}
