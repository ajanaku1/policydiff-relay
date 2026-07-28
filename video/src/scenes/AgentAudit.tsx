import { interpolate, useCurrentFrame } from "remotion";

import { AnimatedBackground } from "../components/AnimatedBackground";
import { BrandPin } from "../components/BrandPin";
import { BrowserFrame } from "../components/BrowserFrame";
import { GlassCard } from "../components/GlassCard";
import { ASSETS, COLORS, TEXT } from "../constants";
import { DISPLAY, MONO, SANS } from "../fonts";

function AgentBoundary(): React.ReactNode {
  const frame = useCurrentFrame();
  const visible = Math.max(0, Math.floor((frame - 95) * 0.75));
  return (
    <GlassCard model={{ borderColor: COLORS.cobaltBright, delay: 24, style: { padding: 26 } }}>
      <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: COLORS.cobaltBright, fontFamily: MONO, fontSize: 15 }}>{TEXT.agentAudit.agentLabel}</span>
        <span style={{ border: `1px solid ${COLORS.border}`, borderRadius: 999, color: COLORS.muted, fontFamily: MONO, fontSize: 12, padding: "8px 12px" }}>{TEXT.agentAudit.tool}</span>
      </div>
      <p style={{ color: COLORS.white, fontFamily: SANS, fontSize: 20, lineHeight: 1.55, minHeight: 120 }}>{TEXT.agentAudit.answer.slice(0, visible)}{visible < TEXT.agentAudit.answer.length ? "_" : ""}</p>
    </GlassCard>
  );
}

function AuditProof(): React.ReactNode {
  const frame = useCurrentFrame();
  return (
    <GlassCard model={{ borderColor: COLORS.valid, delay: 150, style: { padding: 26 } }}>
      <div style={{ color: COLORS.valid, fontFamily: MONO, fontSize: 15, letterSpacing: 2 }}>{TEXT.agentAudit.auditLabel}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "20px 0" }}>
        {TEXT.agentAudit.auditItems.map((item, index) => <span key={item} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 999, color: COLORS.white, fontFamily: SANS, fontSize: 15, opacity: interpolate(frame, [175 + index * 18, 195 + index * 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), padding: "9px 13px" }}>{item}</span>)}
      </div>
      <div style={{ color: COLORS.cobaltBright, fontFamily: MONO, fontSize: 13 }}>{TEXT.agentAudit.signed}</div>
    </GlassCard>
  );
}

export function AgentAudit(): React.ReactNode {
  return (
    <div style={{ height: "100%", padding: "138px 70px 72px", position: "relative" }}>
      <AnimatedBackground />
      <BrandPin />
      <h1 style={{ color: COLORS.white, fontFamily: DISPLAY, fontSize: 60, margin: "0 0 30px", position: "relative", zIndex: 2 }}>{TEXT.agentAudit.title}</h1>
      <div style={{ display: "grid", gap: 24, gridTemplateColumns: "1.15fr 0.85fr", position: "relative", zIndex: 2 }}>
        <div style={{ display: "grid", gap: 20 }}>
          <AgentBoundary />
          <BrowserFrame model={{ delay: 70, image: ASSETS.policyOps, imageStyle: { transform: "scale(1.03)", transformOrigin: "right bottom" }, style: { height: 405 }, title: TEXT.agentAudit.agentLabel }} />
        </div>
        <div style={{ display: "grid", gap: 20 }}>
          <AuditProof />
          <BrowserFrame model={{ delay: 170, image: ASSETS.auditPacket, imageStyle: { transform: "scale(1.05)", transformOrigin: "center top" }, style: { height: 405 }, title: TEXT.agentAudit.auditLabel }} />
        </div>
      </div>
    </div>
  );
}
