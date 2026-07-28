import { Audio, interpolate, staticFile } from "remotion";

import { FPS, VOICE_GAIN } from "../constants";

type SceneAudioModel = {
  audioDuration: number;
  source: string;
};

export function SceneAudio({ model }: { model: SceneAudioModel }): React.ReactNode {
  return (
    <Audio
      src={staticFile(model.source)}
      volume={(frame) => {
        const fadeIn = interpolate(frame, [0, Math.round(FPS * 0.25)], [0, 1], {
          extrapolateRight: "clamp",
        });
        const fadeOut = interpolate(
          frame,
          [model.audioDuration - FPS, model.audioDuration],
          [1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        return Math.min(fadeIn, fadeOut) * VOICE_GAIN;
      }}
    />
  );
}
