# 💰 Alcancía

**A savings agent for Latin America, in your own currency, onchain on Celo.**

You tell the agent your goals for the year, your income and your fixed costs. It builds a plan, creates one onchain piggy bank (*alcancía*) per goal, and from then on **splits every paycheck automatically**. If a goal is a trip, it saves in **the currency you'll spend in**, converting through Textile. When you want to break a piggy bank early, it makes you stop and think first.

> 🇪🇸 Un agente de ahorro para Latinoamérica: armás tu plan conversando, cada meta es una alcancía onchain (un contrato tuyo), el agente reparte cada ingreso solo, ahorra en la moneda en la que vas a gastar (vía Textile) y te frena los impulsos antes de romper el chanchito.

**Live:** https://alcancia-celo.vercel.app · ES / EN (`?lang=en`) · ⚡ one-click demo

Built for **Agents on Open Rails** (Celo) · Track 1: Stable Agents LatAm (Ripio × Celo Core Co.)

---

## What it does

| | |
|---|---|
| 🗣️ **Conversational plan** | Generative chat UI (AI SDK + Vercel AI Gateway). Goals → editable cards (amount, currency, date) → income and fixed costs → plan with sliders. |
| 🏦 **One contract per goal** | Each alcancía is its own contract (EIP-1167 clone) owned by your wallet. Funds can **only** go back to you. |
| 🤖 **Automatic split** | The agent detects every incoming payment in your income currency and sweeps each goal's share into its alcancía. |
| 💱 **Save in the currency you'll spend in** | "Florianópolis in March" fills in **wBRL**, "Cartagena" in **wCOP**. The agent converts each share via **Textile** RFQ (local → USD₮ → local). If a leg fails, it refunds you. |
| 🧩 **Anti-impulse ritual** | Breaking a goal early: you see how far it sets you back, you write why, and the agent replies (with humor) and asks a riddle about your goal. Solve it and the agent approves the withdrawal onchain; otherwise there's a **72 h** onchain delay. Your money is never locked. |
| ➕ **Top-ups from any currency** | Add money in the alcancía's currency (2 signatures) or from **another local stablecoin** you hold (1 signature: the agent converts via Textile and deposits). |
| 🌎 **All six Ripio wFiat** | wARS 🇦🇷 wBRL 🇧🇷 wMXN 🇲🇽 wCOP 🇨🇴 wPEN 🇵🇪 wCLP 🇨🇱 as income and savings currencies. Ripio Ramp on/off-ramp for AR, BR, MX, CO. |
| 🔌 **Pays for its own infra** | Reads chain state through **buy** (usebuy.ai): **SQD** (free) to detect income, **Chainstack** Celo RPC (US$0.01 per batch, x402) for state. Receipts are shown in the app. |

### What's live on Celo today (checked live)

| | Ripio Ramp | Textile FX on Celo |
|---|---|---|
| wARS | ✅ | ✅ buy & sell |
| wBRL | ✅ | ✅ buy & sell |
| wCOP | ✅ | ✅ buy & sell |
| wMXN | ✅ | sell ✅ · buy: no makers at the time of writing |
| wPEN | — | no corridor |
| wCLP | — | no corridor |

Goals in a currency without a corridor are saved in your income currency and re-priced with the exchange rate; the UI says so.

---

## Architecture

```
Next.js on Vercel ─────────────────────────────────────────────────────────
  UI: chat (useChat) + generative components · RainbowKit/wagmi (MiniPay ok)
  /api/chat        streamText via Vercel AI Gateway (Claude)
  /api/sweep       agent cycle · Vercel Cron every 15 min + "Sync" button
  /api/contribute  cross-currency top-ups
  /api/unlock      riddle (sealed answer) → agentApprove()
  /api/rates       Textile tickers + RFQ previews (+ reference for PEN/CLP)
        │ agent wallet (viem + ERC-8021 attribution on every tx)
        ▼
Celo mainnet ──────────────────────────────────────────────────────────────
  AlcanciaFactory  users, income currency, bps per goal, sweep cursor
   └─ Alcancia     one clone per goal, owner = user
  Ripio wFiat · Textile LimitOrderReactor (Uniswap v3 fallback for wARS/wBRL)
  ERC-8004 Identity Registry (agent #9911)

buy gateway (usebuy.ai) ───────────────────────────────────────────────────
  SQD /stream (free)         incoming Transfer logs, agent tx history
  Chainstack /celo (x402)    one paid JSON-RPC batch per cycle
```

### Agent cycle (`src/lib/agent.ts`)

1. **SQD** (free): read the factory's `AlcanciaCreated` events and every user's incoming transfers in their income currency since their onchain cursor (sequencer head minus 3 blocks; Celo L1 finality takes ~30 min, too slow for a live product).
2. **Chainstack via buy** (US$0.01, x402 in USDC): **one** batch with each user's income token, cursor, paused flag, total bps, and balance + allowance of all six wFiat.
3. `sweep(user, incomeToken, income, toBlock)`: same-currency shares go straight to the alcancías; shares of goals in other currencies go to the agent.
4. For each foreign-currency goal: Textile RFQ `local → USD₮` and `USD₮ → local` (Uniswap v3 fallback where pools exist), then `deposit`. On failure: refund.

No database: state lives onchain (goals, balances, bps, sweep cursor). Idempotency for top-ups uses the source tx hash in the agent's deposit calldata.

---

## Contracts (Celo mainnet, verified on Blockscout)

| | Address |
|---|---|
| AlcanciaFactory | [`0xbbab1b684212fc4cde02eafc69bba993934e2218`](https://celo.blockscout.com/address/0xbbab1b684212fc4cde02eafc69bba993934e2218) |
| Alcancia (implementation) | [`0x290c3c5404f34bcb8f06520a8be31fc65bd786d4`](https://celo.blockscout.com/address/0x290c3c5404f34bcb8f06520a8be31fc65bd786d4) |
| Agent wallet | [`0xD8c9558DB1404976fB11A1fC64f3E122309B3055`](https://celo.blockscout.com/address/0xD8c9558DB1404976fB11A1fC64f3E122309B3055) |
| ERC-8004 identity | [#9911](https://8004scan.io/agents/celo/9911) · card at [`/agent.json`](https://alcancia-celo.vercel.app/agent.json) |

**Invariants** (`contracts/src`, 27 Foundry tests incl. fuzz):

- Funds in an alcancía can only ever leave to its owner. The agent can never move them anywhere.
- Free withdrawal once the target or the deadline is reached.
- Early withdrawal: 72 h delay, or `agentApprove()` after the riddle. The agent can shorten the wait, never extend it.
- Lowering a target or pulling a deadline in also waits 72 h (otherwise it would be the back door).
- `setAgent(0)` disconnects the agent; alcancías keep working on their own.
- The sum of a user's bps is ≤ 100%. Sweeps only move the user's declared income token, and never past `block.number`.

---

## Hackathon compliance

| Rule | How |
|---|---|
| Celo mainnet (42220) | Contracts and every transaction on mainnet. |
| ERC-8021 attribution on **every** tx | `@celo/attribution-tags`: `withAttribution([...])` on the agent's wallet client and `dataSuffix` on every frontend write. Codes: `celo_cbcc681c15b7` (assigned at enrollment) + `celo_595aac690f07` (repo-derived), in one suffix. Contract deployments are tagged too (suffix after the constructor args). |
| ERC-8004 identity | Agent #9911, registered from the agent wallet. |
| Public repo | This one. |
| Who pays gas | Users pay their own (approve, create, withdraw, top-ups). The agent pays its own (sweep, FX, approvals). No relayer. The buy gateway sponsors gas for x402 settlements. |
| Custody note | During FX (sweep shares and cross-currency top-ups), funds sit in the agent wallet for the seconds between Textile legs. If a leg fails, the agent refunds the user. |
| "Without going through the dollar" | Users never hold dollars. There is no direct local↔local market on Celo yet, so USD₮ is a technical bridge between two Textile legs. USD-priced goals are saved in local currency. |

---

## Run it

```bash
npm install
cp .env.example .env.local   # fill AGENT_PRIVATE_KEY, NEXT_PUBLIC_* and AI Gateway auth
npm run dev
```

- AI Gateway auth: `AI_GATEWAY_API_KEY`, or `vercel env pull` (OIDC token) on a linked project.
- Contracts: `cd contracts && forge test`.
- Deploy: `npx tsx scripts/deploy.mts`. ERC-8004: `scripts/register-8004.mts`.

## Roadmap

- **Yield:** there is no onchain wFiat yield on Celo today (the only real wARS yield is a Morpho vault on Ethereum, ~24% APY). A wARS/wBRL lending market on Celo would plug straight into each alcancía.
- More Textile corridors (wMXN buy, wPEN, wCLP) as makers come online.
- A guardian friend who approves early withdrawals, weekly summary by email/push, MiniPay listing.

Stack: Next.js · AI SDK + Vercel AI Gateway · wagmi/viem/RainbowKit · Foundry · Textile · Ripio · buy (SQD, Chainstack) · ERC-8004 · ERC-8021.
