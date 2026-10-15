import { createPublicClient, http, type PublicClient } from "viem";
import { celo } from "viem/chains";
import { LOCALS, TOKENS, type Currency, type Local } from "./config";

/** Units of each local currency per 1 USD, and where each number came from. */
export type Rates = { perUsd: Record<Local, number>; source: Record<Local, string> };

export const forno = createPublicClient({
  chain: celo,
  transport: http("https://forno.celo.org"),
}) as PublicClient;

const TEXTILE = "https://api.textilecredit.com";

async function textileTickers(): Promise<Record<string, number>> {
  const r = await fetch(`${TEXTILE}/tickers`, { next: { revalidate: 60 } });
  const list = (await r.json()) as { ticker_id: string; last_price: string }[];
  return Object.fromEntries(list.map((t) => [t.ticker_id, Number(t.last_price)]));
}

// Indicative Textile RFQ price (no commitment): local units per USD₮.
async function textilePreview(c: Local): Promise<number | null> {
  const local = LOCALS[c].token;
  const sellUsd = LOCALS[c].textile === "both";
  const body = sellUsd
    ? { chainId: 42220, sellToken: TOKENS.USDT, buyToken: local, sellAmount: "10000000" } // 10 USD₮
    : { chainId: 42220, sellToken: local, buyToken: TOKENS.USDT, sellAmount: (10n ** 20n * 2n).toString() }; // 200 units
  const r = await fetch(`${TEXTILE}/v2/rfq/preview`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    next: { revalidate: 60 },
  });
  const d = (await r.json()).data;
  if (d?.status !== "preview") return null;
  return sellUsd ? Number(d.buyAmount) / 1e18 / 10 : 200 / (Number(d.buyAmount) / 1e6);
}

async function referenceRates(): Promise<Record<string, number>> {
  const r = await fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 3600 } });
  return (await r.json()).rates ?? {};
}

export async function readRates(): Promise<Rates> {
  const [tick, cop, mxn, ref] = await Promise.all([
    textileTickers().catch(() => ({}) as Record<string, number>),
    textilePreview("COP").catch(() => null),
    textilePreview("MXN").catch(() => null),
    referenceRates().catch(() => ({}) as Record<string, number>),
  ]);
  const perUsd = {} as Record<Local, number>;
  const source = {} as Record<Local, string>;
  const set = (c: Local, v: number | null | undefined, src: string) => {
    if (v && Number.isFinite(v) && v > 0) {
      perUsd[c] = v;
      source[c] = src;
      return true;
    }
    return false;
  };
  set("ARS", tick["USDT_WARS"], "Textile") || set("ARS", ref.ARS, "referencia");
  set("BRL", tick["USDT_WBRL"], "Textile") || set("BRL", ref.BRL, "referencia");
  set("COP", cop, "Textile") || set("COP", ref.COP, "referencia");
  set("MXN", mxn, "Textile") || set("MXN", ref.MXN, "referencia");
  set("PEN", ref.PEN, "referencia");
  set("CLP", ref.CLP, "referencia");
  return { perUsd, source };
}

/** Convert an amount between any two currencies (local or USD). */
export function convert(amount: number, from: Currency, to: Currency, r: Rates) {
  const usd = from === "USD" ? amount : amount / r.perUsd[from];
  return to === "USD" ? usd : usd * r.perUsd[to];
}
