import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { AnimatedBackground } from "../components/AnimatedBackground";
import { BrandPin } from "../components/BrandPin";
import { BrowserFrame } from "../components/BrowserFrame";
import { ASSETS, COLORS, CUES, TEXT } from "../constants";
import { DISPLAY, MONO, SANS } from "../fonts";

function ClosureSteps(): React.ReactNode {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {TEXT.closure.steps.map(([number, label, detail], index) => {
        const progress = spring({ fps, frame: frame - CUES.closureSteps[index], config: { damping: 16 } });
        const complete = frame > CUES.closureSteps[index] + 38;
        return <div key={label} style={{ alignItems: "center", background: COLORS.bgCard, border: `1px solid ${complete ? COLORS.valid : COLORS.border}`, borderRadius: 18, display: "grid", gap: 16, gridTemplateColumns: "52px 1fr auto", opacity: progress, padding: "18px 20px", transform: `translateX(${interpolate(progress, [0, 1], [-30, 0])}px)` }}><span style={{ color: COLORS.cobaltBright, fontFamily: MONO, fontSize: 18 }}>{number}</span><div><strong style={{ color: COLORS.white, display: "block", fontFamily: MONO, fontSize: 15 }}>{label}</strong><span style={{ color: COLORS.muted, fontFamily: SANS, fontSize: 17 }}>{detail}</span></div><span style={{ color: complete ? COLORS.valid : COLORS.muted, fontFamily: MONO }}>{complete ? "DONE" : "WAIT"}</span></div>;
      })}
    </div>
  );
}

export function Closure(): React.ReactNode {
  const frame = useCurrentFrame();
  const statusOpacity = interpolate(frame, [285, 320], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ height: "100%", padding: "140px 76px 78px", position: "relative" }}>
      <AnimatedBackground />
      <BrandPin />
      <h1 style={{ color: COLORS.white, fontFamily: DISPLAY, fontSize: 60, margin: "0 0 34px", position: "relative", zIndex: 2 }}>{TEXT.closure.title}</h1>
      <div style={{ display: "grid", gap: 34, gridTemplateColumns: "0.72fr 1.28fr", position: "relative", zIndex: 2 }}>
        <div>
          <ClosureSteps />
          <div style={{ background: COLORS.validSoft, border: `1px solid ${COLORS.valid}`, borderRadius: 999, color: COLORS.valid, fontFamily: MONO, fontSize: 15, marginTop: 20, opacity: statusOpacity, padding: "15px 22px", textAlign: "center" }}>{TEXT.closure.status}</div>
        </div>
        <BrowserFrame model={{ delay: 25, image: ASSETS.closure, imageStyle: { transform: `scale(${interpolate(frame, [0, 430], [1.08, 1])})`, transformOrigin: "right bottom" }, style: { height: 690 }, title: TEXT.closure.status }} />
      </div>
    </div>
  );
}
