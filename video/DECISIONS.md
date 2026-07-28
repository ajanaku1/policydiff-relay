# Video decisions

## Rendering pipeline

**Recommendation:** Use isolated Remotion compositions with FFmpeg limited to
media preparation and validation.

**Rationale:** The application dependency graph stays untouched while Remotion
provides real scene composition, animated evidence, audio envelopes, and
subtitles.

**Override:** The previous FFmpeg renderer remains in version history if a
minimal fallback is needed.

**Affected files:** `package.json`, `src/`, and `out/`.

## Voice

**Recommendation:** Use StableVoice Emmanuel for a polished, articulate demo
read.

**Rationale:** The delivery should feel authoritative without becoming a movie
trailer. Scene audio remains separate so measured duration controls each scene.

**Override:** Replace the eight MP3 files and update measured durations in
`src/constants.ts`.

**Affected files:** `public/audio/`, `src/constants.ts`.

## Music

**Recommendation:** No background music.

**Rationale:** Animated soundless space and a stronger voiceover keep the policy
incident clear. The new pacing no longer depends on music for energy.

**Override:** Add a licensed bed through Remotion's audio composition at low
volume.

**Affected files:** `public/audio/`, `src/MainVideo.tsx`.

## Scene strategy

**Recommendation:** Use Strategy C with seven scenes and 24-frame fades.

**Rationale:** Each scene owns its narration while the silent scene gap prevents
voice overlap during transitions.

**Override:** Change `CROSSFADE` or `SCENE_GAP` in `src/constants.ts`.

**Affected files:** `src/constants.ts`.

## Vertical clip

**Recommendation:** Use a narrated three-beat escalation: one changed sentence,
three dependent answers, one answer now wrong.

**Rationale:** Each spoken fact changes the composition, so the ten-second cut
works as a story instead of a static end card.

**Override:** Change `CUES.socialBeats` only after measuring a replacement
voiceover.

**Affected files:** `src/SocialClip.tsx`, `src/constants.ts`.
