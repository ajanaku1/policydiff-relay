import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { AnimatedBackground } from "../components/AnimatedBackground";
import { BrandPin } from "../components/BrandPin";
import { BrowserFrame } from "../components/BrowserFrame";
import { GlassCard } from "../components/GlassCard";
import { ASSETS, COLORS, CUES, TEXT } from "../constants";
import { DISPLAY, MONO, SANS } from "../fonts";

function ClassificationStrip(): React.ReactNode {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", gap: 16 }}>
      {TEXT.evidence.labels.map((label, index) => {
        const color = [COLORS.valid, COLORS.amber, COLORS.affected][index];
        const progress = spring({ fps, frame: frame - CUES.evidenceNodes[index], config: { damping: 15 } });
        return <div key={label} style={{ border: `2px solid ${color}`, borderRadius: 16, color, flex: 1, fontFamily: MONO, fontSize: 15, opacity: progress, padding: "20px 16px", textAlign: "center", transform: `scale(${interpolate(progress, [0, 1], [0.93, 1])})` }}>{label}</div>;
      })}
    </div>
  );
}

function ClauseDiff(): React.ReactNode {
  return (
    <GlassCard model={{ borderColor: COLORS.affected, delay: 120, style: { marginTop: 22, padding: 28 } }}>
      <div style={{ color: COLORS.cobaltBright, fontFamily: MONO, fontSize: 15, letterSpacing: 2 }}>{TEXT.evidence.section}</div>
      <p style={{ background: COLORS.affectedSoft, borderLeft: `4px solid ${COLORS.affected}`, color: COLORS.white, fontFamily: SANS, fontSize: 21, margin: "24px 0 12px", padding: 18 }}>{TEXT.evidence.oldClause}</p>
      <p style={{ background: COLORS.validSoft, borderLeft: `4px solid ${COLORS.valid}`, color: COLORS.white, fontFamily: SANS, fontSize: 21, margin: 0, padding: 18 }}>{TEXT.evidence.newClause}</p>
    </GlassCard>
  );
}

export function Evidence(): React.ReactNode {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [80, 440], [1.04, 1.18], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ height: "100%", padding: "140px 76px 82px", position: "relative" }}>
      <AnimatedBackground />
      <BrandPin />
      <h1 style={{ color: COLORS.white, fontFamily: DISPLAY, fontSize: 56, margin: "0 0 32px", position: "relative", zIndex: 2 }}>{TEXT.evidence.title}</h1>
      <div style={{ display: "grid", gap: 30, gridTemplateColumns: "0.72fr 1.28fr", position: "relative", zIndex: 2 }}>
        <div>
          <ClassificationStrip />
          <ClauseDiff />
        </div>
        <BrowserFrame model={{ delay: 30, image: ASSETS.evidence, imageStyle: { transform: `scale(${zoom})`, transformOrigin: "73% 52%" }, style: { height: 680 }, title: TEXT.evidence.section }} />
      </div>
    </div>
  );
}
