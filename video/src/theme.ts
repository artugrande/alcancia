import { loadFont } from "@remotion/google-fonts/Inter";

export const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

export const FPS = 30;

export const violet = {
  50: "#f3f1ff",
  100: "#e9e5ff",
  200: "#d4ccff",
  300: "#b4a6fe",
  400: "#8f7dfc",
  500: "#6f5efb",
  600: "#5f50fb",
  700: "#4c3de0",
  800: "#3e33b5",
  900: "#2f2a86",
  950: "#1d1a52",
};

export const gold = { light: "#fde68a", main: "#fbbf24", deep: "#f59e0b" };

export const ink = "#1d1a52";
export const muted = "#5b5891";

// Scene lengths (seconds). Demo length is computed from clips.json.
export const SCENES = {
  intro: 7,
  problem: 11,
  built: 13,
  buy: 11,
  tracks: 11,
  outro: 5,
};
