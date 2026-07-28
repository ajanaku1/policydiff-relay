import type { FindingView } from "../types/controlRoom";

interface MapModel {
  findings: FindingView[];
  onSelect: (findingId: string) => void;
  selectedId: string;
}

export function BlastRadiusMap({ model }: { model: MapModel }) {
  return (
    <section className="map-card" aria-labelledby="map-title">
      <MapHeader count={model.findings.length} />
      <div className="orbit-map">
        <div className="orbit orbit-one" aria-hidden="true" />
        <div className="orbit orbit-two" aria-hidden="true" />
        <div className="orbit orbit-three" aria-hidden="true" />
        <div className="clause-node"><span>§4.2</span><strong>AGE</strong><small>18→21</small></div>
        {model.findings.map((finding, index) => (
          <FindingNode
            key={finding.id}
            model={{
              finding,
              index,
              isSelected: finding.id === model.selectedId,
              onSelect: model.onSelect,
            }}
          />
        ))}
      </div>
      <FindingLegend />
    </section>
  );
}

function MapHeader({ count }: { count: number }) {
  return (
    <header className="card-heading">
      <div>
        <p className="eyebrow">Blast radius map</p>
        <h2 id="map-title">One clause. Three answers.</h2>
      </div>
      <strong>{twoDigits(count)} records</strong>
    </header>
  );
}

interface FindingNodeModel {
  finding: FindingView;
  index: number;
  isSelected: boolean;
  onSelect: (findingId: string) => void;
}

function FindingNode({ model }: { model: FindingNodeModel }) {
  const { finding, index, isSelected, onSelect } = model;
  return (
    <button
      aria-label={`${finding.label}, ${labelFor(finding.classification)}`}
      aria-pressed={isSelected}
      className={`finding-node node-${index + 1} ${finding.classification}`}
      onClick={() => onSelect(finding.id)}
      type="button"
    >
      {finding.initials}
    </button>
  );
}

function FindingLegend() {
  return (
    <div className="map-legend" aria-label="Finding status legend">
      <span><i className="affected" />Affected</span>
      <span><i className="still_valid" />Still valid</span>
      <span><i className="uncertain" />Uncertain</span>
    </div>
  );
}

function labelFor(classification: FindingView["classification"]): string {
  return classification === "still_valid"
    ? "still valid"
    : classification;
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}
