import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily, gold, ink, violet } from "../theme";

/** Spring progress 0→1 starting at `delay` frames. */
export const useSpringIn = (delay = 0, config: { damping?: number; stiffness?: number; mass?: number } = {}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame: frame - delay,
    fps,
    config: { damping: 16, stiffness: 120, mass: 0.9, ...config },
  });
};

/** Fades a whole scene in and out. */
export const SceneFade: React.FC<{ children: React.ReactNode; inFrames?: number; outFrames?: number }> = ({
  children,
  inFrames = 12,
  outFrames = 12,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = interpolate(
    frame,
    [0, inFrames, durationInFrames - outFrames, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return <AbsoluteFill style={{ opacity, fontFamily }}>{children}</AbsoluteFill>;
};

/** Soft light background with drifting blurred blobs and a few floating coins. */
export const LightBackground: React.FC<{ coins?: boolean }> = ({ coins = true }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, #ffffff 0%, ${violet[50]} 55%, ${violet[100]} 100%)` }}>
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          left: -250 + Math.sin(t * 0.3) * 40,
          top: -350 + Math.cos(t * 0.25) * 30,
          background: `radial-gradient(circle, ${violet[200]}aa 0%, transparent 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          right: -260 + Math.cos(t * 0.27) * 40,
          bottom: -320 + Math.sin(t * 0.22) * 30,
          background: `radial-gradient(circle, ${gold.light}88 0%, transparent 70%)`,
        }}
      />
      {coins &&
        [
          { x: 140, y: 820, s: 46, d: 0 },
          { x: 1720, y: 210, s: 38, d: 2 },
          { x: 1630, y: 880, s: 28, d: 4 },
          { x: 300, y: 170, s: 24, d: 1 },
        ].map((c, i) => (
          <Coin key={i} size={c.s} style={{ position: "absolute", left: c.x, top: c.y + Math.sin(t * 0.9 + c.d) * 14, opacity: 0.55 }} />
        ))}
    </AbsoluteFill>
  );
};

/** Violet gradient background used behind the demo clips. */
export const VioletBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(135deg, ${violet[700]} 0%, ${violet[600]} 45%, ${violet[900]} 100%)` }}>
      <div
        style={{
          position: "absolute",
          width: 1100,
          height: 1100,
          borderRadius: "50%",
          left: -300 + Math.sin(t * 0.2) * 60,
          top: -500,
          background: `radial-gradient(circle, ${violet[400]}88 0%, transparent 65%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          right: -300,
          bottom: -450 + Math.cos(t * 0.2) * 60,
          background: `radial-gradient(circle, ${gold.deep}44 0%, transparent 65%)`,
        }}
      />
    </AbsoluteFill>
  );
};

export const Coin: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: `radial-gradient(circle at 35% 30%, ${gold.light} 0%, ${gold.main} 45%, ${gold.deep} 100%)`,
      boxShadow: `inset -${size * 0.08}px -${size * 0.08}px 0 ${gold.deep}, 0 ${size * 0.15}px ${size * 0.4}px rgba(245,158,11,0.35)`,
      ...style,
    }}
  />
);

export const Chip: React.FC<{
  children: React.ReactNode;
  tone?: "violet" | "gold" | "white" | "glass";
  size?: number;
  style?: React.CSSProperties;
}> = ({ children, tone = "violet", size = 24, style }) => {
  const tones: Record<string, React.CSSProperties> = {
    violet: { background: violet[100], color: violet[800], border: `2px solid ${violet[200]}` },
    gold: { background: "#fef3c7", color: "#92400e", border: "2px solid #fde68a" },
    white: { background: "#ffffff", color: ink, border: `2px solid ${violet[100]}`, boxShadow: "0 6px 20px rgba(47,42,134,0.08)" },
    glass: { background: "rgba(255,255,255,0.14)", color: "#ffffff", border: "2px solid rgba(255,255,255,0.28)" },
  };
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: `${size * 0.42}px ${size * 0.9}px`,
        borderRadius: 999,
        fontSize: size,
        fontWeight: 700,
        letterSpacing: -0.2,
        whiteSpace: "nowrap",
        ...tones[tone],
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Title used at the top of the explainer scenes. */
export const SceneTitle: React.FC<{ kicker: string; title: string; delay?: number }> = ({ kicker, title, delay = 0 }) => {
  const p = useSpringIn(delay);
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 30}px)`, textAlign: "center" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: violet[600], letterSpacing: 4, textTransform: "uppercase" }}>
        {kicker}
      </div>
      <div style={{ fontSize: 68, fontWeight: 900, color: ink, letterSpacing: -2, marginTop: 10 }}>{title}</div>
    </div>
  );
};
