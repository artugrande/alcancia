import { parseUnits, type Address } from "viem";
import { TOKENS, type Currency } from "./config";
import type { Rates } from "./rates";

export type GoalDraft = {
  name: string;
  emoji: string;
  amount: number;
  currency: Currency;
  deadline: string; // YYYY-MM
  isTrip: boolean;
};

export type Budget = { income: number; costs: { name: string; amount: number }[] };

export type PlanRow = GoalDraft & {
  targetArs: number;
  months: number;
  monthlyArs: number;
  bps: number;
  token: Address;
  target: bigint;
  deadlineTs: bigint;
};

export type Plan = {
  rows: PlanRow[];
  free: number;
  freePct: number;
  totalBps: number;
  scaled: boolean;
  fixed: number;
};

export function deadlineTs(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  return BigInt(Math.floor(Date.UTC(y, m, 0, 23, 59, 59) / 1000)); // last day of month
}

function monthsUntil(yyyymm: string) {
  const ms = Number(deadlineTs(yyyymm)) * 1000 - Date.now();
  return Math.max(1, Math.round(ms / (30.44 * 86400_000)));
}

export const toArs = (amount: number, c: Currency, r: Rates) =>
  c === "ARS" ? amount : c === "USD" ? amount * r.arsPerUsd : amount * r.arsPerBrl;

export function buildPlan(goals: GoalDraft[], budget: Budget, rates: Rates, overrides?: number[]): Plan {
  const fixed = budget.costs.reduce((s, c) => s + (c.amount || 0), 0);
  const free = Math.max(0, budget.income - fixed);
  const freePct = budget.income > 0 ? free / budget.income : 0;
  let rows = goals.map((g, i) => {
    const targetArs = toArs(g.amount, g.currency, rates);
    const months = monthsUntil(g.deadline);
    const monthlyArs = targetArs / months;
    const pct = budget.income > 0 ? monthlyArs / budget.income : 0;
    const bps = overrides?.[i] ?? Math.round(pct * 10000);
    const brl = g.currency === "BRL";
    return {
      ...g,
      targetArs,
      months,
      monthlyArs,
      bps,
      token: (brl ? TOKENS.wBRL : TOKENS.wARS) as Address,
      target: parseUnits((brl ? g.amount : targetArs).toFixed(2), 18),
      deadlineTs: deadlineTs(g.deadline),
    };
  });
  let total = rows.reduce((s, r) => s + r.bps, 0);
  const cap = Math.floor(freePct * 10000);
  let scaled = false;
  if (!overrides && total > cap) {
    const f = cap / total;
    rows = rows.map((r) => ({ ...r, bps: Math.floor(r.bps * f) }));
    total = rows.reduce((s, r) => s + r.bps, 0);
    scaled = true;
  }
  return { rows, free, freePct, totalBps: total, scaled, fixed };
}

export const fmt = (n: number, c: Currency | "wARS" | "wBRL" = "ARS") =>
  new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n) +
  " " + (c === "wARS" ? "ARS" : c === "wBRL" ? "BRL" : c);
