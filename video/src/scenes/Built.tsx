import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { LightBackground, SceneFade, SceneTitle, useSpringIn } from "../components/ui";
import { gold, ink, muted, violet } from "../theme";

const PHASE_B = 7.5 * 30;

const LAYERS = [
  { icon: "🙋", title: "You", sub: "Your own wallet — you sign, you own", tone: 0 },
  { icon: "💬", title: "The app", sub: "Next.js · AI SDK · Claude via Vercel AI Gateway", tone: 1 },
  { icon: "🤖", title: "The agent", sub: "Own wallet · ERC-8004 #9911 · cycle every 15 min", tone: 2 },
  { icon: "⛓️", title: "Celo mainnet", sub: "AlcanciaFactory + one Alcancía per goal", tone: 3 },
];

const LAYER_H = 128;
const GAP = 34;
const TOP = 270;
const LEFT = 200;
const LAYER_W = 1040;

const SIDE = [
  { layer: 1, title: "Ripio Ramp", sub: "fiat ↔ wARS · wBRL · wMXN…", gold: false },
  { layer: 2, title: "Textile FX", sub: "RFQ · local → USD₮ → local", gold: false, offset: -34 },
  { layer: 2, title: "buy · usebuy.ai", sub: "SQD (free) + Chainstack x402", gold: true, offset: 70 },
];

const Layer: React.FC<{ i: number }> = ({ i }) => {
  const l = LAYERS[i];
  const p = useSpringIn(10 + i * 12);
  const bg = [ "#ffffff", violet[50], violet[100], violet[600] ][l.tone];
  const dark = l.tone === 3;
  return (
    <div
      style={{
        position: "absolute",
        left: LEFT,
        top: TOP + i * (LAYER_H + GAP),
        width: LAYER_W,
        height: LAYER_H,
        borderRadius: 30,
        background: dark ? `linear-gradient(135deg, ${violet[600]}, ${violet[800]})` : bg,
        border: dark ? "none" : `2px solid ${violet[200]}`,
        boxShadow: "0 20px 50px rgba(47,42,134,0.12)",
        display: "flex",
        alignItems: "center",
        gap: 28,
        padding: "0 36px",
        opacity: p,
        transform: `translateX(${(1 - p) * -80}px)`,
      }}
    >
      <div
        style={{
          width: 76,
          height: 76,
          borderRadius: 22,
          background: dark ? "rgba(255,255,255,0.16)" : "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 42,
          boxShadow: dark ? "none" : "0 6px 18px rgba(47,42,134,0.1)",
        }}
      >
        {l.icon}
      </div>
      <div>
        <div style={{ fontSize: 40, fontWeight: 800, color: dark ? "#fff" : ink, letterSpacing: -1 }}>{l.title}</div>
        <div style={{ fontSize: 26, fontWeight: 500, color: dark ? violet[100] : muted, marginTop: 2 }}>{l.sub}</div>
      </div>
    </div>
  );
};

const Arrow: React.FC<{ i: number }> = ({ i }) => {
  const p = useSpringIn(16 + i * 12);
  return (
    <div
      style={{
        position: "absolute",
        left: LEFT + LAYER_W / 2 - 14,
        top: TOP + (i + 1) * LAYER_H + i * GAP + 2,
        width: 28,
        height: GAP - 4,
        display: "flex",
        justifyContent: "center",
        opacity: p,
        color: violet[400],
        fontSize: 28,
        lineHeight: `${GAP - 4}px`,
        fontWeight: 900,
      }}
    >
      ↕
    </div>
  );
};

const SideChip: React.FC<{ s: (typeof SIDE)[number]; idx: number }> = ({ s, idx }) => {
  const p = useSpringIn(62 + idx * 12, { damping: 13 });
  const cy = TOP + s.layer * (LAYER_H + GAP) + LAYER_H / 2 + (s.offset ?? 0);
  const x = LEFT + LAYER_W + 90;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: LEFT + LAYER_W,
          top: cy - 2,
          width: 90 * p,
          height: 0,
          borderTop: `4px dashed ${s.gold ? gold.main : violet[300]}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x,
          top: cy - 46,
          width: 470,
          height: 92,
          borderRadius: 24,
          background: s.gold ? "#fffbeb" : "#ffffff",
          border: `2px solid ${s.gold ? "#fde68a" : violet[200]}`,
          boxShadow: "0 14px 34px rgba(47,42,134,0.12)",
          padding: "0 26px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          opacity: p,
          transform: `scale(${0.8 + 0.2 * p})`,
          transformOrigin: "0% 50%",
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 800, color: s.gold ? "#92400e" : violet[700] }}>{s.title}</div>
        <div style={{ fontSize: 21, fontWeight: 500, color: muted, marginTop: 2 }}>{s.sub}</div>
      </div>
    </>
  );
};

const CYCLE = [
  { icon: "⏰", title: "Wake up", sub: "Every 15 minutes" },
  { icon: "🔎", title: "Detect income", sub: "SQD indexer — free, via buy" },
  { icon: "🐷", title: "Split & deposit", sub: "Each goal's % → its alcancía. Trips convert via Textile FX" },
  { icon: "🧾", title: "Pay its own infra", sub: "Chainstack RPC · US$0.01 per cycle via x402" },
];

const CycleStep: React.FC<{ i: number }> = ({ i }) => {
  const p = useSpringIn(12 + i * 16, { damping: 14 });
  const c = CYCLE[i];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <div
        style={{
          width: 370,
          height: 430,
          borderRadius: 34,
          background: "#ffffff",
          border: `2px solid ${violet[100]}`,
          boxShadow: "0 24px 60px rgba(47,42,134,0.13)",
          padding: "40px 34px",
          opacity: p,
          transform: `translateY(${(1 - p) * 60}px)`,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 64 }}>{c.icon}</div>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              background: violet[600],
              color: "#fff",
              fontWeight: 900,
              fontSize: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {i + 1}
          </div>
        </div>
        <div style={{ fontSize: 40, fontWeight: 800, color: ink, letterSpacing: -1, marginTop: 10 }}>{c.title}</div>
        <div style={{ fontSize: 26, fontWeight: 500, color: muted, lineHeight: 1.35 }}>{c.sub}</div>
      </div>
      {i < CYCLE.length - 1 ? (
        <div style={{ fontSize: 44, color: violet[400], fontWeight: 900, opacity: p }}>→</div>
      ) : null}
    </div>
  );
};

const CyclePhase: React.FC = () => {
  const tag = useSpringIn(80);
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 130, flexDirection: "column" }}>
      <SceneTitle kicker="The agent cycle" title="Runs on its own, every 15 min" />
      <div style={{ display: "flex", gap: 20, marginTop: 70 }}>
        {CYCLE.map((_, i) => (
          <CycleStep key={i} i={i} />
        ))}
      </div>
      <div style={{ marginTop: 56, opacity: tag, fontSize: 30, fontWeight: 700, color: violet[700] }}>
        Every transaction carries an ERC-8021 attribution tag · money only ever returns to the owner
      </div>
    </AbsoluteFill>
  );
};

export const Built: React.FC = () => {
  const frame = useCurrentFrame();
  const aOut = interpolate(frame, [PHASE_B - 14, PHASE_B], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <SceneFade>
      <LightBackground coins={false} />
      {frame < PHASE_B && (
        <AbsoluteFill style={{ opacity: aOut, transform: `scale(${0.96 + 0.04 * aOut})` }}>
          <AbsoluteFill style={{ alignItems: "center", paddingTop: 70 }}>
            <SceneTitle kicker="How it's built" title="Four layers, real rails" />
          </AbsoluteFill>
          {LAYERS.map((_, i) => (
            <Layer key={i} i={i} />
          ))}
          {[0, 1, 2].map((i) => (
            <Arrow key={i} i={i} />
          ))}
          {SIDE.map((s, i) => (
            <SideChip key={i} s={s} idx={i} />
          ))}
        </AbsoluteFill>
      )}
      <Sequence from={PHASE_B - 4} layout="none">
        <CyclePhase />
      </Sequence>
    </SceneFade>
  );
};
