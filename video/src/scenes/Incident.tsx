import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { AnimatedBackground } from "../components/AnimatedBackground";
import { BrandPin } from "../components/BrandPin";
import { BrowserFrame } from "../components/BrowserFrame";
import { ASSETS, COLORS, CUES, TEXT } from "../constants";
import { DISPLAY, MONO, SANS } from "../fonts";

function ReplayOverlay(): React.ReactNode {
  const frame = useCurrentFrame();
  const count = Math.min(3, Math.max(0, Math.floor((frame - 76) / 22) + 1));
  return (
    <div style={{ background: `${COLORS.bg}ee`, border: `1px solid ${COLORS.cobaltBright}`, borderRadius: 18, padding: "22px 28px", position: "absolute", right: 80, top: 74 }}>
      <div style={{ color: COLORS.cobaltBright, fontFamily: MONO, fontSize: 15, letterSpacing: 2 }}>{TEXT.incident.source}</div>
      <div style={{ color: COLORS.white, fontFamily: DISPLAY, fontSize: 42, marginTop: 8 }}>{count} / 3</div>
      <div style={{ color: COLORS.muted, fontFamily: SANS, fontSize: 15 }}>{TEXT.incident.replay}</div>
    </div>
  );
}

function FindingNodes(): React.ReactNode {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ bottom: 58, display: "flex", gap: 18, left: 90, position: "absolute" }}>
      {TEXT.incident.labels.map((label, index) => {
        const color = [COLORS.valid, COLORS.amber, COLORS.affected][index];
        const progress = spring({ fps, frame: frame - CUES.incidentNodes[index], config: { damping: 14 } });
        return <div key={label} style={{ background: `${COLORS.bg}ee`, border: `2px solid ${color}`, borderRadius: 999, color: COLORS.white, fontFamily: MONO, fontSize: 14, opacity: progress, padding: "14px 20px", transform: `translateY(${interpolate(progress, [0, 1], [25, 0])}px)` }}>{label}</div>;
      })}
    </div>
  );
}

export function Incident(): React.ReactNode {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, 420], [1.06, 1.0], { extrapolateRight: "clamp" });
  return (
    <div style={{ height: "100%", padding: "130px 86px 80px", position: "relative" }}>
      <AnimatedBackground />
      <BrandPin />
      <h1 style={{ color: COLORS.white, fontFamily: DISPLAY, fontSize: 58, margin: "0 0 28px", position: "relative", zIndex: 2 }}>{TEXT.incident.title}</h1>
      <BrowserFrame model={{ image: ASSETS.controlRoom, imageStyle: { transform: `scale(${zoom})`, transformOrigin: "center top" }, style: { height: 760, position: "relative", zIndex: 2 }, title: TEXT.incident.source }} />
      <div style={{ inset: "130px 86px 80px", position: "absolute", zIndex: 3 }}>
        <ReplayOverlay />
        <FindingNodes />
      </div>
    </div>
  );
}
