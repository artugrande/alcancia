"use client";
import { createContext, useContext, useEffect, useState } from "react";

export type Lang = "es" | "en";

const es = {
  connect: "Conectar",
  howItWorks: "Cómo funciona",
  howItWorksLong: "¿Qué es y cómo funciona? →",
  heroTitle1: "Ahorrá para lo que querés,",
  heroTitle2: "en tu moneda.",
  heroSub: "Un agente que arma tu plan, reparte cada ingreso en alcancías onchain y te frena los impulsos. En tu moneda local, sin pasar por el dólar.",
  heroCta: "Conectá tu wallet para empezar",
  heroFoot: "stablecoins locales de Ripio · FX con Textile · Celo",
  loadingAlcancias: "Buscando tus alcancías…",
  footerAgent: "Agente",
  hello: "¡Hola! 🐷 Soy Alcancía. Vamos a armar tu plan de ahorro en tu moneda, onchain. Para arrancar: ¿cuáles son tus metas este año?",
  placeholder: "Ej: viajar a Florianópolis en enero, un Ironman, cambiar la notebook",
  demoBtn: "⚡ Demo rápida",
  demoMsg: "Quiero viajar a Florianópolis en marzo, hacer un Ironman en noviembre del año que viene y cambiar la notebook en junio",
  thinking: "Pensando…",
  chatError: "Se me cortó la conexión con el modelo. ¿Probamos de nuevo?",
  retry: "Reintentar",
  buildingGoals: "Armando tus metas…",
  buildingBudget: "Preparando tu presupuesto…",
  buildingPlan: "Calculando tu plan…",
  goalsConfirmed: "Metas confirmadas ✅",
  budgetLoaded: "Presupuesto cargado ✅",
  created: "¡Alcancías creadas onchain! 🎉",
  confirmGoals: "Confirmar metas",
  noteUsd: (s: string) => `💵 Se guarda en ${s}, sin dolarizarte; ajusto la meta con el tipo de cambio.`,
  noteBlocked: (f: string, h: string, g: string) => `${f} Todavía no hay mercado onchain ${h}→${g} en Celo: se ahorra en ${h} y se recalcula con el tipo de cambio.`,
  noteFx: (f: string, g: string) => `${f} Se ahorra en ${g}, la moneda en la que vas a gastar. El agente convierte vía Textile.`,
  whichCurrency: "🌎 ¿En qué moneda cobrás?",
  incomeQ: (c: string) => `💰 ¿Cuánto te entra por mes? (${c})`,
  fixedQ: "🧾 Lo que pagás sí o sí cada mes",
  addCost: "+ agregar gasto",
  freeLeft: "Te quedan libres:",
  done: "Listo",
  readingRates: "Leyendo el tipo de cambio onchain…",
  ofEachIncome: "de cada ingreso",
  perMonth: "/mes",
  goalIn: (amt: string, m: number) => `meta ${amt} en ${m} ${m === 1 ? "mes" : "meses"}`,
  fillsIn: (s: string) => ` · se llena en ${s} vía Textile`,
  spendable: "Te queda para gastar:",
  fixedCosts: "gastos fijos",
  scaledWarn: "⚠️ Con lo que te queda libre no llegás a todo a tiempo: ajusté proporcionalmente. Podés mover los sliders o correr fechas.",
  over100: "La suma no puede pasar del 100%.",
  signApprove: "1/2 Firmá el permiso…",
  creating: "2/2 Creando alcancías…",
  createdBtn: "¡Listo! 🎉",
  createBtn: "💰 Crear mis alcancías",
  needWallet: "🔌 Conectá tu wallet (arriba a la derecha) para crear las alcancías.",
  needCelo: "⛓️ Tu wallet está en otra red: cambiala a Celo para crear las alcancías.",
  createdTitle: "🎉 Tus alcancías ya están en Celo",
  createdOwner: (w: string) => `Todas son contratos tuyos y se manejan desde tu wallet ${w}. Nadie más puede sacar la plata: ni el agente ni nosotros.`,
  createdGas: "Para recuperar tu plata firmás una transacción desde esa wallet, así que tiene un costo de gas (en Celo son centavos de dólar). Si la meta no está cumplida, antes vas a pasar por el ritual anti-impulso: reflexión, acertijo o 72 h de espera.",
  goToDashboard: "Ver mis alcancías →",
  // dashboard
  totalSaved: "Ahorrado en total",
  inWallet: "En tu wallet",
  allowance: "permiso al agente:",
  loadWith: (s: string) => `💸 Cargar ${s} con Ripio`,
  syncing: "🤖 El agente está repartiendo…",
  sync: "🔄 Sincronizar",
  newGoal: "＋ Nueva meta",
  ofIncome: "de cada ingreso",
  of: "de",
  until: "Hasta",
  approxSaving: "ahorrás en la moneda en la que vas a gastar",
  withdraw: "🎉 Retirar",
  takeOut: "Sacar",
  unlocksAt: "⏳ Se libera el",
  riddle: "🧩 Acertijo",
  regret: "Me arrepentí 💪",
  breakIt: "🔨 Romper la alcancía",
  contribute: "➕ Aportar",
  contributeHelp: (b: string) => `Aporte voluntario desde tu wallet (tenés ${b}). Son dos firmas: permiso y depósito.`,
  contributeGo: "Aportar",
  contributeFx: (b: string, to: string) => `Aportás desde otra moneda (tenés ${b}). Una sola firma: se lo mandás al agente, lo convierte a ${to} vía Textile y lo deposita.`,
  fxMin: (m: string) => `Para convertir vía Textile el mínimo es ~US$1,5 (${m}).`,
  converting: "🤖 El agente está convirtiendo vía Textile y depositando…",
  refundedMsg: "No se pudo convertir ahora: el agente te devolvió la plata a tu wallet.",
  offramp: "🏦 Ya está en tu wallet. ¿Lo pasás a tu cuenta bancaria? Retirá con Ripio →",
  walletInfo: (w: string) => `🔐 Tus alcancías son contratos tuyos y se manejan desde ${w}. Recuperar la plata es una transacción desde tu wallet (gas de centavos en Celo).`,
  levels: ["🐣 Recién nacido", "🥉 Arrancando", "🥈 En racha", "🥇 Ahorrista pro", "🏆 Leyenda del ahorro"],
  // ritual
  breakTitle: (n: string) => `🔨 Romper “${n}”`,
  howMuch: (s: string) => `¿Cuánto querés sacar? (${s})`,
  reflect: (share: number, back: number) => `🤔 Es el ${share}% de lo que juntaste y te hace retroceder ${back}% de tu meta. ¿Lo vale?`,
  why: "Contame por qué lo necesitás",
  whyPh: "Sé honesto/a, nadie te juzga… salvo yo 😏",
  neverLocked: "Si no resolvés el acertijo, igual podés sacarla en 72 h. Tu plata nunca queda trabada.",
  toRiddle: "Ir al acertijo",
  requestAndGo: "Pedir retiro y seguir",
  betterNot: "Mejor no 💪",
  answerPh: "Tu respuesta",
  hint: "Pista:",
  agentThinking: "El agente está pensando…",
  answer: "Responder",
  wait72: "Espero las 72 h",
  approved: "✅ ¡Correcto! El agente aprobó tu retiro onchain. Ya podés sacarlo desde la tarjeta.",
  back: "Volver",
  // sync card
  syncHead: (b: number) => `🤖 agente · bloque #${b} · ingresos detectados con SQD vía buy (gratis)`,
  syncHeadRpc: (b: number) => `🤖 agente · bloque #${b} · SQD saturado → ingresos leídos del RPC público`,
  syncPaid: (a: string) => `📡 estado leído con Chainstack vía buy · pagó ${a} por x402`,
  syncForno: "📡 estado leído con Forno (fallback)",
  receipt: "recibo",
  noAlcancias: "sin alcancías para repartir",
  swept: (a: string) => `✅ ingreso de ${a} repartido`,
  deposit: "depósito",
  refunded: "devuelto a tu wallet",
  fxRefunded: "no se pudo convertir ahora: la plata volvió a tu wallet",
  fxFailed: "no se pudo convertir ni devolver: quedó en la wallet del agente, avisanos y te la devolvemos",
};

type Dict = typeof es;

const en: Dict = {
  connect: "Connect",
  howItWorks: "How it works",
  howItWorksLong: "What is it and how does it work? →",
  heroTitle1: "Save for what you want,",
  heroTitle2: "in your own currency.",
  heroSub: "An agent that builds your plan, splits every paycheck into onchain piggy banks and stops your impulses. In your local currency, without going through the dollar.",
  heroCta: "Connect your wallet to start",
  heroFoot: "Ripio local stablecoins · FX with Textile · Celo",
  loadingAlcancias: "Looking for your piggy banks…",
  footerAgent: "Agent",
  hello: "Hi! 🐷 I'm Alcancía. Let's build your savings plan in your own currency, onchain. To start: what are your goals this year?",
  placeholder: "e.g. a trip to Florianópolis in January, an Ironman, a new laptop",
  demoBtn: "⚡ Quick demo",
  demoMsg: "I want to travel to Florianópolis in March, do an Ironman next November and get a new laptop in June",
  thinking: "Thinking…",
  chatError: "I lost my connection to the model. Try again?",
  retry: "Retry",
  buildingGoals: "Setting up your goals…",
  buildingBudget: "Preparing your budget…",
  buildingPlan: "Crunching your plan…",
  goalsConfirmed: "Goals confirmed ✅",
  budgetLoaded: "Budget loaded ✅",
  created: "Piggy banks created onchain! 🎉",
  confirmGoals: "Confirm goals",
  noteUsd: (s) => `💵 Saved in ${s}, no dollarization; I adjust the target with the exchange rate.`,
  noteBlocked: (f, h, g) => `${f} There's no onchain ${h}→${g} market on Celo yet: it's saved in ${h} and re-priced with the exchange rate.`,
  noteFx: (f, g) => `${f} Saved in ${g}, the currency you'll spend in. The agent converts through Textile.`,
  whichCurrency: "🌎 Which currency are you paid in?",
  incomeQ: (c) => `💰 How much do you make per month? (${c})`,
  fixedQ: "🧾 What you must pay every month",
  addCost: "+ add expense",
  freeLeft: "Left over:",
  done: "Done",
  readingRates: "Reading exchange rates onchain…",
  ofEachIncome: "of every paycheck",
  perMonth: "/mo",
  goalIn: (amt, m) => `goal ${amt} in ${m} ${m === 1 ? "month" : "months"}`,
  fillsIn: (s) => ` · fills in ${s} via Textile`,
  spendable: "Left to spend:",
  fixedCosts: "fixed costs",
  scaledWarn: "⚠️ With what you have left you can't make everything on time: I scaled it down. Move the sliders or push dates.",
  over100: "The total can't exceed 100%.",
  signApprove: "1/2 Sign the allowance…",
  creating: "2/2 Creating piggy banks…",
  createdBtn: "Done! 🎉",
  createBtn: "💰 Create my piggy banks",
  needWallet: "🔌 Connect your wallet (top right) to create the piggy banks.",
  needCelo: "⛓️ Your wallet is on another network: switch to Celo to create the piggy banks.",
  createdTitle: "🎉 Your piggy banks are live on Celo",
  createdOwner: (w) => `They're all your own contracts, managed from your wallet ${w}. Nobody else can take the money out: not the agent, not us.`,
  createdGas: "To get your money back you sign a transaction from that wallet, so it costs gas (cents on Celo). If the goal isn't met yet, you'll first go through the anti-impulse ritual: reflection, a riddle or a 72 h wait.",
  goToDashboard: "See my piggy banks →",
  totalSaved: "Total saved",
  inWallet: "In your wallet",
  allowance: "agent allowance:",
  loadWith: (s) => `💸 Top up ${s} with Ripio`,
  syncing: "🤖 The agent is splitting…",
  sync: "🔄 Sync",
  newGoal: "＋ New goal",
  ofIncome: "of every paycheck",
  of: "of",
  until: "Until",
  approxSaving: "saving in the currency you'll spend in",
  withdraw: "🎉 Withdraw",
  takeOut: "Take out",
  unlocksAt: "⏳ Unlocks on",
  riddle: "🧩 Riddle",
  regret: "Changed my mind 💪",
  breakIt: "🔨 Break the piggy bank",
  contribute: "➕ Add money",
  contributeHelp: (b) => `Voluntary top-up from your wallet (you have ${b}). Two signatures: allowance and deposit.`,
  contributeGo: "Add",
  contributeFx: (b, to) => `Top up from another currency (you have ${b}). One signature: you send it to the agent, it converts to ${to} via Textile and deposits.`,
  fxMin: (m) => `Converting via Textile needs at least ~US$1.5 (${m}).`,
  converting: "🤖 The agent is converting via Textile and depositing…",
  refundedMsg: "Couldn't convert right now: the agent returned the money to your wallet.",
  offramp: "🏦 It's in your wallet. Send it to your bank account? Cash out with Ripio →",
  walletInfo: (w) => `🔐 Your piggy banks are your own contracts, managed from ${w}. Getting money back is a transaction from your wallet (gas is cents on Celo).`,
  levels: ["🐣 Newborn", "🥉 Getting started", "🥈 On a streak", "🥇 Pro saver", "🏆 Savings legend"],
  breakTitle: (n) => `🔨 Break “${n}”`,
  howMuch: (s) => `How much do you want to take out? (${s})`,
  reflect: (share, back) => `🤔 That's ${share}% of what you've saved and sets your goal back ${back}%. Worth it?`,
  why: "Tell me why you need it",
  whyPh: "Be honest, nobody's judging… except me 😏",
  neverLocked: "If you don't solve the riddle, you can still take it out in 72 h. Your money is never stuck.",
  toRiddle: "Go to the riddle",
  requestAndGo: "Request withdrawal and continue",
  betterNot: "Better not 💪",
  answerPh: "Your answer",
  hint: "Hint:",
  agentThinking: "The agent is thinking…",
  answer: "Answer",
  wait72: "I'll wait 72 h",
  approved: "✅ Correct! The agent approved your withdrawal onchain. You can take it out from the card.",
  back: "Back",
  syncHead: (b) => `🤖 agent · block #${b} · income detected with SQD via buy (free)`,
  syncHeadRpc: (b) => `🤖 agent · block #${b} · SQD busy → income read from the public RPC`,
  syncPaid: (a) => `📡 state read with Chainstack via buy · paid ${a} over x402`,
  syncForno: "📡 state read with Forno (fallback)",
  receipt: "receipt",
  noAlcancias: "no piggy banks to split into",
  swept: (a) => `✅ income of ${a} split`,
  deposit: "deposit",
  refunded: "returned to your wallet",
  fxRefunded: "couldn't convert right now: the money went back to your wallet",
  fxFailed: "couldn't convert or refund: it's held in the agent wallet, let us know and we'll return it",
};

const DICTS: Record<Lang, Dict> = { es, en };

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: Dict }>({ lang: "es", setLang: () => {}, t: es });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("alcancia:lang") as Lang | null;
      const fromUrl = new URLSearchParams(location.search).get("lang") as Lang | null;
      const l = fromUrl === "en" || fromUrl === "es" ? fromUrl : saved;
      if (l === "en" || l === "es") {
        document.documentElement.lang = l;
        setLangState(l);
      }
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = (l: Lang) => {
    document.documentElement.lang = l;
    setLangState(l);
    try { localStorage.setItem("alcancia:lang", l); } catch {}
  };
  return <Ctx.Provider value={{ lang, setLang, t: DICTS[lang] }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex rounded-full bg-white p-0.5 text-xs font-semibold shadow-sm ring-1 ring-brand-100">
      {(["es", "en"] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} className={`rounded-full px-2.5 py-1 ${lang === l ? "bg-brand-600 text-white" : "text-brand-800"}`}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** Demo preset: realistic numbers so a live demo needs no typing. */
export const DEMO_BUDGET = {
  ARS: { income: 3_000_000, costs: [800_000, 500_000, 35_000, 60_000] },
};
export const demoCosts = (lang: Lang) =>
  lang === "en" ? ["Rent", "Food", "Internet", "Gym"] : ["Alquiler", "Comida", "Internet", "Gimnasio"];
