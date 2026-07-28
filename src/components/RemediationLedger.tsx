import type { LedgerEntry } from "../types/controlRoom";

export function RemediationLedger({ entries }: { entries: LedgerEntry[] }) {
  return (
    <section className="ledger-card" aria-labelledby="ledger-title">
      <header className="card-heading">
        <div>
          <p className="eyebrow">Remediation ledger</p>
          <h2 id="ledger-title">Trace to closure</h2>
        </div>
        <span className="live-label"><i aria-hidden="true" />Realtime</span>
      </header>
      <ol className="ledger-list">
        {entries.map((entry) => <LedgerRow entry={entry} key={entry.id} />)}
      </ol>
    </section>
  );
}

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  return (
    <li className={entry.status}>
      <span className="ledger-marker" aria-hidden="true" />
      <div>
        <strong>{entry.label}</strong>
        <small>{entry.detail}</small>
      </div>
      <time>{entry.timestamp}</time>
    </li>
  );
}
