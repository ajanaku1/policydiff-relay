import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { AnimatedBackground } from "../components/AnimatedBackground";
import { BrandPin } from "../components/BrandPin";
import { GlassCard } from "../components/GlassCard";
import { COLORS, TEXT } from "../constants";
import { DISPLAY, MONO, SANS } from "../fonts";

type ContrastModel = {
  color: string;
  delay: number;
  label: string;
  lines: readonly string[];
  marker: string;
};

function ContrastPanel({ model }: { model: ContrastModel }): React.ReactNode {
  return (
    <GlassCard model={{ borderColor: model.color, delay: model.delay, style: { flex: 1, minHeight: 360, padding: 38 } }}>
      <div style={{ color: model.color, fontFamily: MONO, fontSize: 17, letterSpacing: 3 }}>{model.label}</div>
      {model.lines.map((line, index) => (
        <div key={line} style={{ alignItems: "center", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.white, display: "flex", fontFamily: SANS, fontSize: 25, gap: 18, padding: "30px 0" }}>
          <span style={{ color: model.color, fontFamily: MONO, fontSize: 28 }}>{model.marker}</span>
          <span>{line}</span>
          {index === 1 && <span style={{ color: model.color, marginLeft: "auto" }}>···</span>}
        </div>
      ))}
    </GlassCard>
  );
}

export function Problem(): React.ReactNode {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const divider = spring({ fps, frame: frame - 45, config: { damping: 18 } });
  return (
    <div style={{ height: "100%", padding: "150px 110px 120px", position: "relative" }}>
      <AnimatedBackground />
      <BrandPin />
      <h1 style={{ color: COLORS.white, fontFamily: DISPLAY, fontSize: 68, margin: "0 0 58px", position: "relative", zIndex: 2 }}>{TEXT.problem.title}</h1>
      <div style={{ display: "flex", gap: 44, position: "relative", zIndex: 2 }}>
        <ContrastPanel model={{ color: COLORS.affected, delay: 16, label: TEXT.problem.oldLabel, lines: TEXT.problem.oldLines, marker: "×" }} />
        <div style={{ background: COLORS.border, height: interpolate(divider, [0, 1], [0, 360]), marginTop: 10, width: 1 }} />
        <ContrastPanel model={{ color: COLORS.valid, delay: 55, label: TEXT.problem.newLabel, lines: TEXT.problem.newLines, marker: "+" }} />
      </div>
    </div>
  );
}
