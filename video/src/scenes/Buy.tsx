import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BUY_RECEIPT_TX } from "../clips";
import { Chip, LightBackground, SceneFade, SceneTitle, useSpringIn } from "../components/ui";
import { gold, ink, muted, violet } from "../theme";

// Layout (px, 1920x1080)
const ROW_Y = 548; // centre line of the main flow
const AGENT = { x: 70, w: 340, h: 280 };
const GATE = { x: 480, w: 400, h: 300 };
const BR = { x: 970, w: 480 };
const SQD = { y: 316, h: 204 };
const RPC = { y: 544, h: 236 };
const RCPT = { x: 1530, w: 330, h: 300 };

const shortHash = (h: string) => (h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h);

type Pt = { x: number; y: number };
const bez = (a: Pt, b: Pt, t: number): Pt => {
  // horizontal-tangent cubic bezier between a and b
  const mx = (a.x + b.x) / 2;
  const c1 = { x: mx, y: a.y };
  const c2 = { x: mx, y: b.y };
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
  };
};
const pathD = (a: Pt, b: Pt) => {
  const mx = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
};

const LINKS: { a: Pt; b: Pt; start: number; color: string }[] = [
  { a: { x: AGENT.x + AGENT.w, y: ROW_Y }, b: { x: GATE.x, y: ROW_Y }, start: 30, color: violet[400] },
  { a: { x: GATE.x + GATE.w, y: ROW_Y }, b: { x: BR.x, y: SQD.y + SQD.h / 2 }, start: 64, color: violet[400] },
  { a: { x: GATE.x + GATE.w, y: ROW_Y }, b: { x: BR.x, y: RPC.y + RPC.h / 2 }, start: 76, color: gold.deep },
  { a: { x: BR.x + BR.w, y: RPC.y + RPC.h / 2 }, b: { x: RCPT.x, y: ROW_Y }, start: 120, color: gold.deep },
];

const Links: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
      {LINKS.map((l, i) => {
        const p = interpolate(frame, [l.start, l.start + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const len = 700;
        // a little "payment" dot travelling along each link, looping
        const t = ((frame - l.start - 16) % 40) / 40;
        const dot = bez(l.a, l.b, Math.max(0, t));
        return (
          <g key={i}>
            <path
              d={pathD(l.a, l.b)}
              fill="none"
              stroke={l.color}
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={len}
              strokeDashoffset={len * (1 - p)}
              opacity={0.85}
            />
            {frame > l.start + 16 ? <circle cx={dot.x} cy={dot.y} r={9} fill={l.color === gold.deep ? gold.main : violet[500]} /> : null}
          </g>
        );
      })}
    </svg>
  );
};

const Card: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  delay: number;
  tone?: "white" | "violet" | "gold";
  children: React.ReactNode;
}> = ({ x, y, w, h, delay, tone = "white", children }) => {
  const p = useSpringIn(delay, { damping: 14 });
  const styles: Record<string, React.CSSProperties> = {
    white: { background: "#ffffff", border: `2px solid ${violet[100]}` },
    violet: { background: `linear-gradient(150deg, ${violet[600]}, ${violet[800]})`, border: "none", color: "#fff" },
    gold: { background: "#fffbeb", border: "2px solid #fde68a" },
  };
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 30,
        padding: "28px 30px",
        boxSizing: "border-box",
        boxShadow: tone === "violet" ? "0 30px 70px rgba(76,61,224,0.35)" : "0 22px 56px rgba(47,42,134,0.12)",
        opacity: p,
        transform: `translateY(${(1 - p) * 50}px) scale(${0.9 + 0.1 * p})`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        ...styles[tone],
      }}
    >
      {children}
    </div>
  );
};

const Icon: React.FC<{ children: React.ReactNode; dark?: boolean }> = ({ children, dark }) => (
  <div
    style={{
      width: 70,
      height: 70,
      borderRadius: 20,
      fontSize: 40,
      lineHeight: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: dark ? "rgba(255,255,255,0.16)" : violet[50],
      flexShrink: 0,
    }}
  >
    {children}
  </div>
);

const T: React.FC<{ children: React.ReactNode; color?: string; size?: number }> = ({ children, color = ink, size = 34 }) => (
  <div style={{ fontSize: size, fontWeight: 800, color, letterSpacing: -0.8, lineHeight: 1.1 }}>{children}</div>
);
const S: React.FC<{ children: React.ReactNode; color?: string; size?: number }> = ({ children, color = muted, size = 22 }) => (
  <div style={{ fontSize: size, fontWeight: 500, color, lineHeight: 1.35 }}>{children}</div>
);

export const Buy: React.FC = () => {
  const foot = useSpringIn(165);
  const chips = useSpringIn(185);
  const rowTop = (h: number) => ROW_Y - h / 2;
  return (
    <SceneFade>
      <LightBackground coins={false} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 56 }}>
        <SceneTitle kicker="Track 3 · Build with buy" title="The agent pays for its own infrastructure" />
      </AbsoluteFill>

      <Links />

      <Card x={AGENT.x} y={rowTop(AGENT.h)} w={AGENT.w} h={AGENT.h} delay={12} tone="violet">
        <Icon dark>🤖</Icon>
        <T color="#fff">Alcancía agent</T>
        <S color={violet[100]}>Own wallet</S>
        <Chip tone="glass" size={20} style={{ alignSelf: "flex-start" }}>ERC-8004 #9911</Chip>
      </Card>

      <Card x={GATE.x} y={rowTop(GATE.h)} w={GATE.w} h={GATE.h} delay={40}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Icon>🛒</Icon>
          <div style={{ fontSize: 19, fontWeight: 700, color: violet[600] }}>gateway.usebuy.ai</div>
        </div>
        <T>buy gateway</T>
        <S>One HTTP call · pays with x402 on Celo · the gateway sponsors the gas</S>
      </Card>

      <Card x={BR.x} y={SQD.y} w={BR.w} h={SQD.h} delay={74}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Icon>🔎</Icon>
          <div>
            <T size={32}>SQD indexer</T>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#059669", marginTop: 4 }}>FREE</div>
          </div>
        </div>
        <S>Detects every paycheck (Transfer logs) and the agent's own tx history</S>
      </Card>

      <Card x={BR.x} y={RPC.y} w={BR.w} h={RPC.h} delay={88} tone="gold">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Icon>📡</Icon>
          <div>
            <T size={32}>Chainstack Celo RPC</T>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#b45309", marginTop: 4 }}>US$0.01 PER CYCLE</div>
          </div>
        </div>
        <S>
          <b style={{ color: ink }}>One</b> batched call with every user's balances, allowances, income currency and sweep cursor
        </S>
      </Card>

      <Card x={RCPT.x} y={rowTop(RCPT.h)} w={RCPT.w} h={RCPT.h} delay={132}>
        <Icon>🧾</Icon>
        <T size={30}>Receipt</T>
        <S>USDC settled onchain via x402</S>
        <div
          style={{
            marginTop: 4,
            alignSelf: "flex-start",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            borderRadius: 999,
            background: violet[950],
            color: "#fff",
            fontSize: 19,
            fontWeight: 700,
            fontFamily: "ui-monospace, Menlo, monospace",
          }}
        >
          {shortHash(BUY_RECEIPT_TX)}
          <span style={{ fontFamily: "inherit", color: gold.main, fontSize: 16 }}>celoscan ↗</span>
        </div>
      </Card>

      <AbsoluteFill style={{ alignItems: "center", top: 858 }}>
        <div
          style={{
            fontSize: 36,
            fontWeight: 800,
            color: ink,
            letterSpacing: -0.8,
            opacity: foot,
            transform: `translateY(${(1 - foot) * 20}px)`,
          }}
        >
          Not spam: <span style={{ color: violet[600] }}>one paid call per cycle</span>, exactly what the agent needs to decide.
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 26, opacity: chips, transform: `scale(${0.92 + 0.08 * chips})` }}>
          <Chip tone="gold" size={22}>~300 cycles for US$3</Chip>
          <Chip tone="white" size={22}>Falls back to public RPC if buy is down</Chip>
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};
