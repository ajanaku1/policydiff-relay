import { AbsoluteFill, useCurrentFrame } from "remotion";

import {
  AUDIO_DURATIONS,
  COLORS,
  type SceneId,
  SUBTITLE_SENTENCES,
} from "../constants";
import { SANS } from "../fonts";

function wordCount(value: string): number {
  return value.trim().split(/\s+/).length;
}

function activeSubtitle(sceneId: SceneId, frame: number): string | undefined {
  const sentences = SUBTITLE_SENTENCES[sceneId];
  const totalWords = sentences.reduce((total, sentence) => total + wordCount(sentence), 0);
  let wordsBefore = 0;
  for (const sentence of sentences) {
    const start = Math.round((wordsBefore / totalWords) * AUDIO_DURATIONS[sceneId]);
    wordsBefore += wordCount(sentence);
    const end = Math.round((wordsBefore / totalWords) * AUDIO_DURATIONS[sceneId]);
    if (frame >= start && frame < end) return sentence;
  }
  return undefined;
}

export function SceneSubtitles({ sceneId }: { sceneId: SceneId }): React.ReactNode {
  const sentence = activeSubtitle(sceneId, useCurrentFrame());
  if (!sentence) return null;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", pointerEvents: "none", zIndex: 80 }}>
      <div style={{ background: `${COLORS.bg}e8`, border: `1px solid ${COLORS.border}`, borderRadius: 16, color: COLORS.white, fontFamily: SANS, fontSize: 28, fontWeight: 600, lineHeight: 1.35, marginBottom: 42, maxWidth: 1420, padding: "14px 28px", textAlign: "center" }}>
        {sentence}
      </div>
    </AbsoluteFill>
  );
}
