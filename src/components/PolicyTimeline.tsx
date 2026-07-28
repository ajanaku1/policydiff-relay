import type {
  ControlRoomSnapshot,
  ReplaySummary,
  VersionSummary,
} from "../types/controlRoom";

export function PolicyTimeline({
  replay,
  versions,
}: Pick<ControlRoomSnapshot, "replay" | "versions">) {
  const progress = replay.candidateCount === 0
    ? 0
    : Math.round((replay.completedCount / replay.candidateCount) * 100);
  return (
    <section className="timeline" aria-labelledby="timeline-title">
      <div>
        <p className="eyebrow" id="timeline-title">Locked comparison</p>
        <div className="version-pair">
          <VersionCard kind="previous" version={versions.previous} />
          <span className="version-arrow" aria-hidden="true">→</span>
          <VersionCard kind="current" version={versions.current} />
        </div>
      </div>
      <ReplayProgress progress={progress} replay={replay} />
    </section>
  );
}

function VersionCard({
  kind,
  version,
}: {
  kind: "previous" | "current";
  version: VersionSummary;
}) {
  return (
    <div className={`version-card ${kind}`}>
      <strong>{version.label}</strong>
      <span>{version.revision}</span>
      <small>{kind === "current" ? "Active source" : "Prior source"}</small>
    </div>
  );
}

function ReplayProgress({
  progress,
  replay,
}: {
  progress: number;
  replay: ReplaySummary;
}) {
  return (
    <div className="replay-progress">
      <div className="replay-label">
        <span>Replay {replay.status}</span>
        <strong>{replay.completedCount} / {replay.candidateCount}</strong>
      </div>
      <div
        aria-label={`Replay ${progress}% complete`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progress}
        className="progress-track"
        role="progressbar"
      >
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
