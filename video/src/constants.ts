export const FPS = 30;
export const W = 1920;
export const H = 1080;
export const SOCIAL_W = 1080;
export const SOCIAL_H = 1920;
export const SOCIAL_DURATION = 10 * FPS;
export const CROSSFADE = 24;
export const SCENE_GAP = 45;
export const CLOSE_HOLD = 90;
export const VOICE_GAIN = 1.78;
export const SOCIAL_VOICE_GAIN = 2.58;

export const COLORS = {
  affected: "#ef665f",
  affectedSoft: "#3b1b1b",
  amber: "#f2b84b",
  amberSoft: "#3a2c12",
  bg: "#071716",
  bgCard: "rgba(17, 43, 40, 0.82)",
  bgElevated: "#102b28",
  border: "rgba(137, 188, 177, 0.24)",
  cobalt: "#15599c",
  cobaltBright: "#58a6ea",
  cobaltSoft: "#173b5b",
  ink: "#173331",
  line: "#8db7ae",
  mist: "#edf5f1",
  muted: "#8da7a1",
  paper: "#fbfcf8",
  valid: "#62c995",
  validSoft: "#153a2b",
  white: "#f8fcfa",
} as const;

export const ASSETS = {
  agentAudit: "assets/agent-audit.png",
  auditPacket: "assets/audit-packet.png",
  closure: "assets/closure.png",
  controlRoom: "assets/control-room.png",
  evidence: "assets/evidence.png",
  logo: "assets/logo.png",
  policyOps: "assets/policy-ops.png",
  socialAudio: "audio/08-social.mp3",
} as const;

export const PROJECT = {
  eyebrow: "POLICY CHANGE INCIDENT RESPONSE",
  name: "PolicyDiff Relay",
  tagline: "Trace the change to every answer it touched.",
  url: "policydiff-relay-8292a74a.base44.app",
} as const;

export const AUDIO_DURATIONS = {
  agentAudit: Math.round(14.86 * FPS),
  close: Math.round(7.78 * FPS),
  closure: Math.round(14.34 * FPS),
  evidence: Math.round(14.9 * FPS),
  hook: Math.round(10.22 * FPS),
  incident: Math.round(13.94 * FPS),
  problem: Math.round(6.22 * FPS),
} as const;

export const SCENE_DURATIONS = {
  hook: AUDIO_DURATIONS.hook + SCENE_GAP,
  problem: AUDIO_DURATIONS.problem + SCENE_GAP,
  incident: AUDIO_DURATIONS.incident + SCENE_GAP,
  evidence: AUDIO_DURATIONS.evidence + SCENE_GAP,
  closure: AUDIO_DURATIONS.closure + SCENE_GAP,
  agentAudit: AUDIO_DURATIONS.agentAudit + SCENE_GAP,
  close: AUDIO_DURATIONS.close + SCENE_GAP + CLOSE_HOLD,
} as const;

export type SceneId = keyof typeof SCENE_DURATIONS;

export const AUDIO_FILES: Record<SceneId, string> = {
  agentAudit: "audio/06-agent-audit.mp3",
  close: "audio/07-close.mp3",
  closure: "audio/05-closure.mp3",
  evidence: "audio/04-evidence.mp3",
  hook: "audio/01-hook.mp3",
  incident: "audio/03-incident.mp3",
  problem: "audio/02-problem.mp3",
};

export const TOTAL_FRAMES =
  Object.values(SCENE_DURATIONS).reduce((total, value) => total + value, 0) -
  CROSSFADE * (Object.keys(SCENE_DURATIONS).length - 1);


export const ORBS = [
  { baseX: 240, baseY: 180, size: 520, color: COLORS.cobalt, opacity: 0.18, speed: 0.008 },
  { baseX: 1640, baseY: 820, size: 620, color: COLORS.valid, opacity: 0.11, speed: 0.006 },
  { baseX: 1500, baseY: 140, size: 460, color: COLORS.cobaltBright, opacity: 0.1, speed: 0.009 },
] as const;

export const CUES = {
  evidenceNodes: [32, 72, 112],
  closureSteps: [35, 105, 175, 245],
  incidentNodes: [145, 185, 225],
  socialBeats: [
    [0, 100],
    [80, 205],
    [185, SOCIAL_DURATION],
  ],
} as const;

export { SUBTITLE_SENTENCES, TEXT } from "./content";
