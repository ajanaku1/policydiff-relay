import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";

import { ASSETS, COLORS, PROJECT } from "../constants";
import { DISPLAY } from "../fonts";

export function BrandPin(): React.ReactNode {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 16], [0, 1], {
    extrapolateRight: "clamp",
  });
  return (
    <div style={{ alignItems: "center", display: "flex", gap: 14, left: 64, opacity, position: "absolute", top: 48, zIndex: 40 }}>
      <Img src={staticFile(ASSETS.logo)} style={{ height: 46, width: 46 }} />
      <span style={{ color: COLORS.white, fontFamily: DISPLAY, fontSize: 25, fontWeight: 700 }}>
        {PROJECT.name}
      </span>
    </div>
  );
}
