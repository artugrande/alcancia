import React from "react";
import { AbsoluteFill, Audio, Series, interpolate, staticFile, useVideoConfig } from "remotion";
import { demoFrames } from "./clips";
import { Built } from "./scenes/Built";
import { Buy } from "./scenes/Buy";
import { Demo } from "./scenes/Demo";
import { Intro } from "./scenes/Intro";
import { Outro } from "./scenes/Outro";
import { Problem } from "./scenes/Problem";
import { Tracks } from "./scenes/Tracks";
import { FPS, SCENES } from "./theme";

export type DemoProps = { available: Record<string, boolean> };

const f = (s: number) => Math.round(s * FPS);

export const totalFrames = () =>
  f(SCENES.intro) + f(SCENES.problem) + demoFrames() + f(SCENES.built) + f(SCENES.buy) + f(SCENES.tracks) + f(SCENES.outro);

const MUSIC_VOLUME = 0.35;

export const AlcanciaDemo: React.FC<DemoProps> = ({ available }) => {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "#ffffff" }}>
      <Audio
        src={staticFile("music.wav")}
        volume={(fr) =>
          MUSIC_VOLUME *
          interpolate(fr, [0, 20, durationInFrames - 90, durationInFrames - 5], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
      <Series>
        <Series.Sequence durationInFrames={f(SCENES.intro)}>
          <Intro />
        </Series.Sequence>
        <Series.Sequence durationInFrames={f(SCENES.problem)}>
          <Problem />
        </Series.Sequence>
        <Series.Sequence durationInFrames={demoFrames()}>
          <Demo available={available} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={f(SCENES.built)}>
          <Built />
        </Series.Sequence>
        <Series.Sequence durationInFrames={f(SCENES.buy)}>
          <Buy />
        </Series.Sequence>
        <Series.Sequence durationInFrames={f(SCENES.tracks)}>
          <Tracks />
        </Series.Sequence>
        <Series.Sequence durationInFrames={f(SCENES.outro)}>
          <Outro />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
