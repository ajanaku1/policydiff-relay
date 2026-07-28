import type { FindingView } from "../types/controlRoom";

interface RailModel {
  findings: FindingView[];
  onSelect: (findingId: string) => void;
  selectedId: string;
}

export function FindingRail({ model }: { model: RailModel }) {
  return (
    <nav className="finding-rail" aria-label="Replay findings">
      {model.findings.map((finding) => (
        <button
          aria-pressed={finding.id === model.selectedId}
          className={`rail-item ${finding.classification}`}
          key={finding.id}
          onClick={() => model.onSelect(finding.id)}
          type="button"
        >
          <span className="rail-initials">{finding.initials}</span>
          <span>
            <strong>{finding.label}</strong>
            <small>{classificationLabel(finding.classification)}</small>
          </span>
          <i aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}

function classificationLabel(value: FindingView["classification"]): string {
  const labels = {
    affected: "Affected · direct dependency",
    still_valid: "Still valid · unchanged clause",
    uncertain: "Uncertain · evidence gap",
  };
  return labels[value];
}
