"use client";
import Link from "next/link";
import { LangToggle, useI18n, type Lang } from "@/lib/i18n";

const FACTORY = "0xbbab1b684212fc4cde02eafc69bba993934e2218";
const AGENT = "0xD8c9558DB1404976fB11A1fC64f3E122309B3055";

type Copy = {
  back: string;
  tag: string;
  title: string;
  lead: string;
  ctaApp: string;
  ctaRepo: string;
  tldrTitle: string;
  tldr: [string, string][];
  problemTitle: string;
  problems: { icon: string; title: string; body: string }[];
  howTitle: string;
  howLead: string;
  steps: { icon: string; title: string; body: string }[];
  exampleTitle: string;
  exampleLead: string;
  exampleRows: { name: string; pct: number; detail: string; color: string }[];
  exampleFree: string;
  exampleNote: string;
  brakeTitle: string;
  brakeLead: string;
  brake: { n: string; title: string; body: string }[];
  brakeFoot: string;
  tracksTitle: string;
  tracksLead: string;
  tracks: { badge: string; title: string; who: string; body: string; proof: string }[];
  rulesTitle: string;
  rules: [string, string][];
  archTitle: string;
  archLead: string;
  layers: { title: string; color: string; items: string[] }[];
  cycleTitle: string;
  cycle: string[];
  buildTitle: string;
  build: [string, string][];
  safetyTitle: string;
  safety: string[];
  marketTitle: string;
  marketHead: [string, string, string];
  market: [string, string, string][];
  marketNote: string;
  linksTitle: string;
};

const ES: Copy = {
  back: "← Volver a la app",
  tag: "Agents on Open Rails · Celo",
  title: "Alcancía: un agente que te ayuda a ahorrar en tu moneda",
  lead: "Le contás tus metas, arma tu plan y crea una alcancía onchain por cada meta. Después reparte solo cada ingreso que te entra, ahorra en la moneda en la que vas a gastar y te frena cuando querés romper el chanchito por impulso.",
  ctaApp: "Probar la app",
  ctaRepo: "Ver el código",
  tldrTitle: "En 30 segundos",
  tldr: [
    ["🗣️", "Conversás con el agente: metas, ingreso y gastos fijos."],
    ["🐷", "Cada meta es una alcancía: un contrato tuyo en Celo."],
    ["🤖", "Cada vez que te pagan, el agente aparta el % de cada meta."],
    ["💱", "¿Viajás a Brasil? Esa alcancía se llena en reales (vía Textile)."],
    ["🧩", "¿Querés sacar antes? Primero reflexión, un acertijo o 72 h de espera."],
  ],
  problemTitle: "El problema",
  problems: [
    { icon: "💸", title: "La plata que queda, se gasta", body: "Ahorrar depende de la fuerza de voluntad. El impulso de las 2 de la mañana le gana a la meta de julio." },
    { icon: "🌎", title: "Ahorrás en una moneda, gastás en otra", body: "Si tu viaje es a Brasil, ahorrar en pesos te expone al tipo de cambio. La salida típica es dolarizarse: otra cuenta, otro paso, otro costo." },
    { icon: "🧮", title: "Nadie hace la cuenta", body: "¿Cuánto tengo que apartar por mes para llegar? Con varias metas, fechas y monedas, casi nadie lo calcula." },
  ],
  howTitle: "Cómo funciona",
  howLead: "Todo pasa en un chat. El agente responde con tarjetas y formularios, no con párrafos.",
  steps: [
    { icon: "🔌", title: "Conectás tu wallet", body: "La app detecta en qué stablecoin local tenés plata (wARS, wBRL, wMXN, wCOP, wPEN o wCLP)." },
    { icon: "🎯", title: "Contás tus metas", body: "\"Floripa en marzo, un Ironman, una notebook\". El agente arma una tarjeta por meta con monto, moneda y fecha, y vos las ajustás." },
    { icon: "🧾", title: "Ingreso y gastos fijos", body: "Cuánto cobrás y qué pagás sí o sí. Así sabe cuánto te queda libre." },
    { icon: "📊", title: "El plan", body: "Te propone qué % de cada ingreso va a cada meta, sin comerse todo lo libre. Lo movés con sliders." },
    { icon: "🐷", title: "Se crean tus alcancías", body: "Dos firmas y listo: una alcancía por meta, cada una con su propia dirección en Celo." },
    { icon: "🔁", title: "Ahorro en piloto automático", body: "Cada vez que te entra plata, el agente reparte el % de cada meta. Y podés aportar a mano cuando quieras, incluso desde otra moneda." },
  ],
  exampleTitle: "Un ejemplo con números",
  exampleLead: "Sofía cobra ARS 3.000.000 por mes y paga ARS 1.395.000 de gastos fijos. El plan de su próximo sueldo:",
  exampleRows: [
    { name: "🏖️ Viaje a Florianópolis", pct: 14.8, detail: "se llena en wBRL: el agente convierte vía Textile", color: "#5f50fb" },
    { name: "🏊 Ironman", pct: 9.6, detail: "meta en USD, se guarda en pesos (sin dolarizarse)", color: "#f59e0b" },
    { name: "💻 Notebook nueva", pct: 8.1, detail: "en pesos, para junio", color: "#8f7dfc" },
  ],
  exampleFree: "le quedan ARS 630.900 por mes para vivir",
  exampleNote: "Cuando le entra el sueldo, el agente aparta 32,5% automáticamente: tres depósitos, uno en reales.",
  brakeTitle: "El freno anti-impulso",
  brakeLead: "Si la meta no está cumplida y querés romper la alcancía, no es un botón. Es un pequeño ritual:",
  brake: [
    { n: "1", title: "Reflexión con números", body: "\"Es el 40% de lo que juntaste y te hace retroceder 25% de tu meta. ¿Lo vale?\"" },
    { n: "2", title: "Contame por qué", body: "Escribís la razón. El agente te contesta con humor si suena a impulso." },
    { n: "3", title: "Un acertijo sobre tu meta", body: "\"¿Cuántos km se nadan en un Ironman?\" Si acertás, el agente aprueba el retiro onchain." },
    { n: "4", title: "O esperás 72 horas", body: "Si no querés jugar, el contrato te deja sacarla igual a las 72 h. La mayoría de los impulsos no sobreviven tres días." },
  ],
  brakeFoot: "Tu plata nunca queda trabada: el contrato garantiza que siempre podés retirarla. El agente solo puede acortar la espera, nunca alargarla.",
  tracksTitle: "Cómo usa cada track de la hackathon",
  tracksLead: "Alcancía es un producto para el Track 1, pero se apoya en los rieles de los otros tracks.",
  tracks: [
    { badge: "Track 1", title: "Stable Agents: LatAm · Ripio × Celo", who: "El corazón del producto", body: "Todo el ahorro vive en las stablecoins locales de Ripio (wARS, wBRL, wMXN, wCOP, wPEN, wCLP), sin pasar por el dólar. Ripio Ramp para cargar y para retirar al banco en Argentina, Brasil, México y Colombia. El agente es autónomo: detecta ingresos, reparte, convierte y aprueba retiros.", proof: "Contratos y transacciones en Celo mainnet con wFiat reales." },
    { badge: "Track 2A", title: "Open Corridors · Textile FX", who: "La moneda en la que vas a gastar", body: "Cuando una meta es en otra moneda local, el agente pide cotizaciones (RFQ) a Textile y ejecuta dos patas: local → USD₮ → local. También en los aportes desde otra moneda. No es una estrategia de trading: es volumen real de FX que nace de usuarios ahorrando.", proof: "Swaps firmados por la wallet del agente contra el reactor de Textile." },
    { badge: "Track 3", title: "Build with buy · usebuy.ai", who: "El agente paga su propia infraestructura", body: "Para leer la cadena, el agente compra servicios que no son suyos: SQD (gratis) para detectar cada ingreso, y una llamada paga a Chainstack (US$0,01 por x402) que trae en un solo lote todo lo que necesita para decidir. La app muestra el recibo.", proof: "Pagos x402 liquidados en Celo, uno por ciclo (no spam)." },
    { badge: "x402", title: "Pagos HTTP nativos", who: "Cómo paga el agente", body: "Los pagos a buy usan x402 en USDC sobre Celo; el gateway paga el gas. No aplicamos al Track 2B porque ese track pide liquidar USA₮ entre usuarios independientes, y acá el usuario ahorra en su moneda local.", proof: "Recibo de cada pago con link al explorer." },
  ],
  rulesTitle: "Reglas obligatorias",
  rules: [
    ["Celo mainnet", "Todo corre en la chain 42220."],
    ["ERC-8021 (attribution)", "Cada transacción, del usuario y del agente, lleva el código asignado (celo_cbcc681c15b7) en el calldata. Incluso los deploys."],
    ["ERC-8004 (identidad)", "El agente está registrado desde su propia wallet: agente #9911."],
    ["Repo público", "Todo el código, los contratos y los tests están en GitHub."],
    ["Gas", "Cada uno paga el suyo: el usuario sus firmas, el agente las suyas. Sin relayer."],
  ],
  archTitle: "Cómo está construido",
  archLead: "Cuatro capas. La plata vive en contratos; el agente decide; la app conversa; los servicios externos hacen lo que no es nuestro.",
  layers: [
    { title: "👤 Vos", color: "bg-white", items: ["Tu wallet (MetaMask, Rabby, Valora, MiniPay)", "Firmás crear, retirar y aportar"] },
    { title: "💬 La app", color: "bg-brand-50", items: ["Next.js en Vercel", "Chat con componentes (AI SDK)", "Claude vía Vercel AI Gateway", "Español e inglés"] },
    { title: "🤖 El agente", color: "bg-brand-100", items: ["Wallet propia + identidad ERC-8004", "Ciclo cada 15 min (Vercel Cron)", "Reparto, FX, aprobación de retiros", "Sin base de datos: el estado está onchain"] },
    { title: "⛓️ Celo mainnet", color: "bg-brand-200", items: ["AlcanciaFactory: usuarios, moneda, % por meta", "Alcancia: un contrato por meta, dueño = vos", "wFiat de Ripio · reactor de Textile"] },
  ],
  cycleTitle: "Un ciclo del agente, paso a paso",
  cycle: [
    "Mira en SQD (vía buy, gratis) qué alcancías existen y qué transferencias te entraron desde la última vez.",
    "Hace una sola llamada paga a Chainstack (vía buy, US$0,01 por x402) y trae tu moneda de ingreso, saldos, permisos y el cursor de cada usuario.",
    "Llama a sweep(): el contrato reparte el % de cada meta. Lo que va en otra moneda pasa por el agente.",
    "Para esas metas, pide cotización a Textile y convierte en dos patas (local → USD₮ → local). Si Textile no cotiza, prueba Uniswap.",
    "Deposita en la alcancía. Si algo falla, te devuelve la plata. Cada transacción lleva el attribution tag.",
  ],
  buildTitle: "Piezas técnicas",
  build: [
    ["Contratos", "Solidity + Foundry. Clones EIP-1167 (barato: una alcancía por meta). 27 tests, incluido fuzzing. Verificados en Blockscout."],
    ["Chat generativo", "AI SDK: el modelo llama herramientas (metas, presupuesto, plan) que la UI dibuja como tarjetas editables. Los números del plan se calculan en código, no los inventa el modelo."],
    ["Tipos de cambio", "En vivo desde Textile (ARS, BRL, COP, MXN) y una fuente de referencia para PEN y CLP."],
    ["Acertijo", "Lo genera el modelo; la respuesta viaja cifrada (AES-GCM) para que nadie la lea en el navegador."],
    ["Aportes desde otra moneda", "Una firma: mandás al agente, verifica la transferencia onchain, convierte y deposita. El hash de tu transacción queda marcado en el depósito para que nunca se procese dos veces."],
  ],
  safetyTitle: "Garantías",
  safety: [
    "La plata de una alcancía solo puede volver a su dueño. El agente no puede moverla a ningún otro lado.",
    "Retiro libre cuando llegás a la meta o a la fecha.",
    "Bajar una meta también tarda 72 h (si no, sería la puerta trasera).",
    "Podés desconectar al agente cuando quieras y tus alcancías siguen funcionando.",
    "El permiso que le das al agente es acotado (≈3 meses de ahorro), nunca infinito.",
  ],
  marketTitle: "Qué hay hoy en Celo",
  marketHead: ["Moneda", "Ripio Ramp", "Textile FX"],
  market: [
    ["🇦🇷 wARS", "✅", "✅ compra y venta"],
    ["🇧🇷 wBRL", "✅", "✅ compra y venta"],
    ["🇨🇴 wCOP", "✅", "✅ compra y venta"],
    ["🇲🇽 wMXN", "✅", "venta ✅ · compra: sin makers por ahora"],
    ["🇵🇪 wPEN", "—", "sin corredor"],
    ["🇨🇱 wCLP", "—", "sin corredor"],
  ],
  marketNote: "Si una meta es en una moneda sin mercado, se ahorra en tu moneda y se recalcula con el tipo de cambio. La app te lo avisa. Rendimiento: hoy no hay dónde poner stablecoins locales a rendir en Celo; está en el roadmap.",
  linksTitle: "Links",
};

const EN: Copy = {
  back: "← Back to the app",
  tag: "Agents on Open Rails · Celo",
  title: "Alcancía: an agent that helps you save in your own currency",
  lead: "You tell it your goals, it builds your plan and creates one onchain piggy bank per goal. Then it splits every paycheck automatically, saves in the currency you'll spend in, and stops you when you want to break the piggy bank on impulse.",
  ctaApp: "Try the app",
  ctaRepo: "See the code",
  tldrTitle: "In 30 seconds",
  tldr: [
    ["🗣️", "You chat with the agent: goals, income and fixed costs."],
    ["🐷", "Each goal is a piggy bank: a contract you own on Celo."],
    ["🤖", "Every time you get paid, the agent sets aside each goal's %."],
    ["💱", "Traveling to Brazil? That piggy bank fills in reais (via Textile)."],
    ["🧩", "Want to take money out early? First a reflection, a riddle or a 72 h wait."],
  ],
  problemTitle: "The problem",
  problems: [
    { icon: "💸", title: "Money left in the account gets spent", body: "Saving depends on willpower. The 2 a.m. impulse beats the July goal." },
    { icon: "🌎", title: "You save in one currency, spend in another", body: "If your trip is to Brazil, saving in pesos exposes you to the exchange rate. The usual answer is dollarizing: another account, another step, another cost." },
    { icon: "🧮", title: "Nobody does the math", body: "How much do I need to set aside each month? With several goals, dates and currencies, almost nobody calculates it." },
  ],
  howTitle: "How it works",
  howLead: "Everything happens in a chat. The agent answers with cards and forms, not paragraphs.",
  steps: [
    { icon: "🔌", title: "Connect your wallet", body: "The app detects which local stablecoin you hold (wARS, wBRL, wMXN, wCOP, wPEN or wCLP)." },
    { icon: "🎯", title: "Tell it your goals", body: "\"Floripa in March, an Ironman, a laptop\". The agent creates one card per goal with amount, currency and date, and you tweak them." },
    { icon: "🧾", title: "Income and fixed costs", body: "What you earn and what you must pay. That's how it knows what's left." },
    { icon: "📊", title: "The plan", body: "It proposes what % of each paycheck goes to each goal, without eating everything that's left. Adjust with sliders." },
    { icon: "🐷", title: "Your piggy banks are created", body: "Two signatures: one piggy bank per goal, each with its own address on Celo." },
    { icon: "🔁", title: "Savings on autopilot", body: "Every time money comes in, the agent splits each goal's %. You can also top up by hand, even from another currency." },
  ],
  exampleTitle: "An example with numbers",
  exampleLead: "Sofía earns ARS 3,000,000 a month and pays ARS 1,395,000 in fixed costs. The plan for her next paycheck:",
  exampleRows: [
    { name: "🏖️ Trip to Florianópolis", pct: 14.8, detail: "fills in wBRL: the agent converts via Textile", color: "#5f50fb" },
    { name: "🏊 Ironman", pct: 9.6, detail: "priced in USD, saved in pesos (no dollarization)", color: "#f59e0b" },
    { name: "💻 New laptop", pct: 8.1, detail: "in pesos, for June", color: "#8f7dfc" },
  ],
  exampleFree: "she keeps ARS 630,900 a month to live on",
  exampleNote: "When her salary lands, the agent sets aside 32.5% automatically: three deposits, one of them in reais.",
  brakeTitle: "The anti-impulse brake",
  brakeLead: "If the goal isn't met and you want to break the piggy bank, it's not a button. It's a small ritual:",
  brake: [
    { n: "1", title: "Reflection with numbers", body: "\"That's 40% of what you saved and sets your goal back 25%. Worth it?\"" },
    { n: "2", title: "Tell me why", body: "You write the reason. The agent replies with humor if it sounds like an impulse." },
    { n: "3", title: "A riddle about your goal", body: "\"How many km do you swim in an Ironman?\" Get it right and the agent approves the withdrawal onchain." },
    { n: "4", title: "Or wait 72 hours", body: "Don't want to play? The contract lets you take it out after 72 h anyway. Most impulses don't survive three days." },
  ],
  brakeFoot: "Your money is never stuck: the contract guarantees you can always withdraw. The agent can only shorten the wait, never extend it.",
  tracksTitle: "How it uses each hackathon track",
  tracksLead: "Alcancía is a Track 1 product, built on the rails of the other tracks.",
  tracks: [
    { badge: "Track 1", title: "Stable Agents: LatAm · Ripio × Celo", who: "The heart of the product", body: "All savings live in Ripio's local stablecoins (wARS, wBRL, wMXN, wCOP, wPEN, wCLP), without going through the dollar. Ripio Ramp to top up and cash out to a bank in Argentina, Brazil, Mexico and Colombia. The agent is autonomous: it detects income, splits, converts and approves withdrawals.", proof: "Contracts and transactions on Celo mainnet with real wFiat." },
    { badge: "Track 2A", title: "Open Corridors · Textile FX", who: "The currency you'll spend in", body: "When a goal is in another local currency, the agent requests quotes (RFQ) from Textile and executes two legs: local → USD₮ → local. Also for top-ups from another currency. It's not a trading strategy: it's real FX volume coming from people saving.", proof: "Swaps signed by the agent wallet against Textile's reactor." },
    { badge: "Track 3", title: "Build with buy · usebuy.ai", who: "The agent pays for its own infrastructure", body: "To read the chain, the agent buys services it doesn't own: SQD (free) to detect each paycheck, and one paid Chainstack call (US$0.01 over x402) that fetches everything it needs to decide in a single batch. The app shows the receipt.", proof: "x402 payments settled on Celo, one per cycle (no spam)." },
    { badge: "x402", title: "HTTP-native payments", who: "How the agent pays", body: "Payments to buy use x402 in USDC on Celo; the gateway pays the gas. We didn't enter Track 2B: it asks for USA₮ settlement between independent users, and here people save in their local currency.", proof: "Receipt for each payment with an explorer link." },
  ],
  rulesTitle: "Mandatory rules",
  rules: [
    ["Celo mainnet", "Everything runs on chain 42220."],
    ["ERC-8021 (attribution)", "Every transaction, from users and from the agent, carries the assigned code (celo_cbcc681c15b7) in its calldata. Deployments too."],
    ["ERC-8004 (identity)", "The agent is registered from its own wallet: agent #9911."],
    ["Public repo", "All code, contracts and tests are on GitHub."],
    ["Gas", "Everyone pays their own: users for their signatures, the agent for its own. No relayer."],
  ],
  archTitle: "How it's built",
  archLead: "Four layers. Money lives in contracts; the agent decides; the app talks; external services do what isn't ours.",
  layers: [
    { title: "👤 You", color: "bg-white", items: ["Your wallet (MetaMask, Rabby, Valora, MiniPay)", "You sign create, withdraw and top up"] },
    { title: "💬 The app", color: "bg-brand-50", items: ["Next.js on Vercel", "Chat with components (AI SDK)", "Claude via Vercel AI Gateway", "Spanish and English"] },
    { title: "🤖 The agent", color: "bg-brand-100", items: ["Own wallet + ERC-8004 identity", "Cycle every 15 min (Vercel Cron)", "Split, FX, withdrawal approvals", "No database: state is onchain"] },
    { title: "⛓️ Celo mainnet", color: "bg-brand-200", items: ["AlcanciaFactory: users, currency, % per goal", "Alcancia: one contract per goal, owner = you", "Ripio wFiat · Textile reactor"] },
  ],
  cycleTitle: "One agent cycle, step by step",
  cycle: [
    "Checks SQD (via buy, free) for existing piggy banks and transfers you received since last time.",
    "Makes a single paid Chainstack call (via buy, US$0.01 over x402) to fetch each user's income currency, balances, allowances and cursor.",
    "Calls sweep(): the contract splits each goal's %. Shares in another currency go through the agent.",
    "For those goals, it asks Textile for a quote and converts in two legs (local → USD₮ → local). If Textile doesn't quote, it tries Uniswap.",
    "Deposits into the piggy bank. If anything fails, it refunds you. Every transaction carries the attribution tag.",
  ],
  buildTitle: "Technical pieces",
  build: [
    ["Contracts", "Solidity + Foundry. EIP-1167 clones (cheap: one piggy bank per goal). 27 tests including fuzzing. Verified on Blockscout."],
    ["Generative chat", "AI SDK: the model calls tools (goals, budget, plan) that the UI renders as editable cards. Plan numbers are computed in code, not made up by the model."],
    ["Exchange rates", "Live from Textile (ARS, BRL, COP, MXN) and a reference source for PEN and CLP."],
    ["Riddle", "Generated by the model; the answer travels encrypted (AES-GCM) so nobody can read it in the browser."],
    ["Top-ups from another currency", "One signature: you send to the agent, it verifies the transfer onchain, converts and deposits. Your tx hash is marked in the deposit so it can never be processed twice."],
  ],
  safetyTitle: "Guarantees",
  safety: [
    "Money in a piggy bank can only go back to its owner. The agent can't move it anywhere else.",
    "Free withdrawal once you reach the target or the date.",
    "Lowering a target also takes 72 h (otherwise it would be the back door).",
    "You can disconnect the agent anytime and your piggy banks keep working.",
    "The allowance you give the agent is bounded (≈3 months of savings), never infinite.",
  ],
  marketTitle: "What's live on Celo today",
  marketHead: ["Currency", "Ripio Ramp", "Textile FX"],
  market: [
    ["🇦🇷 wARS", "✅", "✅ buy & sell"],
    ["🇧🇷 wBRL", "✅", "✅ buy & sell"],
    ["🇨🇴 wCOP", "✅", "✅ buy & sell"],
    ["🇲🇽 wMXN", "✅", "sell ✅ · buy: no makers yet"],
    ["🇵🇪 wPEN", "—", "no corridor"],
    ["🇨🇱 wCLP", "—", "no corridor"],
  ],
  marketNote: "If a goal is in a currency with no market, it's saved in your currency and re-priced with the exchange rate. The app tells you. Yield: there's nowhere to earn yield on local stablecoins on Celo yet; it's on the roadmap.",
  linksTitle: "Links",
};

const COPY: Record<Lang, Copy> = { es: ES, en: EN };

function Section({ id, title, lead, children }: { id?: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-16">
      <h2 className="text-2xl font-black text-brand-950 sm:text-3xl">{title}</h2>
      {lead && <p className="mt-2 max-w-2xl text-gray-600">{lead}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

const card = "rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-100";

export default function HowItWorks() {
  const { lang } = useI18n();
  const c = COPY[lang];
  const total = c.exampleRows.reduce((s, r) => s + r.pct, 0);

  return (
    <main className="mx-auto max-w-5xl px-4 pb-20 pt-4">
      <header className="flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 text-xl font-black text-brand-950">
          <img src="/logo.png" alt="" className="h-8 w-auto" /> Alcancía
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/" className="hidden text-sm font-semibold text-brand-700 hover:underline sm:block">{c.back}</Link>
          <LangToggle />
        </div>
      </header>

      {/* Hero */}
      <section className="mt-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-600 to-brand-900 px-6 py-10 text-white sm:px-10">
        <div className="flex flex-col-reverse items-center gap-6 lg:flex-row lg:gap-8">
          <div className="flex-1">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-200">{c.tag}</p>
            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">{c.title}</h1>
            <p className="mt-4 max-w-xl text-brand-100">{c.lead}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/" className="rounded-full bg-amber-400 px-5 py-2.5 font-bold text-brand-950 shadow hover:bg-amber-300">{c.ctaApp}</Link>
              <a href="https://github.com/artugrande/alcancia" target="_blank" className="rounded-full bg-white/15 px-5 py-2.5 font-semibold hover:bg-white/25">{c.ctaRepo}</a>
            </div>
          </div>
          <img src="/logo.png" alt="Alcancía" className="w-40 drop-shadow-2xl sm:w-52 lg:w-72" />
        </div>
      </section>

      {/* TL;DR */}
      <Section title={c.tldrTitle}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {c.tldr.map(([icon, text], i) => (
            <div key={i} className={`${card} text-center`}>
              <div className="text-3xl">{icon}</div>
              <p className="mt-2 text-sm text-gray-700">{text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Problem */}
      <Section title={c.problemTitle}>
        <div className="grid gap-4 sm:grid-cols-3">
          {c.problems.map((p) => (
            <div key={p.title} className={card}>
              <div className="text-4xl">{p.icon}</div>
              <p className="mt-3 text-lg font-bold text-brand-950">{p.title}</p>
              <p className="mt-1 text-gray-600">{p.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* How */}
      <Section title={c.howTitle} lead={c.howLead}>
        <ol className="grid gap-4 sm:grid-cols-3">
          {c.steps.map((s, i) => (
            <li key={s.title} className={`${card} relative`}>
              <span className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
              <div className="text-3xl">{s.icon}</div>
              <p className="mt-3 font-bold text-brand-950">{s.title}</p>
              <p className="mt-1 text-sm text-gray-600">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Example */}
      <Section title={c.exampleTitle} lead={c.exampleLead}>
        <div className={card}>
          <div className="flex h-8 overflow-hidden rounded-full bg-gray-100">
            {c.exampleRows.map((r) => (
              <div key={r.name} style={{ width: `${r.pct}%`, background: r.color }} title={r.name} />
            ))}
            <div className="flex flex-1 items-center justify-end pr-3 text-xs font-semibold text-gray-500">{(100 - total).toFixed(1)}%</div>
          </div>
          <ul className="mt-5 space-y-3">
            {c.exampleRows.map((r) => (
              <li key={r.name} className="flex items-start gap-3">
                <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: r.color }} />
                <div className="flex-1">
                  <div className="flex justify-between font-semibold text-brand-950"><span>{r.name}</span><span>{r.pct}%</span></div>
                  <p className="text-sm text-gray-500">{r.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">✨ {c.exampleFree}. {c.exampleNote}</p>
        </div>
      </Section>

      {/* Brake */}
      <Section title={c.brakeTitle} lead={c.brakeLead}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.brake.map((b) => (
            <div key={b.n} className={card}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 font-black text-brand-950">{b.n}</span>
              <p className="mt-3 font-bold text-brand-950">{b.title}</p>
              <p className="mt-1 text-sm text-gray-600">{b.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-2xl bg-brand-50 p-4 text-sm font-medium text-brand-900">🔐 {c.brakeFoot}</p>
      </Section>

      {/* Tracks */}
      <Section title={c.tracksTitle} lead={c.tracksLead}>
        <div className="grid gap-4 sm:grid-cols-2">
          {c.tracks.map((t) => (
            <div key={t.badge} className={card}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white">{t.badge}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t.who}</span>
              </div>
              <p className="mt-3 text-lg font-bold text-brand-950">{t.title}</p>
              <p className="mt-2 text-sm text-gray-600">{t.body}</p>
              <p className="mt-3 text-xs font-semibold text-amber-700">✓ {t.proof}</p>
            </div>
          ))}
        </div>
        <div className={`${card} mt-4`}>
          <p className="font-bold text-brand-950">{c.rulesTitle}</p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {c.rules.map(([k, v]) => (
              <div key={k}>
                <dt className="text-sm font-semibold text-brand-800">{k}</dt>
                <dd className="text-sm text-gray-600">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      {/* Architecture */}
      <Section title={c.archTitle} lead={c.archLead}>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <div className="space-y-2">
            {c.layers.map((l, i) => (
              <div key={l.title}>
                <div className={`rounded-3xl ${l.color} p-4 ring-1 ring-brand-200`}>
                  <p className="font-bold text-brand-950">{l.title}</p>
                  <ul className="mt-1 text-sm text-gray-700">
                    {l.items.map((it) => <li key={it}>· {it}</li>)}
                  </ul>
                </div>
                {i < c.layers.length - 1 && <div className="mx-auto h-4 w-0.5 bg-brand-300" />}
              </div>
            ))}
          </div>
          <div className="hidden text-3xl text-brand-300 lg:block">⇄</div>
          <div className="space-y-3">
            <p className="text-sm font-bold uppercase tracking-wide text-brand-700">{lang === "en" ? "External services the agent uses" : "Servicios externos que usa el agente"}</p>
            {[
              ["🧠", "Vercel AI Gateway", lang === "en" ? "Claude for the chat and the riddle" : "Claude para el chat y el acertijo"],
              ["🏦", "Ripio Ramp", lang === "en" ? "top up and cash out to your bank" : "cargar y retirar a tu banco"],
              ["💱", "Textile FX", lang === "en" ? "RFQ quotes, local → USD₮ → local" : "cotizaciones RFQ, local → USD₮ → local"],
              ["🔎", "SQD · buy", lang === "en" ? "free: detect income and history" : "gratis: detectar ingresos e historial"],
              ["📡", "Chainstack · buy", lang === "en" ? "US$0.01 per cycle over x402" : "US$0,01 por ciclo con x402"],
              ["🪪", "ERC-8004", lang === "en" ? "agent identity #9911" : "identidad del agente #9911"],
            ].map(([icon, name, what]) => (
              <div key={name} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-brand-100">
                <span className="text-2xl">{icon}</span>
                <div>
                  <p className="font-semibold text-brand-950">{name}</p>
                  <p className="text-xs text-gray-500">{what}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} mt-6`}>
          <p className="font-bold text-brand-950">{c.cycleTitle}</p>
          <ol className="mt-4 space-y-3">
            {c.cycle.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">{i + 1}</span>
                <p className="text-sm text-gray-700">{s}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className={card}>
            <p className="font-bold text-brand-950">{c.buildTitle}</p>
            <dl className="mt-3 space-y-3">
              {c.build.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-sm font-semibold text-brand-800">{k}</dt>
                  <dd className="text-sm text-gray-600">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className={card}>
            <p className="font-bold text-brand-950">{c.safetyTitle}</p>
            <ul className="mt-3 space-y-2">
              {c.safety.map((s) => (
                <li key={s} className="flex gap-2 text-sm text-gray-700"><span>🔒</span><span>{s}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Market */}
      <Section title={c.marketTitle}>
        <div className={`${card} overflow-x-auto p-0`}>
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-50 text-brand-900">
              <tr>{c.marketHead.map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {c.market.map((row) => (
                <tr key={row[0]} className="border-t border-brand-50">
                  {row.map((cell, j) => <td key={j} className="px-4 py-3 text-gray-700">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-gray-600">{c.marketNote}</p>
      </Section>

      {/* Links */}
      <Section title={c.linksTitle}>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["App", "https://alcancia-celo.vercel.app", "alcancia-celo.vercel.app"],
            ["GitHub", "https://github.com/artugrande/alcancia", "artugrande/alcancia"],
            ["AlcanciaFactory", `https://celo.blockscout.com/address/${FACTORY}`, `${FACTORY.slice(0, 10)}…`],
            [lang === "en" ? "Agent wallet" : "Wallet del agente", `https://celo.blockscout.com/address/${AGENT}`, `${AGENT.slice(0, 10)}…`],
            ["ERC-8004", "https://8004scan.io/agents/celo/9911", "#9911"],
            ["Agent card", "/agent.json", "agent.json"],
          ].map(([k, href, label]) => (
            <a key={k} href={href} target="_blank" className="flex items-center justify-between rounded-2xl bg-white p-4 ring-1 ring-brand-100 hover:ring-brand-400">
              <span className="font-semibold text-brand-950">{k}</span>
              <span className="font-mono text-xs text-brand-700">{label} ↗</span>
            </a>
          ))}
        </div>
      </Section>

      <footer className="mt-16 flex flex-col items-center gap-2 text-center text-xs text-gray-400">
        <img src="/logo.png" alt="" className="h-10 w-auto opacity-80" />
        Alcancía · built for Agents on Open Rails · Celo
      </footer>
    </main>
  );
}
