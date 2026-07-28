# Video decisions

## Rendering pipeline

**Recommendation:** Use the installed FFmpeg renderer with isolated media
artifacts.

**Rationale:** The project forbids new dependencies. Remotion is not installed,
so adding it would alter the application dependency graph. The render still
follows the demo-video narrative, measured-audio, animation, subtitle, and
real-only rules.

**Override:** Install Remotion in an isolated video workspace and recreate the
same six-scene timeline.

## Voice

**Recommendation:** Use the local Samantha system voice at a measured demo pace.

**Rationale:** External Gemini TTS rejected the project-specific narration
payload. Local synthesis keeps project text on the machine.

**Override:** Regenerate `public/audio/*.aiff` with an explicitly authorized TTS
provider, then rerun the media render.

## Music

**Recommendation:** No background music.

**Rationale:** The policy incident and audit evidence benefit from clear,
unmasked narration.

**Override:** Add a licensed low-volume bed in the final FFmpeg mix.
