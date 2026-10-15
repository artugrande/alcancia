"use client";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useConfig } from "wagmi";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { decodeEventLog, parseUnits, type Address } from "viem";
import confetti from "canvas-confetti";
import { DATA_SUFFIX, FACTORY, TOKENS, erc20Abi, explorer, factoryAbi, type Currency } from "@/lib/config";
import { buildPlan, fmt, type Budget, type GoalDraft } from "@/lib/plan";
import type { Rates } from "@/lib/rates";

export function useRates() {
  const [rates, setRates] = useState<Rates | null>(null);
  useEffect(() => {
    fetch("/api/rates").then((r) => r.json()).then(setRates).catch(() => {});
  }, []);
  return rates;
}

const card = "rounded-3xl bg-white p-4 shadow-md ring-1 ring-emerald-100";
const btn = "rounded-full bg-emerald-600 px-5 py-2.5 font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50";

export function GoalCards({ initial, onConfirm }: { initial: GoalDraft[]; onConfirm: (g: GoalDraft[]) => void }) {
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
                <option>ARS</option>
                <option>USD</option>
                <option>BRL</option>
              </select>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-gray-500">
              <input type="month" className="rounded-lg border border-gray-200 px-2 py-1" value={g.deadline} onChange={(e) => set(i, { deadline: e.target.value })} />
              {rates && g.currency !== "ARS" && <span>≈ {fmt(g.amount * (g.currency === "USD" ? rates.arsPerUsd : rates.arsPerBrl))}</span>}
            </div>
            {g.currency === "BRL" && <p className="mt-2 text-xs text-emerald-700">🇧🇷 Se ahorra en wBRL: la moneda en la que vas a gastar.</p>}
            {g.currency === "USD" && <p className="mt-2 text-xs text-amber-700">💵 Se guarda en pesos; ajusto la meta con el tipo de cambio.</p>}
          </div>
        ))}
      </div>
      <button className={btn} disabled={!goals.length} onClick={() => onConfirm(goals)}>Confirmar metas</button>
    </div>
  );
}

export function BudgetForm({ suggested, onConfirm }: { suggested: string[]; onConfirm: (b: Budget) => void }) {
  const [income, setIncome] = useState(1_500_000);
  const [costs, setCosts] = useState(() =>
    (suggested?.length ? suggested : ["Alquiler", "Comida", "Internet", "Gimnasio"]).map((name) => ({ name, amount: 0 })),
  );
  const fixed = costs.reduce((s, c) => s + (c.amount || 0), 0);
  return (
    <div className={card}>
      <label className="text-sm font-semibold text-gray-600">💰 ¿Cuánto te entra por mes? (ARS)</label>
      <input type="number" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-lg font-bold" value={income} onChange={(e) => setIncome(Number(e.target.value))} />
      <p className="mt-4 text-sm font-semibold text-gray-600">🧾 Lo que pagás sí o sí cada mes</p>
      <div className="mt-2 space-y-2">
        {costs.map((c, i) => (
          <div key={i} className="flex gap-2">
            <input className="flex-1 rounded-xl border border-gray-200 px-3 py-2" value={c.name} onChange={(e) => setCosts((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} />
            <input type="number" className="w-36 rounded-xl border border-gray-200 px-3 py-2" value={c.amount || ""} placeholder="0" onChange={(e) => setCosts((x) => x.map((y, j) => (j === i ? { ...y, amount: Number(e.target.value) } : y)))} />
          </div>
        ))}
        <button className="text-sm text-emerald-600" onClick={() => setCosts((x) => [...x, { name: "", amount: 0 }])}>+ agregar gasto</button>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-gray-600">Te quedan libres: <b>{fmt(income - fixed)}</b></span>
        <button className={btn} disabled={income <= 0 || fixed >= income} onClick={() => onConfirm({ income, costs })}>Listo</button>
      </div>
    </div>
  );
}

const COLORS = ["#059669", "#84cc16", "#0d9488", "#f59e0b", "#0ea5e9", "#a3a3a3"];

export function PlanCard({ note, goals, budget, onCreated }: { note: string; goals: GoalDraft[]; budget: Budget; onCreated: (a: Address[]) => void }) {
  const rates = useRates();
  const [bps, setBps] = useState<number[] | undefined>();
  const [step, setStep] = useState<"idle" | "approve" | "create" | "done" | "error">("idle");
  const [err, setErr] = useState("");
  const [tx, setTx] = useState<string[]>([]);
  const { address } = useAccount();
  const config = useConfig();
  const plan = useMemo(() => (rates ? buildPlan(goals, budget, rates, bps) : null), [goals, budget, rates, bps]);
  if (!plan) return <div className={card}>Leyendo el tipo de cambio onchain…</div>;

  const libre = 10000 - plan.totalBps;
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
      const warsBps = plan.rows.reduce((s, r) => s + r.bps, 0);
      // Bounded allowance: ~3 months of savings, never infinite.
      const allowance = parseUnits(String(Math.ceil((budget.income * warsBps * 3) / 10000)), 18);
      setStep("approve");
      const a = await writeContract(config, { address: TOKENS.wARS, abi: erc20Abi, functionName: "approve", args: [FACTORY, allowance], dataSuffix: DATA_SUFFIX });
      setTx((t) => [...t, a]);
      await waitForTransactionReceipt(config, { hash: a });
      setStep("create");
      const h = await writeContract(config, {
        address: FACTORY,
        abi: factoryAbi,
        functionName: "createBatch",
        args: [plan.rows.map((r) => ({ token: r.token, name: `${r.emoji} ${r.name}`, target: r.target, deadline: r.deadlineTs, bps: r.bps }))],
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
            <span className="text-[11px] text-gray-500">de cada ingreso</span>
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
                type="range" min={0} max={5000} step={50} value={r.bps} className="w-full accent-emerald-600"
                onChange={(e) => setBps(plan.rows.map((x, j) => (j === i ? Number(e.target.value) : x.bps)))}
              />
              <p className="text-xs text-gray-500">
                {fmt(r.monthlyArs)}/mes · meta {fmt(r.amount, r.currency)} en {r.months} {r.months === 1 ? "mes" : "meses"}
                {r.token === TOKENS.wBRL ? " · se llena en wBRL" : ""}
              </p>
            </div>
          ))}
          <p className="text-sm text-gray-600">Libre para vos: <b>{(libre / 100).toFixed(1)}%</b> · gastos fijos {fmt(plan.fixed)}</p>
        </div>
      </div>
      {plan.scaled && <p className="mt-3 rounded-xl bg-amber-50 p-2 text-sm text-amber-800">⚠️ Con lo que te queda libre no llegás a todo a tiempo: ajusté proporcionalmente. Podés mover los sliders o correr fechas.</p>}
      {plan.totalBps > 10000 && <p className="mt-3 text-sm text-red-600">La suma no puede pasar del 100%.</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className={btn} disabled={!address || step === "approve" || step === "create" || step === "done" || plan.totalBps > 10000 || plan.totalBps === 0} onClick={create}>
          {step === "approve" ? "1/2 Firmá el permiso…" : step === "create" ? "2/2 Creando alcancías…" : step === "done" ? "¡Listo! 🎉" : "💰 Crear mis alcancías"}
        </button>
        {tx.map((h) => (
          <a key={h} href={explorer(h)} target="_blank" className="text-xs text-emerald-600 underline">{h.slice(0, 10)}…</a>
        ))}
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </div>
  );
}
