import type { CSSProperties, ReactNode } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { COLORS } from "../constants";

type GlassCardModel = {
  borderColor?: string;
  delay?: number;
  style?: CSSProperties;
};

export function GlassCard({
  children,
  model,
}: {
  children: ReactNode;
  model: GlassCardModel;
}): React.ReactNode {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    config: { damping: 17, stiffness: 110 },
    fps,
    frame: frame - (model.delay ?? 0),
  });
  return (
    <div
      style={{
        background: COLORS.bgCard,
        border: `1px solid ${model.borderColor ?? COLORS.border}`,
        borderRadius: 24,
        boxShadow: `0 28px 90px ${COLORS.bg}80`,
        opacity: interpolate(progress, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateY(${interpolate(progress, [0, 1], [28, 0])}px) scale(${interpolate(progress, [0, 1], [0.96, 1])})`,
        ...model.style,
      }}
    >
      {children}
    </div>
  );
}
