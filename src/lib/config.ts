import type { Abi, Address } from "viem";
import { codeFromRepo, toDataSuffix } from "@celo/attribution-tags";
import alcanciaAbiJson from "./abi/Alcancia.json";
import factoryAbiJson from "./abi/AlcanciaFactory.json";

export const alcanciaAbi = alcanciaAbiJson as Abi;
export const factoryAbi = factoryAbiJson as Abi;

export const REPO = "artugrande/alcancia";

// ERC-8021: the code assigned at Loops House enrollment (credited by the hackathon) plus the
// repo-derived one. Both ride in a single suffix on every transaction.
export const ATTRIBUTION_CODES = [
  ...new Set([process.env.NEXT_PUBLIC_ATTRIBUTION_CODE || "celo_cbcc681c15b7", codeFromRepo(REPO)]),
];
export const DATA_SUFFIX = toDataSuffix(ATTRIBUTION_CODES);

export const FACTORY = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as Address;
export const FACTORY_DEPLOY_BLOCK = Number(
  process.env.NEXT_PUBLIC_FACTORY_DEPLOY_BLOCK || 0,
);
export const AGENT = process.env.NEXT_PUBLIC_AGENT_ADDRESS as Address;

export type Local = "ARS" | "BRL" | "MXN" | "COP" | "PEN" | "CLP";
export type Currency = Local | "USD";

// Ripio wFiat on Celo (same address on every EVM chain, 18 decimals).
// textile: live RFQ corridor against USD₮ on Celo · ramp: Ripio Ramp on/off-ramp country.
export const LOCALS: Record<Local, { token: Address; symbol: string; flag: string; country?: string; textile: "both" | "sell" | false; name: string }> = {
  ARS: { token: "0x0dc4f92879b7670e5f4e4e6e3c801d229129d90d", symbol: "wARS", flag: "🇦🇷", country: "AR", textile: "both", name: "peso argentino" },
  BRL: { token: "0xd76f5faf6888e24d9f04bf92a0c8b921fe4390e0", symbol: "wBRL", flag: "🇧🇷", country: "BR", textile: "both", name: "real" },
  COP: { token: "0x8a1d45e102e886510e891d2ec656a708991e2d76", symbol: "wCOP", flag: "🇨🇴", country: "CO", textile: "both", name: "peso colombiano" },
  MXN: { token: "0x337e7456b420bd3481e7fa61fa9850343d610d34", symbol: "wMXN", flag: "🇲🇽", country: "MX", textile: "sell", name: "peso mexicano" },
  PEN: { token: "0x4F34c8b3b5FB6D98Da888F0feA543d4d9C9F2eBE", symbol: "wPEN", flag: "🇵🇪", textile: false, name: "sol peruano" },
  CLP: { token: "0x61D450a098b6a7f69fC4b98CE68198fe59768651", symbol: "wCLP", flag: "🇨🇱", textile: false, name: "peso chileno" },
};
export const LOCAL_CODES = Object.keys(LOCALS) as Local[];

export const TOKENS = {
  wARS: LOCALS.ARS.token,
  wBRL: LOCALS.BRL.token,
  USDT: "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e",
} as const satisfies Record<string, Address>;

export const localOf = (token: string): Local =>
  LOCAL_CODES.find((c) => LOCALS[c].token.toLowerCase() === token.toLowerCase()) ?? "ARS";

export const TOKEN_SYMBOL: Record<string, string> = Object.fromEntries(
  LOCAL_CODES.map((c) => [LOCALS[c].token.toLowerCase(), LOCALS[c].symbol]),
);

/** Can the agent convert `from` → `to` on Celo today (Textile, via USD₮)? */
export const canConvert = (from: Local, to: Local) =>
  from === to || (!!LOCALS[from].textile && LOCALS[to].textile === "both");

export const POOLS = {
  wARS_USDT: "0x5d8ef8b839be522b9e3d60a51edb5837cd0b2391",
  wBRL_USDT: "0x01c3cf91cdf7b34181c7ec8566c0236951fea40f",
} as const satisfies Record<string, Address>;

export const UNISWAP_SWAP_ROUTER_02 =
  "0x5615CDAb10dc425a742d643d949a7F474C01abc4" as Address;
export const POOL_FEE = 100; // 0.01%

export const erc20Abi = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export const poolAbi = [
  { type: "function", name: "slot0", stateMutability: "view", inputs: [], outputs: [{ name: "sqrtPriceX96", type: "uint160" }, { type: "int24" }, { type: "uint16" }, { type: "uint16" }, { type: "uint16" }, { type: "uint8" }, { type: "bool" }] },
] as const;

export const rampUrl = (address: string, c: Local = "ARS", amount?: number) =>
  LOCALS[c].country
    ? `https://ramp.ripio.com/?country=${LOCALS[c].country}&chain=42220&token=${LOCALS[c].symbol.toUpperCase()}${amount ? `&amount=${amount}` : ""}&address=${address}`
    : null;

export const offrampUrl = (c: Local, amount?: number) =>
  LOCALS[c].country
    ? `https://ramp.ripio.com/offramp?country=${LOCALS[c].country}&chain=42220&token=${LOCALS[c].symbol.toUpperCase()}${amount ? `&amount=${Math.floor(amount)}` : ""}`
    : null;

export const explorer = (x: string) =>
  `https://celoscan.io/${x.length === 66 ? "tx" : "address"}/${x}`;
