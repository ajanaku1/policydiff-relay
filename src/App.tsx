import { BlastRadiusMap } from "./components/BlastRadiusMap";
import { EvidenceReview } from "./components/EvidenceReview";
import { FindingRail } from "./components/FindingRail";
import { Header } from "./components/Header";
import { PolicyAgent } from "./components/PolicyAgent";
import { PolicyTimeline } from "./components/PolicyTimeline";
import { RemediationLedger } from "./components/RemediationLedger";
import { useControlRoom } from "./hooks/useControlRoom";

export default function App() {
  return <ControlRoom room={useControlRoom()} />;
}

type Room = ReturnType<typeof useControlRoom>;

function ControlRoom({ room }: { room: Room }) {
  if (room.loadError) {
    return <ErrorState room={room} />;
  }
  if (!room.snapshot || !room.selected) {
    return <LoadingState />;
  }
  const readyRoom: ReadyRoom = {
    ...room,
    selected: room.selected,
    snapshot: room.snapshot,
  };
  return <Dashboard room={readyRoom} />;
}

type ReadyRoom = Room & {
  selected: NonNullable<Room["selected"]>;
  snapshot: NonNullable<Room["snapshot"]>;
};

function Dashboard({ room }: { room: ReadyRoom }) {
  const { snapshot } = room;
  return (
    <>
      <Header model={headerModel(room)} />
      <main id="main">
        <Hero summary={snapshot.deltaSummary} />
        <PolicyTimeline replay={snapshot.replay} versions={snapshot.versions} />
        <Workspace room={room} />
      </main>
      <AppFooter />
    </>
  );
}

function Workspace({ room }: { room: ReadyRoom }) {
  const { selected, snapshot } = room;
  return (
    <div className="workspace-grid">
      <MapColumn room={room} />
      <EvidenceReview model={{ action: room.action, actions: room.actions, finding: selected }} />
      <div className="closure-column">
        <RemediationLedger entries={snapshot.ledger} />
        <PolicyAgent model={{ finding: selected, isDemo: snapshot.source === "demo" }} />
      </div>
    </div>
  );
}

function MapColumn({ room }: { room: ReadyRoom }) {
  const model = {
    findings: room.snapshot.findings,
    onSelect: room.setSelectedId,
    selectedId: room.selectedId,
  };
  return (
    <div className="map-column">
      <BlastRadiusMap model={model} />
      <FindingRail model={model} />
    </div>
  );
}

function headerModel(room: ReadyRoom) {
  return {
    actor: room.snapshot.actor,
    onExport: () => void room.actions.exportAudit(),
    policyName: room.snapshot.policyName,
    sourceLabel: room.snapshot.sourceLabel,
  };
}

function AppFooter() {
  return (
    <footer className="app-footer">
      <span>Human-owned decisions</span>
      <span>Evidence-bound replay</span>
      <span>Base44 realtime</span>
    </footer>
  );
}

function Hero({ summary }: { summary: string }) {
  return (
    <section className="hero">
      <div>
        <p className="eyebrow">Policy incident · PD-2026-0728</p>
        <h1>Trace the change to every answer it touched.</h1>
      </div>
      <p>{summary}</p>
    </section>
  );
}

function LoadingState() {
  return (
    <main className="centered-state" aria-busy="true">
      <span className="loading-orbit" aria-hidden="true" />
      <p>Mapping policy dependencies…</p>
    </main>
  );
}

function ErrorState({ room }: { room: Room }) {
  const buttonLabel = room.signInRequired ? "Sign in with Google" : "Try again";
  const handleClick = room.signInRequired
    ? room.actions.signIn
    : () => void room.actions.refresh();
  return (
    <main className="centered-state">
      <p className="eyebrow">
        {room.signInRequired ? "Secure control room" : "Control room unavailable"}
      </p>
      <h1>
        {room.signInRequired
          ? "Sign in to trace the policy trail."
          : "We could not load the policy trail."}
      </h1>
      <p>{room.loadError}</p>
      <button className="primary-button" onClick={handleClick} type="button">
        {buttonLabel}
      </button>
    </main>
  );
}
