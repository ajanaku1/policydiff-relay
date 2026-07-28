import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

import { AnimatedBackground } from "../components/AnimatedBackground";
import { GlowText } from "../components/GlowText";
import { ASSETS, COLORS, PROJECT, TEXT } from "../constants";
import { DISPLAY, MONO, SANS } from "../fonts";

function DependencyGraph(): React.ReactNode {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ height: 420, position: "relative", width: 980 }}>
      <div style={{ background: COLORS.cobaltSoft, border: `2px solid ${COLORS.cobaltBright}`, borderRadius: 18, color: COLORS.white, fontFamily: MONO, fontSize: 22, left: 330, padding: "24px 34px", position: "absolute", textAlign: "center", top: 20, width: 320 }}>
        {TEXT.hook.source}
      </div>
      <svg height="420" style={{ inset: 0, position: "absolute" }} width="980">
        {TEXT.hook.answers.map((_, index) => {
          const progress = spring({ fps, frame: frame - 55 - index * 16, config: { damping: 16 } });
          return <line key={index} x1="490" y1="112" x2={190 + index * 300} y2={interpolate(progress, [0, 1], [112, 285])} stroke={[COLORS.valid, COLORS.amber, COLORS.affected][index]} strokeWidth="4" opacity={progress} />;
        })}
      </svg>
      {TEXT.hook.answers.map((label, index) => {
        const progress = spring({ fps, frame: frame - 62 - index * 16, config: { damping: 15, stiffness: 100 } });
        return <div key={label} style={{ background: [COLORS.validSoft, COLORS.amberSoft, COLORS.affectedSoft][index], border: `2px solid ${[COLORS.valid, COLORS.amber, COLORS.affected][index]}`, borderRadius: 16, color: COLORS.white, fontFamily: MONO, fontSize: 16, left: 60 + index * 300, opacity: progress, padding: "26px 12px", position: "absolute", textAlign: "center", top: interpolate(progress, [0, 1], [235, 285]), width: 260 }}>{label}</div>;
      })}
    </div>
  );
}

function HookCopy(): React.ReactNode {
  return (
    <div style={{ alignItems: "center", display: "flex", flexDirection: "column" }}>
      <Img src={staticFile(ASSETS.logo)} style={{ height: 84, marginBottom: 24, width: 84 }} />
      <GlowText model={{ color: COLORS.cobaltBright, delay: 10, fontFamily: MONO, fontSize: 18, style: { letterSpacing: 5 }, text: TEXT.hook.changed }} />
      <GlowText model={{ color: COLORS.white, delay: 24, fontFamily: DISPLAY, fontSize: 78, style: { marginTop: 16, textAlign: "center" }, text: TEXT.hook.question }} />
      <div style={{ color: COLORS.muted, fontFamily: SANS, fontSize: 20, marginTop: 18 }}>{PROJECT.tagline}</div>
    </div>
  );
}

export function Hook(): React.ReactNode {
  return (
    <div style={{ alignItems: "center", display: "flex", flexDirection: "column", height: "100%", justifyContent: "center", paddingTop: 45 }}>
      <AnimatedBackground />
      <div style={{ alignItems: "center", display: "flex", flexDirection: "column", position: "relative", zIndex: 2 }}>
        <HookCopy />
        <DependencyGraph />
      </div>
    </div>
  );
}
