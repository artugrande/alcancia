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
  LOCALS,
  LOCAL_CODES,
  POOL_FEE,
  TOKENS,
  TOKEN_SYMBOL,
  UNISWAP_SWAP_ROUTER_02,
  alcanciaAbi,
  erc20Abi,
  factoryAbi,
  localOf,
} from "./config";
import { forno, readRates, type Rates } from "./rates";

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
  try {
    const r = await fetch(`${SQD}/head`, { cache: "no-store" });
    if (!r.ok) throw new Error(`SQD head ${r.status}`);
    return (await r.json()).number - CONFIRMATIONS;
  } catch {
    return Number(await forno.getBlockNumber()) - CONFIRMATIONS;
  }
}

type LogFilter = { address?: string[]; topic0?: string[]; topic2?: string[] };

/** POST to SQD with retries on 429/5xx (honors Retry-After). */
async function sqdPost(body: unknown, tries = 3): Promise<Response> {
  for (let i = 0; ; i++) {
    const r = await fetch(`${SQD}/stream`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (r.ok || r.status === 204 || i >= tries - 1 || (r.status < 500 && r.status !== 429)) return r;
    const wait = Number(r.headers.get("retry-after")) * 1000 || 1500 * (i + 1);
    await new Promise((res) => setTimeout(res, Math.min(wait, 5000)));
  }
}

async function sqdLogsOnly(filter: LogFilter, fromBlock: number, toBlock: number) {
  const out: (SqdLog & { block: number })[] = [];
  let from = fromBlock;
  while (from <= toBlock) {
    const r = await sqdPost({
      type: "evm",
      fromBlock: from,
      toBlock,
      fields: {
        block: { number: true },
        log: { address: true, topics: true, data: true, transactionHash: true, logIndex: true },
      },
      logs: [filter],
    });
    if (r.status === 204) break;
    if (!r.ok) throw new Error(`SQD ${r.status}: ${(await r.text()).slice(0, 200)}`);
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

/** Fallback when SQD is overloaded or unreachable: the same logs from the public RPC, in chunks. */
async function rpcLogs(filter: LogFilter, fromBlock: number, toBlock: number) {
  const out: (SqdLog & { block: number })[] = [];
  const STEP = 5000;
  for (let f = fromBlock; f <= toBlock; f += STEP) {
    const t = Math.min(toBlock, f + STEP - 1);
    const logs = (await forno.request({
      method: "eth_getLogs",
      params: [{
        fromBlock: `0x${f.toString(16)}`,
        toBlock: `0x${t.toString(16)}`,
        address: filter.address as Address[] | undefined,
        topics: [filter.topic0?.[0] ?? null, null, filter.topic2?.[0] ?? null] as never,
      }],
    })) as { address: string; topics: string[]; data: string; transactionHash: string; logIndex: string; blockNumber: string }[];
    for (const l of logs) out.push({ address: l.address, topics: l.topics, data: l.data, transactionHash: l.transactionHash, logIndex: Number(l.logIndex), block: Number(l.blockNumber) });
  }
  return out;
}

export let lastLogSource: "sqd" | "rpc" = "sqd";

async function sqdLogs(filter: LogFilter, fromBlock: number, toBlock: number) {
  try {
    const logs = await sqdLogsOnly(filter, fromBlock, toBlock);
    lastLogSource = "sqd";
    return logs;
  } catch {
    lastLogSource = "rpc";
    return rpcLogs(filter, fromBlock, toBlock);
  }
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

export type FxLog = {
  alcancia: Address;
  from: string;
  to: string;
  amountIn: string;
  amountOut?: string;
  legs?: Leg[];
  depositTx?: Hex;
  refundTx?: Hex;
  error?: string;
};

export type SweepLog = { user: Address; incomeToken?: string; income: string; sweepTx?: Hex; fx?: FxLog[]; skipped?: string };

const ZERO = "0x0000000000000000000000000000000000000000";

export async function runSweep(onlyUser?: Address) {
  const head = await sqdSafeHead();
  const goals = (await goalsFromSqd(head)).filter(
    (g) => !onlyUser || g.user.toLowerCase() === onlyUser.toLowerCase(),
  );
  const users = [...new Set(goals.map((g) => g.user.toLowerCase()))] as Address[];
  const tokens = LOCAL_CODES.map((c) => LOCALS[c].token);

  // One paid Chainstack batch (US$0.01) with everything the agent needs to decide:
  // per user: income token, cursor, paused, total bps, and balance + allowance of every wFiat.
  const PER = 4 + tokens.length * 2;
  const calls: Call[] = [];
  for (const u of users) {
    calls.push({ to: FACTORY, data: encodeFunctionData({ abi: factoryAbi, functionName: "incomeTokenOf", args: [u] }) });
    calls.push({ to: FACTORY, data: encodeFunctionData({ abi: factoryAbi, functionName: "lastSweptBlock", args: [u] }) });
    calls.push({ to: FACTORY, data: encodeFunctionData({ abi: factoryAbi, functionName: "paused", args: [u] }) });
    calls.push({ to: FACTORY, data: encodeFunctionData({ abi: factoryAbi, functionName: "totalBps", args: [u] }) });
    for (const t of tokens) {
      calls.push({ to: t, data: encodeFunctionData({ abi: erc20Abi, functionName: "balanceOf", args: [u] }) });
      calls.push({ to: t, data: encodeFunctionData({ abi: erc20Abi, functionName: "allowance", args: [u, FACTORY] }) });
    }
  }
  const [{ results, receipt }, rates] = await Promise.all([
    users.length ? batchCall(calls) : Promise.resolve({ results: [] as Hex[], receipt: { paid: false, via: "forno" as const, error: "sin usuarios" } }),
    readRates(),
  ]);
  const dec = (fn: string, abi: typeof factoryAbi | typeof erc20Abi, i: number) =>
    decodeFunctionResult({ abi: abi as typeof factoryAbi, functionName: fn, data: results[i] }) as unknown;

  const logs: SweepLog[] = [];
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const o = i * PER;
    const incomeToken = dec("incomeTokenOf", factoryAbi, o) as Address;
    const last = Number(dec("lastSweptBlock", factoryAbi, o + 1) as bigint);
    const paused = dec("paused", factoryAbi, o + 2) as boolean;
    const totalBps = BigInt(dec("totalBps", factoryAbi, o + 3) as number | bigint);
    if (!incomeToken || incomeToken === ZERO) { logs.push({ user, income: "0", skipped: "sin moneda de ingreso" }); continue; }
    if (paused) { logs.push({ user, income: "0", skipped: "pausado" }); continue; }
    const ti = tokens.findIndex((t) => t.toLowerCase() === incomeToken.toLowerCase());
    const balance = dec("balanceOf", erc20Abi, o + 4 + ti * 2) as bigint;
    const allowance = dec("allowance", erc20Abi, o + 5 + ti * 2) as bigint;
    const home = localOf(incomeToken);
    const mine = goals.filter((g) => g.user.toLowerCase() === user);

    const from = Math.max(last + 1, Math.min(...mine.map((g) => g.block)));
    const own = new Set([FACTORY, account.address, ...mine.map((g) => g.alcancia)].map((x) => x.toLowerCase()));
    const transfers = (await incomingTransfers(user, incomeToken, from, head)).filter((t) => !own.has(t.from.toLowerCase()));
    let income = transfers.reduce((s, t) => s + t.amount, 0n);
    const base = { user, incomeToken: LOCALS[home].symbol };
    if (income === 0n) { logs.push({ ...base, income: "0", skipped: "sin ingresos nuevos" }); continue; }
    if (income > balance) income = balance;
    if (totalBps > 0n && (income * totalBps) / 10000n > allowance) income = (allowance * 10000n) / totalBps;
    if (income === 0n) { logs.push({ ...base, income: "0", skipped: "sin permiso suficiente" }); continue; }

    const sweepTx = await agentWallet.writeContract({
      address: FACTORY,
      abi: factoryAbi,
      functionName: "sweep",
      args: [user, incomeToken, income, BigInt(head)],
    });
    await forno.waitForTransactionReceipt({ hash: sweepTx });
    const log: SweepLog = { ...base, income: income.toString(), sweepTx, fx: [] };

    // Shares of goals in another local currency were sent to the agent: convert and deposit.
    for (const g of mine.filter((g) => g.token.toLowerCase() !== incomeToken.toLowerCase() && g.bps > 0)) {
      const amount = (income * BigInt(g.bps)) / 10000n;
      if (amount === 0n) continue;
      log.fx!.push(await convertAndDeposit(user, incomeToken, g.token, amount, g.alcancia, rates));
    }
    logs.push(log);
  }
  return { head, users: users.length, rates, receipt, logs, logSource: lastLogSource };
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

const minOut = (amountIn: bigint, from: Address, to: Address, r: Rates) => {
  const per = (t: Address) => (t.toLowerCase() === TOKENS.USDT.toLowerCase() ? 1 : r.perUsd[localOf(t)]);
  const dec = (t: Address) => (t.toLowerCase() === TOKENS.USDT.toLowerCase() ? 6 : 18);
  const out = (Number(amountIn) / 10 ** dec(from) / per(from)) * per(to) * 0.97; // 3% slippage
  return BigInt(Math.floor(out * 1e6)) * 10n ** BigInt(dec(to) - 6);
};

// local → USD₮ → local. There is no direct market between two local currencies on Celo
// yet, so USD₮ is a technical bridge between two Textile legs; the user never holds dollars.
// If a leg fails, the agent gives the money back instead of keeping it.
export async function convertAndDeposit(user: Address, from: Address, to: Address, amount: bigint, alcancia: Address, r: Rates, marker?: Hex): Promise<FxLog> {
  // `marker` (a source tx hash) rides in the calldata of the final deposit/refund so the
  // same contribution can never be processed twice (see contributionProcessed).
  const ds = marker ? { dataSuffix: marker } : {};
  const log: FxLog = { alcancia, from: TOKEN_SYMBOL[from.toLowerCase()], to: TOKEN_SYMBOL[to.toLowerCase()], amountIn: amount.toString(), legs: [] };
  let usd: bigint;
  try {
    const l1 = await leg(from, TOKENS.USDT, amount, minOut(amount, from, TOKENS.USDT, r));
    log.legs!.push(l1);
    usd = BigInt(l1.amountOut);
  } catch (e) {
    log.error = `no se pudo convertir: ${String(e).slice(0, 160)}`;
    log.refundTx = await agentWallet.writeContract({ address: from, abi: erc20Abi_transfer, functionName: "transfer", args: [user, amount], ...ds });
    return log;
  }
  try {
    const l2 = await leg(TOKENS.USDT, to, usd, minOut(usd, TOKENS.USDT, to, r));
    log.legs!.push(l2);
    const out = BigInt(l2.amountOut);
    await ensureAllowance(to, alcancia, out);
    log.depositTx = await agentWallet.writeContract({ address: alcancia, abi: alcanciaAbi, functionName: "deposit", args: [out], ...ds });
    await forno.waitForTransactionReceipt({ hash: log.depositTx });
    log.amountOut = out.toString();
  } catch (e) {
    log.error = `no se pudo completar la conversión: ${String(e).slice(0, 160)}`;
    // Undo leg 1 back to the user's own currency; as a last resort return the USD₮.
    try {
      const back = await leg(TOKENS.USDT, from, usd, minOut(usd, TOKENS.USDT, from, r));
      log.legs!.push(back);
      log.refundTx = await agentWallet.writeContract({ address: from, abi: erc20Abi_transfer, functionName: "transfer", args: [user, BigInt(back.amountOut)], ...ds });
    } catch {
      log.refundTx = await agentWallet.writeContract({ address: TOKENS.USDT, abi: erc20Abi_transfer, functionName: "transfer", args: [user, usd], ...ds });
    }
  }
  return log;
}

const erc20Abi_transfer = [
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

// ---------------------------------------------------------------- contributions in another currency

/** Has the agent already sent a tx carrying `marker` in its calldata since `fromBlock`? (SQD, free) */
export async function contributionProcessed(marker: Hex, fromBlock: number): Promise<boolean> {
  const head = (await fetch(`${SQD}/head`, { cache: "no-store" }).then((r) => r.json())).number as number;
  const needle = marker.slice(2).toLowerCase();
  let from = fromBlock;
  while (from <= head) {
    const r = await fetch(`${SQD}/stream`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "evm",
        fromBlock: from,
        toBlock: head,
        fields: { block: { number: true }, transaction: { hash: true, input: true } },
        transactions: [{ from: [account.address.toLowerCase()] }],
      }),
      cache: "no-store",
    });
    if (r.status === 204 || !r.ok) break;
    const lines = (await r.text()).split("\n").filter(Boolean);
    if (!lines.length) break;
    let last = from;
    for (const line of lines) {
      const b = JSON.parse(line) as { header: { number: number }; transactions?: { input: string }[] };
      last = b.header.number;
      if (b.transactions?.some((t) => t.input.toLowerCase().includes(needle))) return true;
    }
    from = last + 1;
  }
  // Also check the latest few blocks straight from the chain (SQD can lag a couple of blocks).
  const latest = await forno.getBlockNumber();
  for (let b = BigInt(Math.max(fromBlock, head - 2)); b <= latest; b++) {
    const blk = await forno.getBlock({ blockNumber: b, includeTransactions: true });
    if (blk.transactions.some((t) => typeof t !== "string" && t.from.toLowerCase() === account.address.toLowerCase() && t.input.toLowerCase().includes(needle))) return true;
  }
  return false;
}
