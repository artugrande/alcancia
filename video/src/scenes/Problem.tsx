import React from "react";
import { AbsoluteFill } from "remotion";
import { LightBackground, SceneFade, SceneTitle, useSpringIn } from "../components/ui";
import { gold, ink, muted, violet } from "../theme";

const PROBLEMS = [
  {
    emoji: "💸",
    title: "Money left in the account gets spent",
    body: "If savings sit next to everyday spending, they're gone by the end of the month.",
  },
  {
    emoji: "🌎",
    title: "You save in one currency, spend in another",
    body: "Saving pesos for a trip to Brazil? The exchange rate eats it — so people dollarize.",
  },
  {
    emoji: "🧮",
    title: "Nobody does the math",
    body: "Several goals, dates and currencies. How much of each paycheck goes where?",
  },
];

const ProblemCard: React.FC<{ i: number; emoji: string; title: string; body: string }> = ({ i, emoji, title, body }) => {
  const p = useSpringIn(20 + i * 36);
  return (
    <div
      style={{
        width: 500,
        height: 500,
        background: "#ffffff",
        borderRadius: 36,
        padding: "48px 44px",
        boxShadow: "0 30px 80px rgba(47,42,134,0.14)",
        border: `2px solid ${violet[100]}`,
        opacity: p,
        transform: `translateY(${(1 - p) * 80}px) scale(${0.9 + p * 0.1})`,
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      <div
        style={{
          width: 104,
          height: 104,
          borderRadius: 28,
          background: i === 1 ? "#fef3c7" : violet[50],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 60,
          lineHeight: 1,
        }}
      >
        {emoji}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: i === 1 ? gold.deep : violet[600], letterSpacing: 2 }}>
        0{i + 1}
      </div>
      <div style={{ fontSize: 35, fontWeight: 800, color: ink, lineHeight: 1.12, letterSpacing: -1 }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 500, color: muted, lineHeight: 1.4 }}>{body}</div>
    </div>
  );
};

export const Problem: React.FC = () => {
  const end = useSpringIn(7 * 30);
  return (
    <SceneFade>
      <LightBackground coins={false} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 80, flexDirection: "column" }}>
        <SceneTitle kicker="The problem" title="Saving in LatAm is hard" />
        <div style={{ display: "flex", gap: 44, marginTop: 64 }}>
          {PROBLEMS.map((p, i) => (
            <ProblemCard key={i} i={i} {...p} />
          ))}
        </div>
        <div
          style={{
            marginTop: 56,
            fontSize: 48,
            fontWeight: 800,
            color: ink,
            letterSpacing: -1,
            opacity: end,
            transform: `translateY(${(1 - end) * 30}px)`,
          }}
        >
          Saving shouldn't depend on <span style={{ color: violet[600] }}>willpower.</span>
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};
