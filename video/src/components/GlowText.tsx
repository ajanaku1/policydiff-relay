import type { CSSProperties } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

type GlowTextModel = {
  color: string;
  delay?: number;
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  style?: CSSProperties;
  text: string;
};

export function GlowText({ model }: { model: GlowTextModel }): React.ReactNode {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    config: { damping: 16, stiffness: 95 },
    fps,
    frame: frame - (model.delay ?? 0),
  });
  return (
    <div
      style={{
        color: model.color,
        fontFamily: model.fontFamily,
        fontSize: model.fontSize,
        fontWeight: model.fontWeight ?? 700,
        opacity: interpolate(progress, [0, 0.35], [0, 1], { extrapolateRight: "clamp" }),
        textShadow: `0 0 36px ${model.color}40`,
        transform: `translateY(${interpolate(progress, [0, 1], [24, 0])}px)`,
        ...model.style,
      }}
    >
      {model.text}
    </div>
  );
}
