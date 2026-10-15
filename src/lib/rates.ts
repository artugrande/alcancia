import { createPublicClient, http, type PublicClient } from "viem";
import { celo } from "viem/chains";
import { POOLS, poolAbi } from "./config";

export type Rates = { arsPerUsd: number; brlPerUsd: number; arsPerBrl: number };

const Q96 = 2 ** 96;

// token1 per token0, adjusted for decimals
function price(sqrtPriceX96: bigint, dec0: number, dec1: number) {
  const s = Number(sqrtPriceX96) / Q96;
  return s * s * 10 ** (dec0 - dec1);
}

// wARS(0x0d…) < USDT(0x48…): wARS is token0 → price = USDT per wARS.
// USDT(0x48…) < wBRL(0xd7…): USDT is token0 → price = wBRL per USDT.
export function ratesFromSlot0(arsSqrt: bigint, brlSqrt: bigint): Rates {
  const usdPerArs = price(arsSqrt, 18, 6);
  const brlPerUsd = price(brlSqrt, 6, 18);
  const arsPerUsd = 1 / usdPerArs;
  return { arsPerUsd, brlPerUsd, arsPerBrl: arsPerUsd / brlPerUsd };
}

export const forno = createPublicClient({
  chain: celo,
  transport: http("https://forno.celo.org"),
}) as PublicClient;

export async function readRates(client: PublicClient = forno): Promise<Rates> {
  const [a, b] = await Promise.all([
    client.readContract({ address: POOLS.wARS_USDT, abi: poolAbi, functionName: "slot0" }),
    client.readContract({ address: POOLS.wBRL_USDT, abi: poolAbi, functionName: "slot0" }),
  ]);
  return ratesFromSlot0(a[0], b[0]);
}
