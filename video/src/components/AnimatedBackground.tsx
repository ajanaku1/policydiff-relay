import { AbsoluteFill, useCurrentFrame } from "remotion";

import { COLORS, ORBS } from "../constants";

export function AnimatedBackground(): React.ReactNode {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: COLORS.bg, overflow: "hidden" }}>
      {ORBS.map((orb, index) => {
        const x = orb.baseX + Math.sin(frame * orb.speed + index) * 100;
        const y = orb.baseY + Math.cos(frame * orb.speed + index * 2) * 80;
        return (
          <div
            key={orb.color}
            style={{
              background: `radial-gradient(circle, ${orb.color} 0%, transparent 72%)`,
              borderRadius: "50%",
              height: orb.size,
              left: x - orb.size / 2,
              opacity: orb.opacity,
              position: "absolute",
              top: y - orb.size / 2,
              width: orb.size,
            }}
          />
        );
      })}
      <div
        style={{
          backgroundImage: `linear-gradient(${COLORS.border} 1px, transparent 1px), linear-gradient(90deg, ${COLORS.border} 1px, transparent 1px)`,
          backgroundSize: "72px 72px",
          inset: 0,
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,.35), transparent 80%)",
          opacity: 0.16,
          position: "absolute",
        }}
      />
    </AbsoluteFill>
  );
}
