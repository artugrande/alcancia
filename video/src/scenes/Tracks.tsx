import React from "react";
import { AbsoluteFill } from "remotion";
import { Chip, LightBackground, SceneFade, SceneTitle, useSpringIn } from "../components/ui";
import { ink, muted, violet } from "../theme";

const TRACKS = [
  {
    tag: "Track 1 · Main",
    title: "Stable Agents LatAm",
    by: "Ripio × Celo",
    main: true,
    bullets: [
      "Income arrives in Ripio wFiat: wARS, wBRL, wMXN, wCOP, wPEN, wCLP",
      "Agent splits every paycheck into onchain piggy banks",
      "On/off ramp with Ripio Ramp",
    ],
  },
  {
    tag: "Track 2A rails",
    title: "Textile FX",
    by: "Real FX volume",
    main: false,
    bullets: [
      "Trips save in the currency you'll spend in",
      "RFQ in two legs: local → USD₮ → local",
      "Volume comes from people actually saving",
    ],
  },
  {
    tag: "Track 3",
    title: "Build with buy",
    by: "usebuy.ai",
    main: false,
    bullets: [
      "The agent pays for its own infrastructure via gateway.usebuy.ai",
      "SQD indexer (free) detects every paycheck",
      "Chainstack Celo RPC · US$0.01 per cycle via x402",
    ],
  },
];

const TrackCard: React.FC<{ i: number }> = ({ i }) => {
  const t = TRACKS[i];
  const p = useSpringIn(24 + i * 26);
  const dark = t.main;
  return (
    <div
      style={{
        width: 520,
        height: 560,
        borderRadius: 38,
        padding: "44px 42px",
        background: dark ? `linear-gradient(160deg, ${violet[600]} 0%, ${violet[800]} 100%)` : "#ffffff",
        border: dark ? "none" : `2px solid ${violet[100]}`,
        boxShadow: dark ? "0 40px 90px rgba(76,61,224,0.4)" : "0 26px 70px rgba(47,42,134,0.12)",
        opacity: p,
        transform: `translateY(${(1 - p) * 80}px) scale(${(dark ? 1.03 : 1) * (0.92 + 0.08 * p)})`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div>
        <Chip tone={dark ? "glass" : "violet"} size={21}>
          {t.tag}
        </Chip>
      </div>
      <div style={{ fontSize: 46, fontWeight: 900, color: dark ? "#fff" : ink, letterSpacing: -1.5, marginTop: 26, lineHeight: 1.05 }}>
        {t.title}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: dark ? "#fbbf24" : violet[600], marginTop: 8 }}>{t.by}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 30 }}>
        {t.bullets.map((b, k) => (
          <div key={k} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                marginTop: 12,
                flexShrink: 0,
                background: dark ? "#fbbf24" : violet[400],
              }}
            />
            <div style={{ fontSize: 26, fontWeight: 500, lineHeight: 1.35, color: dark ? violet[50] : muted }}>{b}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const Tracks: React.FC = () => {
  const foot = useSpringIn(95);
  return (
    <SceneFade>
      <LightBackground coins={false} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 70, flexDirection: "column" }}>
        <SceneTitle kicker="Agents on Open Rails" title="Built for three tracks" />
        <div style={{ display: "flex", gap: 40, marginTop: 56, alignItems: "center" }}>
          {TRACKS.map((_, i) => (
            <TrackCard key={i} i={i} />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            gap: 20,
            marginTop: 52,
            opacity: foot,
            transform: `translateY(${(1 - foot) * 20}px)`,
          }}
        >
          <Chip tone="white" size={26}>🪪 ERC-8004 #9911</Chip>
          <Chip tone="white" size={26}>🏷️ ERC-8021 on every tx</Chip>
          <Chip tone="gold" size={26}>🟡 Celo mainnet</Chip>
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};
