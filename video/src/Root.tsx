import { Composition, staticFile } from "remotion";
import { AlcanciaDemo, totalFrames, type DemoProps } from "./AlcanciaDemo";
import { CLIP_META } from "./clips";
import { FPS } from "./theme";

// Detect which recordings exist in public/clips so missing ones render a placeholder.
const detectClips = async (): Promise<Record<string, boolean>> => {
  const entries = await Promise.all(
    CLIP_META.map(async (m) => {
      try {
        const res = await fetch(staticFile(`clips/${m.name}.mp4`), { method: "HEAD" });
        const type = res.headers.get("content-type") ?? "";
        return [m.name, res.ok && !type.includes("text/html")] as const;
      } catch {
        return [m.name, false] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="AlcanciaDemo"
      component={AlcanciaDemo}
      durationInFrames={totalFrames()}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ available: {} } satisfies DemoProps}
      calculateMetadata={async ({ props }) => ({
        durationInFrames: totalFrames(),
        props: { ...props, available: await detectClips() },
      })}
    />
  );
};
