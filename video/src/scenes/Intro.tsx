import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Chip, LightBackground, SceneFade, useSpringIn } from "../components/ui";
import { ink, muted, violet } from "../theme";

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo drops in like a coin into a slot: fast fall + bouncy landing + squash.
  const drop = spring({ frame: frame - 4, fps, config: { damping: 9, stiffness: 140, mass: 1 } });
  const y = interpolate(drop, [0, 1], [-700, 0]);
  const landed = frame - 4 - 10;
  const squash = landed > 0 ? 1 - 0.08 * Math.exp(-landed / 4) * Math.cos(landed / 2) : 1;
  const ring = interpolate(frame, [14, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const title = useSpringIn(26);
  const sub = useSpringIn(38);
  const tag = useSpringIn(52);

  return (
    <SceneFade inFrames={6} outFrames={14}>
      <LightBackground />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <div style={{ position: "relative", width: 420, height: 336, marginTop: -40 }}>
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 6,
              width: 520 * ring,
              height: 90 * ring,
              transform: "translateX(-50%)",
              borderRadius: "50%",
              border: `4px solid ${violet[300]}`,
              opacity: 1 - ring,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 0,
              width: 300,
              height: 34,
              transform: `translateX(-50%) scale(${interpolate(drop, [0, 1], [0.3, 1])})`,
              borderRadius: "50%",
              background: "radial-gradient(ellipse, rgba(47,42,134,0.22) 0%, transparent 70%)",
            }}
          />
          <Img
            src={staticFile("logo.png")}
            style={{
              width: 420,
              position: "absolute",
              bottom: 10,
              transform: `translateY(${y}px) scale(${2 - squash}, ${squash})`,
              transformOrigin: "50% 100%",
            }}
          />
        </div>
        <div
          style={{
            fontSize: 150,
            fontWeight: 900,
            color: ink,
            letterSpacing: -6,
            marginTop: 20,
            opacity: title,
            transform: `translateY(${(1 - title) * 40}px)`,
          }}
        >
          Alcancía
        </div>
        <div
          style={{
            fontSize: 48,
            fontWeight: 600,
            color: muted,
            marginTop: 4,
            opacity: sub,
            transform: `translateY(${(1 - sub) * 30}px)`,
          }}
        >
          Save for what you want, <span style={{ color: violet[600] }}>in your own currency.</span>
        </div>
        <div style={{ marginTop: 44, opacity: tag, transform: `scale(${0.85 + tag * 0.15})` }}>
          <Chip tone="white" size={24}>
            <span style={{ color: violet[600] }}>●</span> Agents on Open Rails · Celo
          </Chip>
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};
