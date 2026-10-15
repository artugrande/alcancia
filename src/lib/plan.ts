import { parseUnits, type Address } from "viem";
import { LOCALS, canConvert, type Currency, type Local } from "./config";
import { convert, type Rates } from "./rates";

export type GoalDraft = {
  name: string;
  emoji: string;
  amount: number;
  currency: Currency;
  deadline: string; // YYYY-MM
  isTrip: boolean;
};

/** Income and fixed costs, both in the user's home (income) currency. */
export type Budget = { home: Local; income: number; costs: { name: string; amount: number }[] };

export type PlanRow = GoalDraft & {
  /** Currency the alcancía holds: the goal's own local currency when the agent can convert into it, else home. */
  saveIn: Local;
  fxBlocked: boolean;
  targetHome: number;
  months: number;
  monthlyHome: number;
  bps: number;
  token: Address;
  target: bigint;
  deadlineTs: bigint;
};

export type Plan = { rows: PlanRow[]; free: number; freePct: number; totalBps: number; scaled: boolean; fixed: number };

export function deadlineTs(yyyymm: string) {
  const [year, m] = yyyymm.split("-").map(Number);
  let y = year;
  const now = new Date();
  // A month that already passed means next year's.
  while (Date.UTC(y, m, 0, 23, 59, 59) <= now.getTime()) y += 1;
  return BigInt(Math.floor(Date.UTC(y, m, 0, 23, 59, 59) / 1000)); // last day of month
}

function monthsUntil(yyyymm: string) {
  const ms = Number(deadlineTs(yyyymm)) * 1000 - Date.now();
  return Math.max(1, Math.round(ms / (30.44 * 86400_000)));
}

export function saveCurrency(goal: Currency, home: Local): { saveIn: Local; fxBlocked: boolean } {
  if (goal === "USD" || goal === home) return { saveIn: home, fxBlocked: false };
  if (canConvert(home, goal)) return { saveIn: goal, fxBlocked: false };
  return { saveIn: home, fxBlocked: true };
}

export function buildPlan(goals: GoalDraft[], budget: Budget, rates: Rates, overrides?: number[]): Plan {
  const home = budget.home;
  const fixed = budget.costs.reduce((s, c) => s + (c.amount || 0), 0);
  const free = Math.max(0, budget.income - fixed);
  const freePct = budget.income > 0 ? free / budget.income : 0;
  let rows: PlanRow[] = goals.map((g, i) => {
    const { saveIn, fxBlocked } = saveCurrency(g.currency, home);
    const targetHome = convert(g.amount, g.currency, home, rates);
    const months = monthsUntil(g.deadline);
    const monthlyHome = targetHome / months;
    const pct = budget.income > 0 ? monthlyHome / budget.income : 0;
    const targetSave = convert(g.amount, g.currency, saveIn, rates);
    return {
      ...g,
      saveIn,
      fxBlocked,
      targetHome,
      months,
      monthlyHome,
      bps: overrides?.[i] ?? Math.round(pct * 10000),
      token: LOCALS[saveIn].token,
      target: parseUnits(targetSave.toFixed(2), 18),
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

export const fmt = (n: number, c: string = "ARS") =>
  new Intl.NumberFormat("es-AR", { maximumFractionDigits: n < 100 ? 2 : 0 }).format(n) + " " + c.replace(/^w/, "");
