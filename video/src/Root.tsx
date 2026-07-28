import { Composition, registerRoot } from "remotion";

import {
  FPS,
  H,
  SOCIAL_DURATION,
  SOCIAL_H,
  SOCIAL_W,
  TOTAL_FRAMES,
  W,
} from "./constants";
import { MainVideo } from "./MainVideo";
import { SocialClip } from "./SocialClip";

export function RemotionRoot(): React.ReactNode {
  return (
    <>
      <Composition component={MainVideo} durationInFrames={TOTAL_FRAMES} fps={FPS} height={H} id="Main" width={W} />
      <Composition component={SocialClip} durationInFrames={SOCIAL_DURATION} fps={FPS} height={SOCIAL_H} id="Social" width={SOCIAL_W} />
    </>
  );
}

registerRoot(RemotionRoot);
