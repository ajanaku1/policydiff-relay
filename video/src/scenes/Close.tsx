import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

import { AnimatedBackground } from "../components/AnimatedBackground";
import { ASSETS, COLORS, PROJECT, SCENE_DURATIONS, TEXT } from "../constants";
import { DISPLAY, MONO, SANS } from "../fonts";

function Stats(): React.ReactNode {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", gap: 18, marginTop: 54 }}>
      {TEXT.close.stats.map(([value, label], index) => {
        const progress = spring({ fps, frame: frame - 48 - index * 16, config: { damping: 16 } });
        return <div key={label} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 18, minWidth: 240, opacity: progress, padding: "24px 22px", textAlign: "center", transform: `translateY(${interpolate(progress, [0, 1], [24, 0])}px)` }}><strong style={{ color: COLORS.cobaltBright, display: "block", fontFamily: DISPLAY, fontSize: 48 }}>{value}</strong><span style={{ color: COLORS.muted, fontFamily: MONO, fontSize: 12, letterSpacing: 1.5 }}>{label}</span></div>;
      })}
    </div>
  );
}

export function Close(): React.ReactNode {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [SCENE_DURATIONS.close - 60, SCENE_DURATIONS.close], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <div style={{ alignItems: "center", display: "flex", flexDirection: "column", height: "100%", justifyContent: "center", opacity: fade, position: "relative" }}>
      <AnimatedBackground />
      <div style={{ alignItems: "center", display: "flex", flexDirection: "column", position: "relative", zIndex: 2 }}>
        <Img src={staticFile(ASSETS.logo)} style={{ filter: `drop-shadow(0 0 32px ${COLORS.cobaltBright}70)`, height: 124, width: 124 }} />
        <div style={{ color: COLORS.white, fontFamily: DISPLAY, fontSize: 84, fontWeight: 700, marginTop: 22 }}>{PROJECT.name}</div>
        <div style={{ color: COLORS.valid, fontFamily: SANS, fontSize: 34, marginTop: 8 }}>{TEXT.close.title}</div>
        <Stats />
        <div style={{ color: COLORS.cobaltBright, fontFamily: MONO, fontSize: 22, marginTop: 48 }}>{PROJECT.url}</div>
      </div>
    </div>
  );
}
