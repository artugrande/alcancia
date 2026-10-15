"use client";
import { useEffect, useState } from "react";
import { useAccount, useConfig, useReadContract, useReadContracts } from "wagmi";
import { getAccount, switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { formatUnits, parseUnits, type Address } from "viem";
import confetti from "canvas-confetti";
import { DATA_SUFFIX, FACTORY, LOCALS, LOCAL_CODES, TOKEN_SYMBOL, alcanciaAbi, erc20Abi, explorer, factoryAbi, localOf, offrampUrl, rampUrl, type Local } from "@/lib/config";
import { convert, type Rates } from "@/lib/rates";
import { fmt } from "@/lib/plan";
import { useRates } from "./ToolCards";
import { useI18n } from "@/lib/i18n";

const card = "rounded-3xl bg-white p-4 shadow-md ring-1 ring-emerald-100";
const btn = "rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50";
const ghost = "rounded-full border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50";
const FIELDS = ["name", "token", "target", "deadline", "balance", "pendingWithdraw", "unlocked"] as const;

type Info = {
  address: Address;
  bps: number;
  name: string;
  token: Address;
  target: bigint;
  deadline: bigint;
  balance: bigint;
  pending: readonly [bigint, bigint, boolean];
  unlocked: boolean;
};

export function useAlcancias(user?: Address) {
  const list = useReadContract({ address: FACTORY, abi: factoryAbi, functionName: "alcanciasOf", args: user ? [user] : undefined, query: { enabled: !!user } });
  const [addrs, bps] = (list.data as [Address[], number[]] | undefined) ?? [[], []];
  const details = useReadContracts({
    contracts: addrs.flatMap((a) => FIELDS.map((f) => ({ address: a, abi: alcanciaAbi, functionName: f }))),
    query: { enabled: addrs.length > 0 },
  });
  const items: Info[] = addrs.map((a, i) => {
    const r = (j: number) => details.data?.[i * FIELDS.length + j]?.result;
    return {
      address: a,
      bps: Number(bps[i]),
      name: (r(0) as string) ?? "…",
      token: (r(1) as Address) ?? LOCALS.ARS.token,
      target: (r(2) as bigint) ?? 0n,
      deadline: (r(3) as bigint) ?? 0n,
      balance: (r(4) as bigint) ?? 0n,
      pending: (r(5) as readonly [bigint, bigint, boolean]) ?? [0n, 0n, false],
      unlocked: (r(6) as boolean) ?? false,
    };
  });
  const refetch = () => { list.refetch(); details.refetch(); };
  return { items, loading: list.isLoading, count: addrs.length, refetch };
}

/** The user's income currency: set onchain at creation, else guessed from their largest wFiat balance. */
export function useHome(user?: Address, rates?: Rates | null) {
  const income = useReadContract({ address: FACTORY, abi: factoryAbi, functionName: "incomeTokenOf", args: user ? [user] : undefined, query: { enabled: !!user } });
  const balances = useReadContracts({
    contracts: user ? LOCAL_CODES.map((c) => ({ address: LOCALS[c].token, abi: erc20Abi, functionName: "balanceOf", args: [user] })) : [],
  });
  const onchain = income.data as Address | undefined;
  if (onchain && onchain !== "0x0000000000000000000000000000000000000000") return { home: localOf(onchain), set: true, balances: balances.data, refetch: balances.refetch };
  let best: Local = "ARS";
  let bestUsd = 0;
  LOCAL_CODES.forEach((c, i) => {
    const b = Number(formatUnits((balances.data?.[i]?.result as unknown as bigint | undefined) ?? 0n, 18));
    const usd = rates?.perUsd[c] ? b / rates.perUsd[c] : 0;
    if (usd > bestUsd) { bestUsd = usd; best = c; }
  });
  return { home: best, set: false, balances: balances.data, refetch: balances.refetch };
}

export function Dashboard({ onAdd }: { onAdd: () => void }) {
  const { t } = useI18n();
  const { address } = useAccount();
  const { items, refetch } = useAlcancias(address);
  const rates = useRates();
  const { home } = useHome(address, rates);
  const homeToken = LOCALS[home].token;
  const wallet = useReadContracts({
    contracts: address
      ? [
          { address: homeToken, abi: erc20Abi, functionName: "balanceOf", args: [address] },
          { address: homeToken, abi: erc20Abi, functionName: "allowance", args: [address, FACTORY] },
        ]
      : [],
  });
  const [sync, setSync] = useState<{ loading: boolean; result?: SyncResult; error?: string }>({ loading: false });
  const [ritual, setRitual] = useState<Info | null>(null);

  // Milestone confetti (25/50/75/100%), remembered per alcancía.
  useEffect(() => {
    for (const a of items) {
      if (a.target === 0n) continue;
      const pct = Number((a.balance * 100n) / a.target);
      const hit = [100, 75, 50, 25].find((m) => pct >= m) ?? 0;
      const k = `alcancia:m:${a.address}`;
      let prev = 0;
      try { prev = Number(localStorage.getItem(k) || 0); } catch {}
      if (hit > prev) {
        confetti({ particleCount: 60 + hit, spread: 70, origin: { y: 0.4 } });
        try { localStorage.setItem(k, String(hit)); } catch {}
      }
    }
  }, [items]);

  const warsBalance = (wallet.data?.[0]?.result as bigint) ?? 0n;
  const allowance = (wallet.data?.[1]?.result as bigint) ?? 0n;
  const totalSaved = items.reduce((s, a) => {
    const v = Number(formatUnits(a.balance, 18));
    const c = localOf(a.token);
    return s + (c === home ? v : rates ? convert(v, c, home, rates) : 0);
  }, 0);
  const ramp = address ? rampUrl(address, home) : null;
  const avg = items.length ? items.reduce((s, a) => s + (a.target ? Number((a.balance * 10000n) / a.target) / 100 : 0), 0) / items.length : 0;
  const level = t.levels[avg >= 75 ? 4 : avg >= 50 ? 3 : avg >= 25 ? 2 : avg > 0 ? 1 : 0];

  async function runSync() {
    setSync({ loading: true });
    try {
      const r = await fetch("/api/sweep", { method: "POST", body: JSON.stringify({ user: address }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      setSync({ loading: false, result: j });
      refetch();
      wallet.refetch();
    } catch (e) {
      setSync({ loading: false, error: (e as Error).message });
    }
  }

  return (
    <div className="space-y-4">
      <div className={`${card} bg-gradient-to-br from-emerald-500 to-teal-600 text-white ring-0`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm opacity-80">{t.totalSaved}</p>
            <p className="text-3xl font-black">{fmt(totalSaved, home)}</p>
            <p className="mt-1 text-sm">{level}</p>
          </div>
          <div className="text-right text-sm">
            <p className="opacity-80">{t.inWallet}</p>
            <p className="font-bold">{LOCALS[home].flag} {fmt(Number(formatUnits(warsBalance, 18)), LOCALS[home].symbol)}</p>
            <p className="text-xs opacity-80">{t.allowance} {fmt(Number(formatUnits(allowance, 18)), LOCALS[home].symbol)}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {ramp && <a href={ramp} target="_blank" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-700">{t.loadWith(LOCALS[home].symbol)}</a>}
          <button onClick={runSync} disabled={sync.loading} className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold">
            {sync.loading ? t.syncing : t.sync}
          </button>
          <button onClick={onAdd} className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold">{t.newGoal}</button>
        </div>
      </div>

      {address && <p className="rounded-2xl bg-white/70 p-3 text-xs text-gray-600 ring-1 ring-emerald-100">{t.walletInfo(`${address.slice(0, 6)}…${address.slice(-4)}`)}</p>}
      {sync.result && <SyncCard r={sync.result} />}
      {sync.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{sync.error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((a) => (
          <AlcanciaCard key={a.address} a={a} home={home} rates={rates} onRitual={() => setRitual(a)} onChange={refetch} />
        ))}
      </div>
      {ritual && <Ritual a={ritual} onClose={() => { setRitual(null); refetch(); }} />}
    </div>
  );
}

function AlcanciaCard({ a, home, rates, onRitual, onChange }: { a: Info; home: Local; rates: Rates | null; onRitual: () => void; onChange: () => void }) {
  const { t, lang } = useI18n();
  const cur = localOf(a.token);
  const [withdrew, setWithdrew] = useState<number | null>(null);
  const [contrib, setContrib] = useState<string | null>(null);
  const [contribMsg, setContribMsg] = useState("");
  const { address } = useAccount();
  const walletBal = useReadContract({
    address: a.token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const myBal = Number(formatUnits((walletBal.data as bigint | undefined) ?? 0n, 18));
  const config = useConfig();
  const [busy, setBusy] = useState(false);
  const sym = TOKEN_SYMBOL[a.token.toLowerCase()] ?? "wARS";
  const bal = Number(formatUnits(a.balance, 18));
  const tgt = Number(formatUnits(a.target, 18));
  const pct = tgt ? Math.min(100, (bal / tgt) * 100) : 0;
  const [emoji, ...rest] = a.name.split(" ");
  const pendingAmount = a.pending[0];
  const unlockAt = Number(a.pending[1]) * 1000;
  const canExecute = pendingAmount > 0n && (a.pending[2] || Date.now() >= unlockAt);

  async function send(fn: string, args: unknown[] = []): Promise<void> {
    setBusy(true);
    try {
      if (getAccount(config).chainId !== 42220) await switchChain(config, { chainId: 42220 });
      const h = await writeContract(config, { address: a.address, abi: alcanciaAbi, functionName: fn, args, dataSuffix: DATA_SUFFIX });
      await waitForTransactionReceipt(config, { hash: h });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl bg-white p-4 shadow-md ring-1 ring-emerald-100">
      <div className="flex items-center justify-between">
        <p className="text-lg font-bold">{emoji} {rest.join(" ")}</p>
        <span className="text-xs text-gray-400">{(a.bps / 100).toFixed(1)}% {t.ofIncome}</span>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-emerald-100">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-sm">
        <span><b>{fmt(bal, sym)}</b> {t.of} {fmt(tgt, sym)}</span>
        <span className="text-gray-500">{pct.toFixed(0)}%</span>
      </div>
      {cur !== home && rates && <p className="text-xs text-emerald-700">{LOCALS[cur].flag} ≈ {fmt(convert(bal, cur, home, rates), home)} · {t.approxSaving}</p>}
      <p className="mt-1 text-xs text-gray-400">
        {t.until} {new Date(Number(a.deadline) * 1000).toLocaleDateString(lang === "en" ? "en-US" : "es-AR", { month: "long", year: "numeric" })} ·{" "}
        <a className="underline" href={explorer(a.address)} target="_blank">{a.address.slice(0, 8)}…</a>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={ghost} onClick={() => { setContrib(contrib === null ? "" : null); setContribMsg(""); }}>{t.contribute}</button>
        {a.unlocked ? (
          <button className={btn} disabled={busy || a.balance === 0n} onClick={() => send("withdraw", [a.balance]).then(() => setWithdrew(bal))}>{t.withdraw}</button>
        ) : pendingAmount > 0n ? (
          canExecute ? (
            <button className={btn} disabled={busy} onClick={() => send("executeEarlyWithdraw").then(() => setWithdrew(Number(formatUnits(pendingAmount, 18))))}>{t.takeOut} {fmt(Number(formatUnits(pendingAmount, 18)), sym)}</button>
          ) : (
            <>
              <span className="self-center text-xs text-gray-500">{t.unlocksAt} {new Date(unlockAt).toLocaleString(lang === "en" ? "en-US" : "es-AR")}</span>
              <button className={ghost} onClick={onRitual}>{t.riddle}</button>
              <button className={ghost} disabled={busy} onClick={() => send("cancelEarlyWithdraw")}>{t.regret}</button>
            </>
          )
        ) : (
          <button className={ghost} disabled={a.balance === 0n} onClick={onRitual}>{t.breakIt}</button>
        )}
      </div>
      {contrib !== null && (
        <div className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm">
          <p className="text-xs text-gray-600">{t.contributeHelp(fmt(myBal, sym))}</p>
          <div className="mt-2 flex gap-2">
            <input
              type="number"
              className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2"
              placeholder="0"
              value={contrib}
              onChange={(e) => setContrib(e.target.value)}
            />
            <button
              className={btn}
              disabled={busy || !Number(contrib) || Number(contrib) > myBal}
              onClick={async () => {
                const amt = parseUnits(contrib, 18);
                setBusy(true);
                setContribMsg("");
                try {
                  if (getAccount(config).chainId !== 42220) await switchChain(config, { chainId: 42220 });
                  const ap = await writeContract(config, { address: a.token, abi: erc20Abi, functionName: "approve", args: [a.address, amt], dataSuffix: DATA_SUFFIX });
                  await waitForTransactionReceipt(config, { hash: ap });
                  const h = await writeContract(config, { address: a.address, abi: alcanciaAbi, functionName: "deposit", args: [amt], dataSuffix: DATA_SUFFIX });
                  await waitForTransactionReceipt(config, { hash: h });
                  confetti({ particleCount: 80, spread: 60, origin: { y: 0.5 } });
                  setContrib(null);
                  walletBal.refetch();
                  onChange();
                } catch (e) {
                  setContribMsg((e as Error).message.split("\n")[0]);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "…" : t.contributeGo}
            </button>
          </div>
          {Number(contrib) > myBal && address && rampUrl(address, cur) && (
            <a href={rampUrl(address, cur)!} target="_blank" className="mt-2 block text-xs font-semibold text-emerald-700 underline">{t.loadWith(sym)}</a>
          )}
          {contribMsg && <p className="mt-2 text-xs text-red-600">{contribMsg}</p>}
        </div>
      )}
      {withdrew !== null && offrampUrl(cur, withdrew) && (
        <a href={offrampUrl(cur, withdrew)!} target="_blank" className="mt-3 block rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
          {t.offramp}
        </a>
      )}
    </div>
  );
}

function Ritual({ a, onClose }: { a: Info; onClose: () => void }) {
  const { t, lang } = useI18n();
  const config = useConfig();
  const sym = TOKEN_SYMBOL[a.token.toLowerCase()] ?? "wARS";
  const bal = Number(formatUnits(a.balance, 18));
  const tgt = Number(formatUnits(a.target, 18));
  const hasPending = a.pending[0] > 0n;
  const [amount, setAmount] = useState(hasPending ? Number(formatUnits(a.pending[0], 18)) : Math.floor(bal / 2));
  const [reason, setReason] = useState("");
  const [stage, setStage] = useState<"reflect" | "riddle" | "approved">(hasPending ? "reflect" : "reflect");
  const [r, setR] = useState<{ reply: string; question: string; hint: string; token: string } | null>(null);
  const [answer, setAnswer] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const share = bal ? Math.round((amount / bal) * 100) : 0;
  const back = tgt ? Math.round((amount / tgt) * 100) : 0;

  async function start() {
    setBusy(true);
    setMsg("");
    try {
      if (!hasPending) {
        if (getAccount(config).chainId !== 42220) await switchChain(config, { chainId: 42220 });
        const h = await writeContract(config, { address: a.address, abi: alcanciaAbi, functionName: "requestEarlyWithdraw", args: [parseUnits(String(amount), 18)], dataSuffix: DATA_SUFFIX });
        await waitForTransactionReceipt(config, { hash: h });
      }
      const res = await fetch("/api/unlock", {
        method: "POST",
        body: JSON.stringify({ action: "start", lang, alcancia: a.address, reason, context: `Quiere sacar ${amount} ${sym} de ${bal} ahorrados; meta ${tgt} ${sym}.` }),
      }).then((x) => x.json());
      setR(res);
      setStage("riddle");
    } catch (e) {
      setMsg((e as Error).message.split("\n")[0]);
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    if (!r) return;
    setBusy(true);
    const res = await fetch("/api/unlock", { method: "POST", body: JSON.stringify({ action: "answer", lang, alcancia: a.address, token: r.token, answer }) }).then((x) => x.json());
    setBusy(false);
    setMsg(res.comment || res.error || "");
    if (res.correct && res.tx) setStage("approved");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-xl font-black">{t.breakTitle(a.name)}</p>
        {stage === "reflect" && (
          <>
            <label className="mt-4 block text-sm text-gray-600">{t.howMuch(sym)}</label>
            <input type="number" disabled={hasPending} className="mt-1 w-full rounded-xl border px-3 py-2 text-lg font-bold" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            <div className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
              {t.reflect(share, back)}
            </div>
            <label className="mt-4 block text-sm text-gray-600">{t.why}</label>
            <textarea className="mt-1 w-full rounded-xl border px-3 py-2" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.whyPh} />
            <p className="mt-2 text-xs text-gray-500">{t.neverLocked}</p>
            <div className="mt-4 flex gap-2">
              <button className={btn} disabled={busy || reason.trim().length < 5 || amount <= 0 || amount > bal} onClick={start}>{busy ? "…" : hasPending ? t.toRiddle : t.requestAndGo}</button>
              <button className={ghost} onClick={onClose}>{t.betterNot}</button>
            </div>
          </>
        )}
        {stage === "riddle" && r && (
          <>
            <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm">{r.reply}</p>
            <p className="mt-4 font-semibold">🧩 {r.question}</p>
            <input className="mt-2 w-full rounded-xl border px-3 py-2" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={t.answerPh} />
            <p className="mt-1 text-xs text-gray-400">{t.hint} {r.hint}</p>
            <div className="mt-4 flex gap-2">
              <button className={btn} disabled={busy || !answer} onClick={check}>{busy ? t.agentThinking : t.answer}</button>
              <button className={ghost} onClick={onClose}>{t.wait72}</button>
            </div>
          </>
        )}
        {stage === "approved" && (
          <>
            <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">{t.approved}</p>
            <button className={`${btn} mt-4`} onClick={onClose}>{t.back}</button>
          </>
        )}
        {msg && <p className="mt-3 text-sm text-gray-600">{msg}</p>}
      </div>
    </div>
  );
}

type SyncResult = {
  head: number;
  receipt: { paid: boolean; via: string; tx?: string; amount?: string; error?: string };
  logs: {
    user: string;
    incomeToken?: string;
    income: string;
    sweepTx?: string;
    skipped?: string;
    fx?: { from: string; to: string; amountIn: string; amountOut?: string; legs?: { venue: string; tx: string; sell: string; buy: string }[]; depositTx?: string; refundTx?: string; error?: string }[];
  }[];
};

const sym = (t: string) => TOKEN_SYMBOL[t.toLowerCase()] ?? "USD₮";

function SyncCard({ r }: { r: SyncResult }) {
  const { t } = useI18n();
  const mine = r.logs[0];
  return (
    <div className="rounded-3xl bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100">
      <p>{t.syncHead(r.head)}</p>
      <p>
        {r.receipt.via === "chainstack" ? t.syncPaid(r.receipt.amount ?? "") : t.syncForno}
        {r.receipt.tx && <> · <a className="underline" href={explorer(r.receipt.tx)} target="_blank">{t.receipt}</a></>}
      </p>
      {!mine && <p>{t.noAlcancias}</p>}
      {mine?.skipped && <p>⏸ {mine.skipped}</p>}
      {mine?.sweepTx && (
        <p>
          {t.swept(fmt(Number(formatUnits(BigInt(mine.income), 18)), mine.incomeToken))} ·{" "}
          <a className="underline" href={explorer(mine.sweepTx)} target="_blank">tx</a>
        </p>
      )}
      {mine?.fx?.map((f, i) => (
        <p key={i}>
          💱 {fmt(Number(formatUnits(BigInt(f.amountIn), 18)), f.from)} → {f.amountOut ? fmt(Number(formatUnits(BigInt(f.amountOut), 18)), f.to) : f.to}
          {f.legs?.map((l, j) => (
            <span key={j}> · <a className="underline" href={explorer(l.tx)} target="_blank">{l.venue === "textile" ? "Textile" : "Uniswap"} {sym(l.sell)}→{sym(l.buy)}</a></span>
          ))}
          {f.depositTx && <> · <a className="underline" href={explorer(f.depositTx)} target="_blank">{t.deposit}</a></>}
          {f.refundTx && <> · <a className="underline" href={explorer(f.refundTx)} target="_blank">{t.refunded}</a></>}
          {f.error && <span className="text-amber-300"> · {f.error}</span>}
        </p>
      ))}
    </div>
  );
}
