import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BROWSER, BrowserFrame } from "../components/BrowserFrame";
import { ClipSlot } from "../components/ClipSlot";
import { SceneFade, VioletBackground, useSpringIn } from "../components/ui";
import { CLIP_META, clipFrames, type ClipMeta } from "../clips";
import { gold, ink, muted, violet } from "../theme";

const FRAME_TOP = 40;

const ProofChip: React.FC<{ text: string }> = ({ text }) => {
  const p = useSpringIn(24, { damping: 12 });
  return (
    <div
      style={{
        position: "absolute",
        right: 28,
        bottom: 28,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 22px",
        borderRadius: 999,
        background: violet[950] + "ee",
        color: "#fff",
        fontSize: 22,
        fontWeight: 700,
        boxShadow: "0 16px 40px rgba(13,10,60,0.35)",
        opacity: p,
        transform: `translateY(${(1 - p) * 30}px) scale(${0.85 + 0.15 * p})`,
      }}
    >
      <span
        style={{
          background: gold.main,
          color: violet[950],
          borderRadius: 999,
          padding: "3px 12px",
          fontSize: 16,
          fontWeight: 900,
          letterSpacing: 1,
        }}
      >
        ONCHAIN PROOF
      </span>
      {text}
    </div>
  );
};

const Caption: React.FC<{ meta: ClipMeta; index: number }> = ({ meta, index }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = useSpringIn(4);
  const out = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const progress = frame / durationInFrames;
  return (
    <div
      style={{
        position: "absolute",
        left: (1920 - BROWSER.width) / 2,
        top: FRAME_TOP + BROWSER.toolbar + BROWSER.contentHeight + 26,
        width: BROWSER.width,
        minHeight: 150,
        borderRadius: 28,
        background: "#ffffff",
        boxShadow: "0 30px 70px rgba(13,10,60,0.35)",
        display: "flex",
        alignItems: "center",
        padding: "22px 40px",
        gap: 32,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: 86,
          height: 86,
          flexShrink: 0,
          borderRadius: 24,
          background: `linear-gradient(135deg, ${violet[500]}, ${violet[700]})`,
          color: "#fff",
          fontSize: 48,
          fontWeight: 900,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${0.6 + 0.4 * p}) rotate(${(1 - p) * -20}deg)`,
        }}
      >
        {index + 1}
      </div>
      <div style={{ flex: 1, opacity: p * out, transform: `translateX(${(1 - p) * 40}px)` }}>
        <div style={{ fontSize: 38, fontWeight: 800, color: ink, letterSpacing: -1 }}>{meta.title}</div>
        <div style={{ fontSize: 24, fontWeight: 500, color: muted, marginTop: 4, lineHeight: 1.3, textWrap: "balance" } as React.CSSProperties}>{meta.body}</div>
      </div>
      <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
        {CLIP_META.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === index ? 40 : 14,
              height: 14,
              borderRadius: 7,
              background: i < index ? violet[300] : i === index ? violet[600] : violet[100],
            }}
          />
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 6,
          width: `${progress * 100}%`,
          background: `linear-gradient(90deg, ${violet[500]}, ${gold.main})`,
        }}
      />
    </div>
  );
};

export const Demo: React.FC<{ available: Record<string, boolean> }> = ({ available }) => {
  const enter = useSpringIn(0, { damping: 18 });
  let from = 0;
  const slots = CLIP_META.map((meta, index) => {
    const duration = clipFrames(meta.name);
    const s = { meta, index, from, duration };
    from += duration;
    return s;
  });

  return (
    <SceneFade inFrames={10} outFrames={12}>
      <VioletBackground />
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            top: FRAME_TOP,
            left: (1920 - BROWSER.width) / 2,
            opacity: enter,
            transform: `translateY(${(1 - enter) * 120}px) scale(${0.94 + 0.06 * enter})`,
          }}
        >
          <BrowserFrame>
            {slots.map(({ meta, from, duration }) => (
              <Sequence key={meta.name} from={from} durationInFrames={duration} layout="none">
                <AbsoluteFill>
                  <ClipSlot name={meta.name} available={!!available[meta.name]} />
                  {meta.proof ? <ProofChip text={meta.proof} /> : null}
                </AbsoluteFill>
              </Sequence>
            ))}
          </BrowserFrame>
        </div>
        {slots.map(({ meta, index, from, duration }) => (
          <Sequence key={meta.name} from={from} durationInFrames={duration} layout="none">
            <Caption meta={meta} index={index} />
          </Sequence>
        ))}
      </AbsoluteFill>
    </SceneFade>
  );
};
