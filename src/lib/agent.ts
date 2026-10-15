import "server-only";
import {
  createWalletClient,
  decodeEventLog,
  decodeFunctionResult,
  encodeFunctionData,
  encodePacked,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";
import { celo } from "viem/chains";
import { withAttribution } from "@celo/attribution-tags";
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmSchemeV1 } from "@x402/evm/exact/v1/client";
import {
  ATTRIBUTION_CODES,
  FACTORY,
  FACTORY_DEPLOY_BLOCK,
  POOLS,
  POOL_FEE,
  TOKENS,
  UNISWAP_SWAP_ROUTER_02,
  alcanciaAbi,
  erc20Abi,
  factoryAbi,
  poolAbi,
} from "./config";
import { forno, ratesFromSlot0, type Rates } from "./rates";

export const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as Hex);

export const agentWallet = createWalletClient({
  account,
  chain: celo,
  transport: http("https://forno.celo.org"),
}).extend(withAttribution(ATTRIBUTION_CODES));

// ---------------------------------------------------------------- SQD (free, via buy gateway)

const SQD = "https://gateway.usebuy.ai/sqd/datasets/celo-mainnet";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

type SqdLog = { address: string; topics: string[]; data: string; transactionHash: string; logIndex: number };
type SqdBlock = { header: { number: number }; logs?: SqdLog[] };

// Celo L2 blocks finalize on L1 after ~30 min; for a live product we follow the sequencer
// head with a small confirmation margin instead (single sequencer, reorgs are very rare).
const CONFIRMATIONS = 3;

export async function sqdSafeHead(): Promise<number> {
  const r = await fetch(`${SQD}/head`, { cache: "no-store" });
  return (await r.json()).number - CONFIRMATIONS;
}

async function sqdLogs(filter: Record<string, unknown>, fromBlock: number, toBlock: number) {
  const out: (SqdLog & { block: number })[] = [];
  let from = fromBlock;
  while (from <= toBlock) {
    const r = await fetch(`${SQD}/stream`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "evm",
        fromBlock: from,
        toBlock,
        fields: {
          block: { number: true },
          log: { address: true, topics: true, data: true, transactionHash: true, logIndex: true },
        },
        logs: [filter],
      }),
      cache: "no-store",
    });
    if (r.status === 204) break;
    if (!r.ok) throw new Error(`SQD ${r.status}: ${await r.text()}`);
    const lines = (await r.text()).split("\n").filter(Boolean);
    if (!lines.length) break;
    let last = from;
    for (const line of lines) {
      const b = JSON.parse(line) as SqdBlock;
      last = b.header.number;
      for (const l of b.logs ?? []) out.push({ ...l, block: b.header.number });
    }
    from = last + 1;
  }
  return out;
}

const pad = (a: string) => "0x" + a.toLowerCase().replace(/^0x/, "").padStart(64, "0");

export type Goal = {
  user: Address;
  alcancia: Address;
  token: Address;
  name: string;
  target: bigint;
  deadline: bigint;
  bps: number;
  block: number;
};

export async function goalsFromSqd(toBlock: number): Promise<Goal[]> {
  const created = (factoryAbi as readonly { type: string; name?: string }[]).find(
    (x) => x.type === "event" && x.name === "AlcanciaCreated",
  );
  if (!created) throw new Error("ABI sin AlcanciaCreated");
  const logs = await sqdLogs({ address: [FACTORY.toLowerCase()] }, FACTORY_DEPLOY_BLOCK, toBlock);
  const goals: Goal[] = [];
  for (const l of logs) {
    try {
      const ev = decodeEventLog({ abi: factoryAbi, data: l.data as Hex, topics: l.topics as [Hex, ...Hex[]] });
      if (ev.eventName !== "AlcanciaCreated") continue;
      const a = ev.args as unknown as Omit<Goal, "block">;
      goals.push({ ...a, bps: Number(a.bps), block: l.block });
    } catch {
      /* other events */
    }
  }
  return goals;
}

export async function incomingTransfers(user: Address, token: Address, fromBlock: number, toBlock: number) {
  if (fromBlock > toBlock) return [];
  const logs = await sqdLogs(
    { address: [token.toLowerCase()], topic0: [TRANSFER], topic2: [pad(user)] },
    fromBlock,
    toBlock,
  );
  return logs.map((l) => ({
    from: ("0x" + l.topics[1].slice(26)) as Address,
    amount: BigInt(l.data),
    block: l.block,
    tx: l.transactionHash as Hex,
  }));
}

// ---------------------------------------------------------------- Chainstack RPC (paid, via buy)

const payingFetch = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "celo" as `${string}:${string}`, client: new ExactEvmSchemeV1(account), x402Version: 1 }],
});

export type BuyReceipt = { paid: boolean; via: "chainstack" | "forno"; tx?: string; amount?: string; error?: string };

type Call = { to: Address; data: Hex };

/** One paid JSON-RPC batch to Chainstack through buy (US$0.01). Falls back to Forno. */
export async function batchCall(calls: Call[]): Promise<{ results: Hex[]; receipt: BuyReceipt }> {
  const body = calls.map((c, id) => ({ jsonrpc: "2.0", id, method: "eth_call", params: [c, "latest"] }));
  try {
    const r = await payingFetch("https://gateway.usebuy.ai/chainstack/celo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`chainstack ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const json = (await r.json()) as { id: number; result: Hex }[];
    const header = r.headers.get("x-payment-response") ?? r.headers.get("payment-response");
    let tx: string | undefined;
    if (header) {
      try {
        tx = (decodePaymentResponseHeader(header) as { transaction?: string }).transaction;
      } catch {}
    }
    const results = json.sort((a, b) => a.id - b.id).map((x) => x.result);
    return { results, receipt: { paid: true, via: "chainstack", tx, amount: "0.01 USDC" } };
  } catch (e) {
    // Never retry a paid call blindly: fall back to the public RPC.
    const results = await Promise.all(
      calls.map((c) => forno.call({ to: c.to, data: c.data }).then((x) => x.data ?? "0x")),
    );
    return { results: results as Hex[], receipt: { paid: false, via: "forno", error: String(e).slice(0, 300) } };
  }
}

// ---------------------------------------------------------------- sweep cycle

export type SweepLog = {
  user: Address;
  income: string;
  sweepTx?: Hex;
  fx?: { alcancia: Address; inWars: string; outBrl?: string; legs?: Leg[]; swapTx?: Hex; depositTx?: Hex; error?: string }[];
  skipped?: string;
};

export async function runSweep(onlyUser?: Address) {
  const head = await sqdSafeHead();
  const goals = (await goalsFromSqd(head)).filter(
    (g) => !onlyUser || g.user.toLowerCase() === onlyUser.toLowerCase(),
  );
  const users = [...new Set(goals.map((g) => g.user.toLowerCase()))] as Address[];

  // One paid batch: per user lastSweptBlock, paused, wARS balance, allowance, current bps;
  // plus both pool prices for FX.
  const calls: Call[] = [];
  for (const u of users) {
    calls.push({ to: FACTORY, data: encodeFunctionData({ abi: factoryAbi, functionName: "lastSweptBlock", args: [u] }) });
    calls.push({ to: FACTORY, data: encodeFunctionData({ abi: factoryAbi, functionName: "paused", args: [u] }) });
    calls.push({ to: TOKENS.wARS, data: encodeFunctionData({ abi: erc20Abi, functionName: "balanceOf", args: [u] }) });
    calls.push({ to: TOKENS.wARS, data: encodeFunctionData({ abi: erc20Abi, functionName: "allowance", args: [u, FACTORY] }) });
    calls.push({ to: FACTORY, data: encodeFunctionData({ abi: factoryAbi, functionName: "totalBps", args: [u] }) });
  }
  calls.push({ to: POOLS.wARS_USDT, data: encodeFunctionData({ abi: poolAbi, functionName: "slot0" }) });
  calls.push({ to: POOLS.wBRL_USDT, data: encodeFunctionData({ abi: poolAbi, functionName: "slot0" }) });
  const { results, receipt } = await batchCall(calls);

  const dec = (fn: string, abi: typeof factoryAbi | typeof erc20Abi, i: number) =>
    decodeFunctionResult({ abi: abi as typeof factoryAbi, functionName: fn, data: results[i] }) as unknown;
  const n = users.length * 5;
  const slotA = decodeFunctionResult({ abi: poolAbi, functionName: "slot0", data: results[n] });
  const slotB = decodeFunctionResult({ abi: poolAbi, functionName: "slot0", data: results[n + 1] });
  const rates = ratesFromSlot0(slotA[0], slotB[0]);

  const logs: SweepLog[] = [];
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const last = Number(dec("lastSweptBlock", factoryAbi, i * 5) as bigint);
    const paused = dec("paused", factoryAbi, i * 5 + 1) as boolean;
    const balance = dec("balanceOf", erc20Abi, i * 5 + 2) as bigint;
    const allowance = dec("allowance", erc20Abi, i * 5 + 3) as bigint;
    const totalBps = BigInt(dec("totalBps", factoryAbi, i * 5 + 4) as number | bigint);
    const mine = goals.filter((g) => g.user.toLowerCase() === user);
    if (paused) { logs.push({ user, income: "0", skipped: "pausado" }); continue; }

    const from = Math.max(last + 1, Math.min(...mine.map((g) => g.block)));
    const own = new Set([FACTORY, account.address, ...mine.map((g) => g.alcancia)].map((x) => x.toLowerCase()));
    const transfers = (await incomingTransfers(user, TOKENS.wARS, from, head)).filter(
      (t) => !own.has(t.from.toLowerCase()),
    );
    let income = transfers.reduce((s, t) => s + t.amount, 0n);
    if (income === 0n) { logs.push({ user, income: "0", skipped: "sin ingresos nuevos" }); continue; }
    if (income > balance) income = balance;
    if (totalBps > 0n && (income * totalBps) / 10000n > allowance) {
      income = (allowance * 10000n) / totalBps;
    }
    if (income === 0n) { logs.push({ user, income: "0", skipped: "sin allowance" }); continue; }

    const sweepTx = await agentWallet.writeContract({
      address: FACTORY,
      abi: factoryAbi,
      functionName: "sweep",
      args: [user, TOKENS.wARS, income, BigInt(head)],
    });
    await forno.waitForTransactionReceipt({ hash: sweepTx });
    const log: SweepLog = { user, income: income.toString(), sweepTx, fx: [] };

    for (const g of mine.filter((g) => g.token.toLowerCase() === TOKENS.wBRL.toLowerCase() && g.bps > 0)) {
      const inWars = (income * BigInt(g.bps)) / 10000n;
      if (inWars === 0n) continue;
      try {
        const fx = await swapWarsToBrlAndDeposit(inWars, g.alcancia, rates);
        log.fx!.push({ alcancia: g.alcancia, inWars: inWars.toString(), ...fx });
      } catch (e) {
        log.fx!.push({ alcancia: g.alcancia, inWars: inWars.toString(), error: String(e).slice(0, 300) });
      }
    }
    logs.push(log);
  }
  return { head, users: users.length, rates, receipt, logs };
}

const routerAbi = [
  {
    type: "function",
    name: "exactInput",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "path", type: "bytes" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

// ---------------------------------------------------------------- FX: Textile RFQ (Uniswap fallback)

const TEXTILE = "https://api.textilecredit.com/v2/rfq";

type TextileQuote = {
  rfqId: string;
  claimToken: string;
  status: string;
  quote: { takerPays: string; buyAmount: string; reactor: Address; expiresAt: number | string };
  transactions: { swap: { to: Address; data: Hex; value: string } };
};

async function textileProof() {
  const nonce = `0x${randomBytes(32).toString("hex")}` as Hex;
  const issuedAt = Date.now();
  const signature = await account.signTypedData({
    domain: { name: "Textile Taker Control", version: "1", chainId: 42220 },
    types: {
      TakerControl: [
        { name: "taker", type: "address" },
        { name: "chainId", type: "uint256" },
        { name: "nonce", type: "bytes32" },
        { name: "issuedAt", type: "uint256" },
      ],
    },
    primaryType: "TakerControl",
    message: { taker: account.address, chainId: 42220n, nonce, issuedAt: BigInt(issuedAt) },
  });
  return { nonce, issuedAt, signature };
}

async function textileRequest(sellToken: Address, buyToken: Address, sellAmount: bigint): Promise<TextileQuote> {
  const body = { chainId: 42220, sellToken, buyToken, sellAmount: sellAmount.toString(), taker: account.address, takerProof: await textileProof() };
  const r = await fetch(`${TEXTILE}/request`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(75_000),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`textile ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  if (j.data?.status !== "quoted") throw new Error(`textile ${j.data?.status}: ${j.data?.reason ?? ""}`);
  return j.data as TextileQuote;
}

async function balanceOf(token: Address) {
  return forno.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
}

async function ensureAllowance(token: Address, spender: Address, amount: bigint) {
  const current = await forno.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [account.address, spender] });
  if (current >= amount) return;
  if (current > 0n) {
    // USD₮-style tokens require resetting to zero first.
    const z = await agentWallet.writeContract({ address: token, abi: erc20Abi, functionName: "approve", args: [spender, 0n] });
    await forno.waitForTransactionReceipt({ hash: z });
  }
  const h = await agentWallet.writeContract({ address: token, abi: erc20Abi, functionName: "approve", args: [spender, amount] });
  await forno.waitForTransactionReceipt({ hash: h });
}

export type Leg = { venue: "textile" | "uniswap"; sell: Address; buy: Address; amountIn: string; amountOut: string; tx: Hex; rfqId?: string; textileError?: string };

async function textileLeg(sell: Address, buy: Address, amountIn: bigint): Promise<Leg> {
  const q = await textileRequest(sell, buy, amountIn);
  await ensureAllowance(sell, q.quote.reactor, BigInt(q.quote.takerPays));
  const exp = Number(q.quote.expiresAt);
  if (Date.now() >= (exp < 1e12 ? exp * 1000 : exp)) throw new Error("textile quote expired");
  const before = await balanceOf(buy);
  const tx = await agentWallet.sendTransaction({ to: q.transactions.swap.to, data: q.transactions.swap.data, value: 0n });
  const rc = await forno.waitForTransactionReceipt({ hash: tx });
  if (rc.status !== "success") throw new Error("textile swap reverted");
  fetch(`${TEXTILE}/${q.rfqId}/submit`, { method: "POST", headers: { "content-type": "application/json", "X-Rfq-Claim": q.claimToken }, body: JSON.stringify({ txHash: tx }) }).catch(() => {});
  const out = (await balanceOf(buy)) - before;
  return { venue: "textile", sell, buy, amountIn: amountIn.toString(), amountOut: out.toString(), tx, rfqId: q.rfqId };
}

async function uniswapLeg(sell: Address, buy: Address, amountIn: bigint, minOut: bigint): Promise<Leg> {
  await ensureAllowance(sell, UNISWAP_SWAP_ROUTER_02, amountIn);
  const path = encodePacked(["address", "uint24", "address"], [sell, POOL_FEE, buy]);
  const before = await balanceOf(buy);
  const tx = await agentWallet.writeContract({
    address: UNISWAP_SWAP_ROUTER_02,
    abi: routerAbi,
    functionName: "exactInput",
    args: [{ path, recipient: account.address, amountIn, amountOutMinimum: minOut }],
  });
  const rc = await forno.waitForTransactionReceipt({ hash: tx });
  if (rc.status !== "success") throw new Error("uniswap swap reverted");
  const out = (await balanceOf(buy)) - before;
  return { venue: "uniswap", sell, buy, amountIn: amountIn.toString(), amountOut: out.toString(), tx };
}

async function leg(sell: Address, buy: Address, amountIn: bigint, minOut: bigint): Promise<Leg> {
  try {
    return await textileLeg(sell, buy, amountIn);
  } catch (e) {
    const l = await uniswapLeg(sell, buy, amountIn, minOut);
    return { ...l, textileError: String(e).slice(0, 200) };
  }
}

// wARS → USD₮ → wBRL. No direct local-currency market exists on Celo yet, so USD₮ is a
// technical bridge between two legs; the user never holds dollars.
async function swapWarsToBrlAndDeposit(amountIn: bigint, alcancia: Address, rates: Rates) {
  const usdExpected = Number(amountIn) / 1e18 / rates.arsPerUsd;
  const leg1 = await leg(TOKENS.wARS, TOKENS.USDT, amountIn, BigInt(Math.floor(usdExpected * 0.97 * 1e6)));
  const usd = BigInt(leg1.amountOut);
  const brlExpected = (Number(usd) / 1e6) * rates.brlPerUsd;
  const leg2 = await leg(TOKENS.USDT, TOKENS.wBRL, usd, BigInt(Math.floor(brlExpected * 0.97 * 1e6)) * 10n ** 12n);
  const out = BigInt(leg2.amountOut);
  await ensureAllowance(TOKENS.wBRL, alcancia, out);
  const depositTx = await agentWallet.writeContract({ address: alcancia, abi: alcanciaAbi, functionName: "deposit", args: [out] });
  await forno.waitForTransactionReceipt({ hash: depositTx });
  return { outBrl: out.toString(), legs: [leg1, leg2], swapTx: leg2.tx, depositTx };
}
