import clipsJson from "./clips.json";
import { FPS } from "./theme";

export type ClipConfig = { seconds: number; startFrom?: number; playbackRate?: number };

export type ClipMeta = {
  name: string;
  title: string;
  body: string;
  proof?: string;
};

// Captions live here; timing lives in clips.json.
export const CLIP_META: ClipMeta[] = [
  {
    name: "01-chat",
    title: "Chat with the agent",
    body: "Goals, income and fixed costs — answered with cards, not paragraphs.",
  },
  {
    name: "02-plan",
    title: "A plan in seconds",
    body: "What % of every paycheck goes to each goal. Trips save in the currency you'll spend in.",
  },
  {
    name: "03-create",
    title: "One piggy bank per goal",
    body: "Each is a contract you own on Celo. Two signatures.",
    proof: "AlcanciaFactory · EIP-1167 clones",
  },
  {
    name: "04-income",
    title: "Payday, on autopilot",
    body: "Each paycheck is already split into the goals. Top up Floripa from wARS → the agent converts to wBRL via Textile.",
    proof: "Textile RFQ · wARS → USD₮ → wBRL",
  },
  {
    name: "05-break",
    title: "Trying to break one early",
    body: "Reflection, 'tell me why', a riddle about your goal. Or wait 72 h.",
    proof: "Agent approval onchain · or 72 h delay",
  },
];

const clips = clipsJson as unknown as Record<string, ClipConfig>;

/** Receipt tx hash shown in the "buy" scene (non-clip field in clips.json). */
export const BUY_RECEIPT_TX: string = (clipsJson as { buyReceiptTx?: string }).buyReceiptTx ?? "";

export const getClip = (name: string): Required<ClipConfig> => {
  const c = clips[name] ?? { seconds: 10 };
  return {
    seconds: c.seconds,
    startFrom: c.startFrom ?? 0,
    playbackRate: c.playbackRate ?? 1,
  };
};

export const clipFrames = (name: string) => Math.round(getClip(name).seconds * FPS);

export const demoFrames = () => CLIP_META.reduce((acc, m) => acc + clipFrames(m.name), 0);
