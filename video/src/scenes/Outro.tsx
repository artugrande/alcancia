import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { Chip, LightBackground, SceneFade, useSpringIn } from "../components/ui";
import { ink, muted, violet } from "../theme";

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const logo = useSpringIn(0, { damping: 10 });
  const a = useSpringIn(14);
  const b = useSpringIn(26);
  const float = Math.sin(frame / 14) * 8;
  return (
    <SceneFade inFrames={10} outFrames={24}>
      <LightBackground />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <Img
          src={staticFile("logo.png")}
          style={{ width: 300, transform: `translateY(${float}px) scale(${logo})` }}
        />
        <div style={{ fontSize: 110, fontWeight: 900, color: ink, letterSpacing: -4, marginTop: 10, opacity: a }}>
          Alcancía
        </div>
        <div
          style={{
            fontSize: 50,
            fontWeight: 700,
            color: muted,
            marginTop: 10,
            opacity: a,
            transform: `translateY(${(1 - a) * 20}px)`,
          }}
        >
          Try it: <span style={{ color: violet[600] }}>alcancia-celo.vercel.app</span>
        </div>
        <div style={{ marginTop: 40, opacity: b, transform: `scale(${0.9 + 0.1 * b})` }}>
          <Chip tone="white" size={28}>
            ⌨️ github.com/artugrande/alcancia
          </Chip>
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};
