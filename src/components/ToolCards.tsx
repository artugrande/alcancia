"use client";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useConfig } from "wagmi";
import { switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { decodeEventLog, parseUnits, type Address } from "viem";
import confetti from "canvas-confetti";
import { DATA_SUFFIX, FACTORY, LOCALS, LOCAL_CODES, erc20Abi, explorer, factoryAbi, type Currency, type Local } from "@/lib/config";
import { buildPlan, fmt, saveCurrency, type Budget, type GoalDraft } from "@/lib/plan";
import { convert, type Rates } from "@/lib/rates";
import { DEMO_BUDGET, demoCosts, useI18n } from "@/lib/i18n";

export function useRates() {
  const [rates, setRates] = useState<Rates | null>(null);
  useEffect(() => {
    fetch("/api/rates").then((r) => r.json()).then(setRates).catch(() => {});
  }, []);
  return rates;
}

const card = "rounded-3xl bg-white p-4 shadow-md ring-1 ring-brand-100";
const btn = "rounded-full bg-brand-600 px-5 py-2.5 font-semibold text-white shadow hover:bg-brand-700 disabled:opacity-50";

export function GoalCards({ initial, home, onConfirm }: { initial: GoalDraft[]; home: Local; onConfirm: (g: GoalDraft[]) => void }) {
  const { t } = useI18n();
  const [goals, setGoals] = useState(initial);
  const rates = useRates();
  const set = (i: number, p: Partial<GoalDraft>) => setGoals((g) => g.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {goals.map((g, i) => (
          <div key={i} className={card}>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-3xl">{g.emoji}</span>
              <input className="flex-1 bg-transparent text-lg font-bold outline-none" value={g.name} onChange={(e) => set(i, { name: e.target.value })} />
              <button className="text-gray-300 hover:text-red-500" onClick={() => setGoals((x) => x.filter((_, j) => j !== i))}>✕</button>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
                value={g.amount}
                onChange={(e) => set(i, { amount: Number(e.target.value) })}
              />
              <select className="rounded-xl border border-gray-200 px-2" value={g.currency} onChange={(e) => set(i, { currency: e.target.value as Currency })}>
                {LOCAL_CODES.map((c) => <option key={c} value={c}>{LOCALS[c].flag} {c}</option>)}
                <option value="USD">💵 USD</option>
              </select>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-gray-500">
              <input type="month" className="rounded-lg border border-gray-200 px-2 py-1" value={g.deadline} onChange={(e) => set(i, { deadline: e.target.value })} />
              {rates && g.currency !== home && <span>≈ {fmt(convert(g.amount, g.currency, home, rates), home)}</span>}
            </div>
            <CurrencyNote goal={g.currency} home={home} />
          </div>
        ))}
      </div>
      <button className={btn} disabled={!goals.length} onClick={() => onConfirm(goals)}>{t.confirmGoals}</button>
    </div>
  );
}

function CurrencyNote({ goal, home }: { goal: Currency; home: Local }) {
  const { t } = useI18n();
  if (goal === home) return null;
  if (goal === "USD")
    return <p className="mt-2 text-xs text-amber-700">{t.noteUsd(LOCALS[home].symbol)}</p>;
  const { fxBlocked } = saveCurrency(goal, home);
  return fxBlocked ? (
    <p className="mt-2 text-xs text-amber-700">{t.noteBlocked(LOCALS[goal].flag, LOCALS[home].symbol, LOCALS[goal].symbol)}</p>
  ) : (
    <p className="mt-2 text-xs text-brand-700">{t.noteFx(LOCALS[goal].flag, LOCALS[goal].symbol)}</p>
  );
}

export function BudgetForm({ suggested, home: initialHome, demo, onConfirm }: { suggested: string[]; home: Local; demo?: boolean; onConfirm: (b: Budget) => void }) {
  const { t, lang } = useI18n();
  const rates = useRates();
  const [home, setHome] = useState<Local>(initialHome);
  const [income, setIncome] = useState(0);
  const [costs, setCosts] = useState(() =>
    (demo ? demoCosts(lang) : suggested?.length ? suggested : demoCosts(lang)).map((name) => ({ name, amount: 0 })),
  );
  // Demo: prefill realistic numbers in the user's currency (ARS preset converted at live rates).
  useEffect(() => {
    if (!demo || !rates) return;
    const k = (n: number) => {
      const v = convert(n, "ARS", home, rates);
      const step = v > 10_000 ? 1000 : v > 1000 ? 100 : 10;
      return Math.round(v / step) * step;
    };
    setIncome(k(DEMO_BUDGET.ARS.income));
    setCosts(demoCosts(lang).map((name, i) => ({ name, amount: k(DEMO_BUDGET.ARS.costs[i]) })));
  }, [demo, rates, home, lang]);
  const fixed = costs.reduce((s, c) => s + (c.amount || 0), 0);
  return (
    <div className={card}>
      <label className="text-sm font-semibold text-gray-600">{t.whichCurrency}</label>
      <div className="mt-1 flex flex-wrap gap-2">
        {LOCAL_CODES.map((c) => (
          <button key={c} onClick={() => setHome(c)} className={`rounded-full px-3 py-1.5 text-sm ${home === c ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-800"}`}>
            {LOCALS[c].flag} {LOCALS[c].symbol}
          </button>
        ))}
      </div>
      <label className="mt-4 block text-sm font-semibold text-gray-600">{t.incomeQ(home)}</label>
      <input type="number" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-lg font-bold" value={income || ""} placeholder="0" onChange={(e) => setIncome(Number(e.target.value))} />
      <p className="mt-4 text-sm font-semibold text-gray-600">{t.fixedQ}</p>
      <div className="mt-2 space-y-2">
        {costs.map((c, i) => (
          <div key={i} className="flex gap-2">
            <input className="flex-1 rounded-xl border border-gray-200 px-3 py-2" value={c.name} onChange={(e) => setCosts((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} />
            <input type="number" className="w-36 rounded-xl border border-gray-200 px-3 py-2" value={c.amount || ""} placeholder="0" onChange={(e) => setCosts((x) => x.map((y, j) => (j === i ? { ...y, amount: Number(e.target.value) } : y)))} />
          </div>
        ))}
        <button className="text-sm text-brand-600" onClick={() => setCosts((x) => [...x, { name: "", amount: 0 }])}>{t.addCost}</button>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-gray-600">{t.freeLeft} <b>{fmt(income - fixed, home)}</b></span>
        <button className={btn} disabled={income <= 0 || fixed >= income} onClick={() => onConfirm({ home, income, costs })}>{t.done}</button>
      </div>
    </div>
  );
}

const COLORS = ["#5f50fb", "#f59e0b", "#8f7dfc", "#fbbf24", "#3e33b5", "#a3a3a3"];

export function PlanCard({ note, goals, budget, onCreated, onDone }: { note: string; goals: GoalDraft[]; budget: Budget; onCreated: (a: Address[]) => void; onDone: () => void }) {
  const { t } = useI18n();
  const rates = useRates();
  const [created, setCreated] = useState<{ address: Address; row: number }[]>([]);
  const [bps, setBps] = useState<number[] | undefined>();
  const [step, setStep] = useState<"idle" | "approve" | "create" | "done" | "error">("idle");
  const [err, setErr] = useState("");
  const [tx, setTx] = useState<string[]>([]);
  const { address, chainId } = useAccount();
  const config = useConfig();
  const plan = useMemo(() => (rates ? buildPlan(goals, budget, rates, bps) : null), [goals, budget, rates, bps]);
  if (!plan) return <div className={card}>{t.readingRates}</div>;

  const libre = Math.max(0, budget.income * (plan.freePct - plan.totalBps / 10000));
  let acc = 0;
  const stops = plan.rows.map((r, i) => {
    const s = `${COLORS[i % COLORS.length]} ${(acc / 100).toFixed(1)}% ${((acc + r.bps) / 100).toFixed(1)}%`;
    acc += r.bps;
    return s;
  });
  stops.push(`#e5e7eb ${(acc / 100).toFixed(1)}% 100%`);

  async function create() {
    if (!address || !plan) return;
    try {
      setErr("");
      if (chainId !== 42220) await switchChain(config, { chainId: 42220 });
      const homeToken = LOCALS[budget.home].token;
      // Bounded allowance: ~3 months of savings, never infinite.
      const allowance = parseUnits(String(Math.ceil((budget.income * plan.totalBps * 3) / 10000)), 18);
      setStep("approve");
      const a = await writeContract(config, { address: homeToken, abi: erc20Abi, functionName: "approve", args: [FACTORY, allowance], dataSuffix: DATA_SUFFIX });
      setTx((t) => [...t, a]);
      await waitForTransactionReceipt(config, { hash: a });
      setStep("create");
      const h = await writeContract(config, {
        address: FACTORY,
        abi: factoryAbi,
        functionName: "createBatchWithIncome",
        args: [homeToken, plan.rows.map((r) => ({ token: r.token, name: `${r.emoji} ${r.name}`, target: r.target, deadline: r.deadlineTs, bps: r.bps }))],
        dataSuffix: DATA_SUFFIX,
      });
      setTx((t) => [...t, h]);
      const receipt = await waitForTransactionReceipt(config, { hash: h });
      const addrs: Address[] = [];
      for (const l of receipt.logs) {
        try {
          const ev = decodeEventLog({ abi: factoryAbi, data: l.data, topics: l.topics });
          if (ev.eventName === "AlcanciaCreated") addrs.push((ev.args as unknown as { alcancia: Address }).alcancia);
        } catch {}
      }
      try { localStorage.setItem("alcancia:budget", JSON.stringify(budget)); } catch {}
      setCreated(addrs.map((address, row) => ({ address, row })));
      setStep("done");
      confetti({ particleCount: 160, spread: 80, origin: { y: 0.6 } });
      onCreated(addrs);
    } catch (e) {
      setStep("error");
      setErr((e as Error).message.split("\n")[0]);
    }
  }

  return (
    <div className={card}>
      <p className="mb-3 text-gray-700">{note}</p>
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="relative h-36 w-36 shrink-0 rounded-full" style={{ background: `conic-gradient(${stops.join(",")})` }}>
          <div className="absolute inset-6 flex flex-col items-center justify-center rounded-full bg-white text-center">
            <span className="text-2xl font-black">{(plan.totalBps / 100).toFixed(0)}%</span>
            <span className="text-[11px] text-gray-500">{t.ofEachIncome}</span>
          </div>
        </div>
        <div className="w-full space-y-3">
          {plan.rows.map((r, i) => (
            <div key={i}>
              <div className="flex justify-between text-sm">
                <span><span style={{ color: COLORS[i % COLORS.length] }}>●</span> {r.emoji} {r.name}</span>
                <b>{(r.bps / 100).toFixed(1)}%</b>
              </div>
              <input
                type="range" min={0} max={5000} step={50} value={r.bps} className="w-full accent-brand-600"
                onChange={(e) => setBps(plan.rows.map((x, j) => (j === i ? Number(e.target.value) : x.bps)))}
              />
              <p className="text-xs text-gray-500">
                {fmt(r.monthlyHome, budget.home)}{t.perMonth} · {t.goalIn(fmt(r.amount, r.currency), r.months)}
                {r.saveIn !== budget.home ? t.fillsIn(LOCALS[r.saveIn].symbol) : ""}
              </p>
            </div>
          ))}
          <p className="text-sm text-gray-600">{t.spendable} <b>{fmt(libre, budget.home)}</b>{t.perMonth} · {t.fixedCosts} {fmt(plan.fixed, budget.home)}</p>
        </div>
      </div>
      {plan.scaled && <p className="mt-3 rounded-xl bg-amber-50 p-2 text-sm text-amber-800">{t.scaledWarn}</p>}
      {plan.totalBps > 10000 && <p className="mt-3 text-sm text-red-600">{t.over100}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className={btn} disabled={!address || step === "approve" || step === "create" || step === "done" || plan.totalBps > 10000 || plan.totalBps === 0} onClick={create}>
          {step === "approve" ? t.signApprove : step === "create" ? t.creating : step === "done" ? t.createdBtn : t.createBtn}
        </button>
        {tx.map((h) => (
          <a key={h} href={explorer(h)} target="_blank" className="text-xs text-brand-600 underline">{h.slice(0, 10)}…</a>
        ))}
      </div>
      {!address && <p className="mt-2 text-sm text-amber-700">{t.needWallet}</p>}
      {address && chainId !== 42220 && <p className="mt-2 text-sm text-amber-700">{t.needCelo}</p>}
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      {step === "done" && address && (
        <div className="mt-4 rounded-2xl bg-brand-50 p-4 text-sm text-brand-900">
          <p className="text-base font-bold">{t.createdTitle}</p>
          <ul className="mt-2 space-y-1">
            {created.map(({ address: a, row }) => {
              const r = plan.rows[row];
              return (
                <li key={a} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
                  <span>{r?.emoji} {r?.name} · {LOCALS[r?.saveIn ?? budget.home].symbol}</span>
                  <a href={explorer(a)} target="_blank" className="font-mono text-xs text-brand-700 underline">{a.slice(0, 10)}…{a.slice(-6)}</a>
                </li>
              );
            })}
          </ul>
          <p className="mt-3">{t.createdOwner(`${address.slice(0, 6)}…${address.slice(-4)}`)}</p>
          <p className="mt-2 text-brand-800">{t.createdGas}</p>
          <button className={`${btn} mt-3`} onClick={onDone}>{t.goToDashboard}</button>
        </div>
      )}
    </div>
  );
}
