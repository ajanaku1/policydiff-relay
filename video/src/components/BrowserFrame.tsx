import type { CSSProperties } from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";

import { COLORS } from "../constants";

type BrowserFrameModel = {
  delay?: number;
  image: string;
  imageStyle?: CSSProperties;
  style?: CSSProperties;
  title: string;
};

export function BrowserFrame({ model }: { model: BrowserFrameModel }): React.ReactNode {
  const frame = useCurrentFrame();
  const delay = model.delay ?? 0;
  const opacity = interpolate(frame, [delay, delay + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 22, boxShadow: `0 30px 100px ${COLORS.bg}`, opacity, overflow: "hidden", ...model.style }}>
      <div style={{ alignItems: "center", background: COLORS.bgElevated, borderBottom: `1px solid ${COLORS.border}`, display: "flex", gap: 10, height: 50, padding: "0 18px" }}>
        {[COLORS.affected, COLORS.amber, COLORS.valid].map((color) => (
          <span key={color} style={{ background: color, borderRadius: "50%", height: 10, width: 10 }} />
        ))}
        <span style={{ color: COLORS.muted, fontFamily: "monospace", fontSize: 13, marginLeft: 12 }}>{model.title}</span>
      </div>
      <div style={{ background: COLORS.paper, overflow: "hidden" }}>
        <Img src={staticFile(model.image)} style={{ display: "block", width: "100%", ...model.imageStyle }} />
      </div>
    </div>
  );
}
