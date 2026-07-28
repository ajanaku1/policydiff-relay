import type { ComponentType, ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";

import { SceneAudio } from "./components/SceneAudio";
import { SceneSubtitles } from "./components/SceneSubtitles";
import {
  AUDIO_DURATIONS,
  AUDIO_FILES,
  COLORS,
  CROSSFADE,
  type SceneId,
  SCENE_DURATIONS,
} from "./constants";
import { AgentAudit } from "./scenes/AgentAudit";
import { Close } from "./scenes/Close";
import { Closure } from "./scenes/Closure";
import { Evidence } from "./scenes/Evidence";
import { Hook } from "./scenes/Hook";
import { Incident } from "./scenes/Incident";
import { Problem } from "./scenes/Problem";

type SceneDefinition = {
  Component: ComponentType;
  id: SceneId;
};

const scenes: SceneDefinition[] = [
  { Component: Hook, id: "hook" },
  { Component: Problem, id: "problem" },
  { Component: Incident, id: "incident" },
  { Component: Evidence, id: "evidence" },
  { Component: Closure, id: "closure" },
  { Component: AgentAudit, id: "agentAudit" },
  { Component: Close, id: "close" },
];

function renderScenes(): ReactNode[] {
  const timing = linearTiming({ durationInFrames: CROSSFADE });
  return scenes.flatMap(({ Component, id }, index) => {
    const elements: ReactNode[] = [
      <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS[id]} key={id}>
        <Component />
        <SceneAudio model={{ audioDuration: AUDIO_DURATIONS[id], source: AUDIO_FILES[id] }} />
        <SceneSubtitles sceneId={id} />
      </TransitionSeries.Sequence>,
    ];
    if (index < scenes.length - 1) {
      elements.push(
        <TransitionSeries.Transition key={`${id}-fade`} presentation={fade()} timing={timing} />,
      );
    }
    return elements;
  });
}

export function MainVideo(): React.ReactNode {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <TransitionSeries>{renderScenes()}</TransitionSeries>
    </AbsoluteFill>
  );
}
