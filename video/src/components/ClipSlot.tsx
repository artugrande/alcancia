import React from "react";
import { AbsoluteFill, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion";
import { getClip } from "../clips";
import { FPS, violet } from "../theme";

/** Screen recording, or a placeholder when public/clips/<name>.mp4 is missing. */
export const ClipSlot: React.FC<{ name: string; available: boolean }> = ({ name, available }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const clip = getClip(name);

  if (available) {
    return (
      <AbsoluteFill style={{ opacity, background: "#ffffff" }}>
        <OffthreadVideo
          src={staticFile(`clips/${name}.mp4`)}
          trimBefore={Math.round(clip.startFrom * FPS)}
          playbackRate={clip.playbackRate}
          muted
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </AbsoluteFill>
    );
  }
  return <Placeholder name={name} opacity={opacity} />;
};

const Bar: React.FC<{ w: number | string; h?: number; c?: string; style?: React.CSSProperties }> = ({ w, h = 18, c = "#e4e3ee", style }) => (
  <div style={{ width: w, height: h, borderRadius: h / 2, background: c, ...style }} />
);

const Placeholder: React.FC<{ name: string; opacity: number }> = ({ name, opacity }) => {
  const frame = useCurrentFrame();
  const shimmer = (frame * 6) % 2000;
  return (
    <AbsoluteFill style={{ opacity, background: "#f1f0f6", padding: 36 }}>
      <div
        style={{
          position: "absolute",
          inset: 36,
          borderRadius: 24,
          background: "#e9e8f1",
          overflow: "hidden",
          display: "flex",
        }}
      >
        {/* fake sidebar */}
        <div style={{ width: 260, background: "#e1e0ec", padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>
          <Bar w={140} h={26} c="#cfcde0" />
          <Bar w={190} />
          <Bar w={160} />
          <Bar w={175} />
        </div>
        {/* fake chat */}
        <div style={{ flex: 1, padding: 40, display: "flex", flexDirection: "column", gap: 22 }}>
          <Bar w={420} h={52} c="#dddbe9" style={{ borderRadius: 18 }} />
          <Bar w={520} h={52} c="#dddbe9" style={{ borderRadius: 18, alignSelf: "flex-end" }} />
          <div style={{ display: "flex", gap: 18 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 200, height: 140, borderRadius: 18, background: "#dddbe9" }} />
            ))}
          </div>
          <Bar w={360} h={52} c="#dddbe9" style={{ borderRadius: 18 }} />
        </div>
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: shimmer - 400,
            width: 300,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
          }}
        />
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              background: "rgba(255,255,255,0.92)",
              borderRadius: 24,
              padding: "28px 44px",
              textAlign: "center",
              boxShadow: "0 20px 50px rgba(47,42,134,0.12)",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color: violet[600], letterSpacing: 3, textTransform: "uppercase" }}>
              Screen recording
            </div>
            <div style={{ fontSize: 56, fontWeight: 900, color: "#2a2850", marginTop: 6 }}>{name}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: "#6b6990", marginTop: 8 }}>
              Drop public/clips/{name}.mp4
            </div>
          </div>
        </AbsoluteFill>
      </div>
    </AbsoluteFill>
  );
};
