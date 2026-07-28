import { AbsoluteFill, Audio, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

import { AnimatedBackground } from "./components/AnimatedBackground";
import {
  ASSETS,
  COLORS,
  CUES,
  PROJECT,
  SOCIAL_DURATION,
  SOCIAL_VOICE_GAIN,
  TEXT,
} from "./constants";
import { DISPLAY, MONO, SANS } from "./fonts";

type BeatModel = {
  color: string;
  end: number;
  label: string;
  start: number;
  stat: string;
};

function SocialBeat({ model }: { model: BeatModel }): React.ReactNode {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = spring({ fps, frame: frame - model.start, config: { damping: 15 } });
  const opacity = interpolate(
    frame,
    [model.start, model.start + 12, model.end - 16, model.end],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <div style={{ alignItems: "center", display: "flex", flexDirection: "column", inset: 0, justifyContent: "center", opacity, position: "absolute", textAlign: "center", transform: `scale(${interpolate(reveal, [0, 1], [0.72, 1])})` }}>
      <div style={{ color: model.color, fontFamily: DISPLAY, fontSize: 330, lineHeight: 0.8 }}>{model.stat}</div>
      <div style={{ color: COLORS.white, fontFamily: MONO, fontSize: 31, letterSpacing: 4, marginTop: 52, maxWidth: 760 }}>{model.label}</div>
    </div>
  );
}

function SocialContent(): React.ReactNode {
  const colors = [COLORS.cobaltBright, COLORS.amber, COLORS.affected];
  return (
    <AbsoluteFill style={{ padding: "110px 70px" }}>
      <div style={{ color: COLORS.white, fontFamily: SANS, fontSize: 48, textAlign: "center" }}>{TEXT.social.question}</div>
      {TEXT.social.beats.map(([stat, label], index) => (
        <SocialBeat key={label} model={{ color: colors[index], end: CUES.socialBeats[index][1], label, start: CUES.socialBeats[index][0], stat }} />
      ))}
      <div style={{ alignItems: "center", bottom: 120, display: "flex", flexDirection: "column", left: 0, position: "absolute", right: 0 }}>
        <Img src={staticFile(ASSETS.logo)} style={{ height: 100, width: 100 }} />
        <div style={{ color: COLORS.white, fontFamily: DISPLAY, fontSize: 58, marginTop: 20 }}>{PROJECT.name}</div>
        <div style={{ color: COLORS.valid, fontFamily: SANS, fontSize: 29, marginTop: 22 }}>{TEXT.social.close}</div>
      </div>
    </AbsoluteFill>
  );
}

export function SocialClip(): React.ReactNode {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [SOCIAL_DURATION - 20, SOCIAL_DURATION], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, opacity: fade }}>
      <AnimatedBackground />
      <Audio src={staticFile(ASSETS.socialAudio)} volume={SOCIAL_VOICE_GAIN} />
      <SocialContent />
    </AbsoluteFill>
  );
}
