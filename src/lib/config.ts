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

export type Currency = "ARS" | "USD" | "BRL";

export const TOKENS = {
  wARS: "0x0dc4f92879b7670e5f4e4e6e3c801d229129d90d",
  wBRL: "0xd76f5faf6888e24d9f04bf92a0c8b921fe4390e0",
  USDT: "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e",
} as const satisfies Record<string, Address>;

export const TOKEN_SYMBOL: Record<string, string> = {
  [TOKENS.wARS.toLowerCase()]: "wARS",
  [TOKENS.wBRL.toLowerCase()]: "wBRL",
};

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

export const rampUrl = (address: string, amount = 10000) =>
  `https://ramp.ripio.com/?country=AR&chain=42220&token=WARS&amount=${amount}&address=${address}`;

export const explorer = (x: string) =>
  `https://celoscan.io/${x.length === 66 ? "tx" : "address"}/${x}`;
