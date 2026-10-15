"use client";
import { useEffect, useState } from "react";
import { useAccount, useConfig, useReadContract, useReadContracts } from "wagmi";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { formatUnits, parseUnits, type Address } from "viem";
import confetti from "canvas-confetti";
import { DATA_SUFFIX, FACTORY, TOKENS, TOKEN_SYMBOL, alcanciaAbi, erc20Abi, explorer, factoryAbi, rampUrl } from "@/lib/config";
import { fmt } from "@/lib/plan";
import { useRates } from "./ToolCards";

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
      token: (r(1) as Address) ?? TOKENS.wARS,
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

export function Dashboard({ onAdd }: { onAdd: () => void }) {
  const { address } = useAccount();
  const { items, refetch } = useAlcancias(address);
  const rates = useRates();
  const wallet = useReadContracts({
    contracts: address
      ? [
          { address: TOKENS.wARS, abi: erc20Abi, functionName: "balanceOf", args: [address] },
          { address: TOKENS.wARS, abi: erc20Abi, functionName: "allowance", args: [address, FACTORY] },
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
    return s + (a.token.toLowerCase() === TOKENS.wBRL.toLowerCase() ? v * (rates?.arsPerBrl ?? 0) : v);
  }, 0);
  const avg = items.length ? items.reduce((s, a) => s + (a.target ? Number((a.balance * 10000n) / a.target) / 100 : 0), 0) / items.length : 0;
  const level = avg >= 75 ? "🏆 Leyenda del ahorro" : avg >= 50 ? "🥇 Ahorrista pro" : avg >= 25 ? "🥈 En racha" : avg > 0 ? "🥉 Arrancando" : "🐣 Recién nacido";

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
            <p className="text-sm opacity-80">Ahorrado en total</p>
            <p className="text-3xl font-black">{fmt(totalSaved)}</p>
            <p className="mt-1 text-sm">{level}</p>
          </div>
          <div className="text-right text-sm">
            <p className="opacity-80">En tu wallet</p>
            <p className="font-bold">{fmt(Number(formatUnits(warsBalance, 18)), "wARS")}</p>
            <p className="text-xs opacity-80">permiso al agente: {fmt(Number(formatUnits(allowance, 18)), "wARS")}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={address ? rampUrl(address) : "#"} target="_blank" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-700">💸 Cargar wARS (Ripio)</a>
          <button onClick={runSync} disabled={sync.loading} className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold">
            {sync.loading ? "🤖 El agente está repartiendo…" : "🔄 Sincronizar"}
          </button>
          <button onClick={onAdd} className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold">＋ Nueva meta</button>
        </div>
      </div>

      {sync.result && <SyncCard r={sync.result} />}
      {sync.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{sync.error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((a) => (
          <AlcanciaCard key={a.address} a={a} arsPerBrl={rates?.arsPerBrl} onRitual={() => setRitual(a)} onChange={refetch} />
        ))}
      </div>
      {ritual && <Ritual a={ritual} onClose={() => { setRitual(null); refetch(); }} />}
    </div>
  );
}

function AlcanciaCard({ a, arsPerBrl, onRitual, onChange }: { a: Info; arsPerBrl?: number; onRitual: () => void; onChange: () => void }) {
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

  async function send(fn: string, args: unknown[] = []) {
    setBusy(true);
    try {
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
        <span className="text-xs text-gray-400">{(a.bps / 100).toFixed(1)}% de cada ingreso</span>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-emerald-100">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-sm">
        <span><b>{fmt(bal, sym as "wARS")}</b> de {fmt(tgt, sym as "wARS")}</span>
        <span className="text-gray-500">{pct.toFixed(0)}%</span>
      </div>
      {sym === "wBRL" && arsPerBrl && <p className="text-xs text-emerald-700">≈ {fmt(bal * arsPerBrl)} · ahorrás en la moneda del viaje 🇧🇷</p>}
      <p className="mt-1 text-xs text-gray-400">
        Hasta {new Date(Number(a.deadline) * 1000).toLocaleDateString("es-AR", { month: "long", year: "numeric" })} ·{" "}
        <a className="underline" href={explorer(a.address)} target="_blank">{a.address.slice(0, 8)}…</a>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {a.unlocked ? (
          <button className={btn} disabled={busy || a.balance === 0n} onClick={() => send("withdraw", [a.balance])}>🎉 Retirar</button>
        ) : pendingAmount > 0n ? (
          canExecute ? (
            <button className={btn} disabled={busy} onClick={() => send("executeEarlyWithdraw")}>Sacar {fmt(Number(formatUnits(pendingAmount, 18)), sym as "wARS")}</button>
          ) : (
            <>
              <span className="self-center text-xs text-gray-500">⏳ Se libera el {new Date(unlockAt).toLocaleString("es-AR")}</span>
              <button className={ghost} onClick={onRitual}>🧩 Acertijo</button>
              <button className={ghost} disabled={busy} onClick={() => send("cancelEarlyWithdraw")}>Me arrepentí 💪</button>
            </>
          )
        ) : (
          <button className={ghost} disabled={a.balance === 0n} onClick={onRitual}>🔨 Romper la alcancía</button>
        )}
      </div>
    </div>
  );
}

function Ritual({ a, onClose }: { a: Info; onClose: () => void }) {
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
        const h = await writeContract(config, { address: a.address, abi: alcanciaAbi, functionName: "requestEarlyWithdraw", args: [parseUnits(String(amount), 18)], dataSuffix: DATA_SUFFIX });
        await waitForTransactionReceipt(config, { hash: h });
      }
      const res = await fetch("/api/unlock", {
        method: "POST",
        body: JSON.stringify({ action: "start", alcancia: a.address, reason, context: `Quiere sacar ${amount} ${sym} de ${bal} ahorrados; meta ${tgt} ${sym}.` }),
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
    const res = await fetch("/api/unlock", { method: "POST", body: JSON.stringify({ action: "answer", alcancia: a.address, token: r.token, answer }) }).then((x) => x.json());
    setBusy(false);
    setMsg(res.comment || res.error || "");
    if (res.correct && res.tx) setStage("approved");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-xl font-black">🔨 Romper “{a.name}”</p>
        {stage === "reflect" && (
          <>
            <label className="mt-4 block text-sm text-gray-600">¿Cuánto querés sacar? ({sym})</label>
            <input type="number" disabled={hasPending} className="mt-1 w-full rounded-xl border px-3 py-2 text-lg font-bold" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            <div className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
              🤔 Es el <b>{share}%</b> de lo que juntaste y te hace retroceder <b>{back}%</b> de tu meta. ¿Lo vale?
            </div>
            <label className="mt-4 block text-sm text-gray-600">Contame por qué lo necesitás</label>
            <textarea className="mt-1 w-full rounded-xl border px-3 py-2" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Sé honesto/a, nadie te juzga… salvo yo 😏" />
            <p className="mt-2 text-xs text-gray-500">Si no resolvés el acertijo, igual podés sacarla en 72 h. Tu plata nunca queda trabada.</p>
            <div className="mt-4 flex gap-2">
              <button className={btn} disabled={busy || reason.trim().length < 5 || amount <= 0 || amount > bal} onClick={start}>{busy ? "…" : hasPending ? "Ir al acertijo" : "Pedir retiro y seguir"}</button>
              <button className={ghost} onClick={onClose}>Mejor no 💪</button>
            </div>
          </>
        )}
        {stage === "riddle" && r && (
          <>
            <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm">{r.reply}</p>
            <p className="mt-4 font-semibold">🧩 {r.question}</p>
            <input className="mt-2 w-full rounded-xl border px-3 py-2" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Tu respuesta" />
            <p className="mt-1 text-xs text-gray-400">Pista: {r.hint}</p>
            <div className="mt-4 flex gap-2">
              <button className={btn} disabled={busy || !answer} onClick={check}>{busy ? "El agente está pensando…" : "Responder"}</button>
              <button className={ghost} onClick={onClose}>Espero las 72 h</button>
            </div>
          </>
        )}
        {stage === "approved" && (
          <>
            <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">✅ ¡Correcto! El agente aprobó tu retiro onchain. Ya podés sacarlo desde la tarjeta.</p>
            <button className={`${btn} mt-4`} onClick={onClose}>Volver</button>
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
  logs: { user: string; income: string; sweepTx?: string; skipped?: string; fx?: { inWars: string; outBrl?: string; legs?: { venue: string; tx: string }[]; depositTx?: string; error?: string }[] }[];
};

function SyncCard({ r }: { r: SyncResult }) {
  const mine = r.logs[0];
  return (
    <div className="rounded-3xl bg-slate-900 p-4 font-mono text-xs text-slate-100">
      <p>🤖 agente · bloque finalizado #{r.head} (SQD vía buy, gratis)</p>
      <p>
        📡 lectura de estado: {r.receipt.via === "chainstack" ? `Chainstack vía buy · pagó ${r.receipt.amount}` : "Forno (fallback)"}
        {r.receipt.tx && <> · <a className="underline" href={explorer(r.receipt.tx)} target="_blank">recibo</a></>}
      </p>
      {!mine && <p>sin alcancías para barrer</p>}
      {mine?.skipped && <p>⏸ {mine.skipped}</p>}
      {mine?.sweepTx && (
        <p>
          ✅ ingreso {fmt(Number(formatUnits(BigInt(mine.income), 18)))} repartido ·{" "}
          <a className="underline" href={explorer(mine.sweepTx)} target="_blank">tx</a>
        </p>
      )}
      {mine?.fx?.map((f, i) => (
        <p key={i}>
          💱 {fmt(Number(formatUnits(BigInt(f.inWars), 18)))} → {f.outBrl ? fmt(Number(formatUnits(BigInt(f.outBrl), 18)), "BRL") : "…"}
          {f.legs?.map((l, j) => (
            <span key={j}> · <a className="underline" href={explorer(l.tx)} target="_blank">{l.venue === "textile" ? "Textile" : "Uniswap"} {j === 0 ? "ARS→USD₮" : "USD₮→BRL"}</a></span>
          ))}
          {f.depositTx && <> · <a className="underline" href={explorer(f.depositTx)} target="_blank">depósito</a></>}
          {f.error && <span className="text-red-300"> · {f.error}</span>}
        </p>
      ))}
    </div>
  );
}
