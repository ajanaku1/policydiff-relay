import type { Actor } from "../types/controlRoom";

interface HeaderModel {
  actor: Actor;
  onExport: () => void;
  policyName: string;
  sourceLabel: string;
}

export function Header({ model }: { model: HeaderModel }) {
  return (
    <header className="app-header">
      <a className="brand" href="#main" aria-label="PolicyDiff Relay home">
        <span className="brand-mark" aria-hidden="true">
          <i />
        </span>
        <span>PolicyDiff Relay</span>
      </a>
      <div className="header-context">
        <span className="source-pill">
          <i aria-hidden="true" />
          {model.sourceLabel}
        </span>
        <span className="policy-name">{model.policyName}</span>
      </div>
      <div className="header-actions">
        <button className="text-button" type="button" onClick={model.onExport}>
          Export audit
        </button>
        <span className="avatar" title={`${model.actor.fullName} · ${model.actor.role}`}>
          {initials(model.actor.fullName)}
        </span>
      </div>
    </header>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}
