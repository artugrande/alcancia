// Records a real end-to-end demo of Alcancía on Celo mainnet with a demo wallet.
// The browser gets an injected EIP-1193 provider whose signer lives here in Node (the
// demo key never reaches the page). Markers with timestamps are written to out/markers.json
// so the recording can be cut into clips.
import { config } from "dotenv";
import { createDecipheriv, createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readdirSync, renameSync } from "node:fs";
import { chromium, type Page } from "playwright-core";
import { createPublicClient, createWalletClient, http, parseUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

config({ path: "../.env.demo" });
config({ path: "../.env.local" });

const APP = process.env.APP_URL ?? "http://localhost:3077";
const WARS = "0x0dc4f92879b7670e5f4e4e6e3c801d229129d90d";
const SALARY = process.env.SALARY ?? "20000";

const user = privateKeyToAccount(process.env.DEMO_USER_KEY as Hex);
const employer = privateKeyToAccount(process.env.DEMO_EMPLOYER_KEY as Hex);
const transport = http("https://forno.celo.org");
const pub = createPublicClient({ chain: celo, transport });
const userWallet = createWalletClient({ account: user, chain: celo, transport });
const employerWallet = createWalletClient({ account: employer, chain: celo, transport });

const t0 = Date.now();
const markers: { name: string; t: number }[] = [];
const mark = (name: string) => {
  const t = (Date.now() - t0) / 1000;
  markers.push({ name, t });
  console.log(`[${t.toFixed(1)}s] ${name}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- injected wallet --------------------------------------------------------
let connected = false;
async function handle({ method, params }: { method: string; params?: unknown[] }) {
  if (process.env.DEBUG_WALLET) console.log("   wallet:", method);
  switch (method) {
    case "eth_requestAccounts":
      connected = true;
      return [user.address];
    case "eth_accounts":
      return connected ? [user.address] : [];
    case "eth_chainId":
      return "0xa4ec";
    case "net_version":
      return "42220";
    case "wallet_switchEthereumChain":
    case "wallet_addEthereumChain":
    case "wallet_requestPermissions":
      return null;
    case "wallet_getPermissions":
      return [{ parentCapability: "eth_accounts" }];
    case "eth_sendTransaction": {
      const tx = (params?.[0] ?? {}) as { to: Hex; data?: Hex; value?: Hex; gas?: Hex };
      const hash = await userWallet.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value ? BigInt(tx.value) : 0n,
      });
      console.log("   tx", hash);
      return hash;
    }
    case "personal_sign":
      return user.signMessage({ message: { raw: params?.[0] as Hex } });
    case "eth_signTypedData_v4": {
      const data = JSON.parse(params?.[1] as string);
      delete data.types.EIP712Domain;
      return user.signTypedData(data);
    }
    default:
      if (method.startsWith("wallet_")) throw Object.assign(new Error("unsupported"), { code: 4200 });
      return pub.request({ method: method as never, params: params as never });
  }
}

// Plain JS string on purpose: tsx/esbuild would wrap a TS function with helpers (__name)
// that don't exist inside the page.
const injected = `
(() => {
  const provider = {
    isMetaMask: true,
    request: (args) => window.__wallet(args).then((res) => {
      if (!res.ok) { const e = new Error(res.error && res.error.message); e.code = (res.error && res.error.code) || -32000; throw e; }
      return res.value;
    }),
    on: () => provider,
    removeListener: () => provider,
  };
  window.ethereum = provider;
  const hideDev = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(st); };
  if (document.head) hideDev(); else document.addEventListener("DOMContentLoaded", hideDev);
  const info = { uuid: "a1c0-demo", name: "Demo Wallet", icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E", rdns: "app.alcancia.demo" };
  const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }));
  window.addEventListener("eip6963:requestProvider", announce);
  announce();
})();
`;

// The unlock riddle answer travels sealed with a key derived from the agent key.
function openRiddle(token: string): { answer: string } {
  const key = createHash("sha256").update(`${process.env.AGENT_PRIVATE_KEY}:riddle`).digest();
  const b = Buffer.from(token, "base64url");
  const d = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString());
}

async function slowType(page: Page, selector: string, text: string) {
  await page.click(selector);
  await page.keyboard.type(text, { delay: 45 });
}

let currentPage: Page | undefined;
async function main() {
  mkdirSync("out", { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: process.env.HEADED ? false : true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    deviceScaleFactor: 1,
    recordVideo: { dir: "out/raw", size: { width: 1440, height: 900 } },
  });
  await context.exposeBinding("__wallet", async (_src, args) => {
    try {
      return { ok: true, value: await handle(args as { method: string; params?: unknown[] }) };
    } catch (e) {
      const err = e as { message: string; code?: number };
      return { ok: false, error: { message: err.message, code: err.code } };
    }
  });
  await context.addInitScript({ content: injected });
  const page = await context.newPage();
  currentPage = page;
  let riddleToken = "";
  page.on("response", async (r) => {
    if (r.url().endsWith("/api/unlock") && r.request().method() === "POST") {
      try {
        const j = await r.json();
        if (j.token) riddleToken = j.token;
      } catch {}
    }
  });

  mark("start");
  await page.goto(`${APP}/?lang=en`);
  await page.waitForSelector("text=Save for what you want");
  await sleep(2500);

  // Connect
  mark("connect");
  await page.getByRole("button", { name: /Connect your wallet to start/ }).click();
  await sleep(1200);
  await page.screenshot({ path: "out/modal.png" });
  const opt = page.getByText(/Demo Wallet|Browser Wallet|Injected|MetaMask/).first();
  await opt.click();
  await page.waitForSelector("text=what are your goals", { timeout: 30_000 });
  await sleep(1500);

  // Chat
  mark("01-chat");
  await page.getByRole("button", { name: /Quick demo/ }).click();
  await page.getByRole("button", { name: "Confirm goals" }).waitFor({ timeout: 90_000 });
  await sleep(3500);
  await page.getByRole("button", { name: "Confirm goals" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).waitFor({ timeout: 90_000 });
  await sleep(3500);
  await page.getByRole("button", { name: "Done", exact: true }).click();

  mark("02-plan");
  const create = page.getByRole("button", { name: /Create my piggy banks/ });
  await create.waitFor({ timeout: 90_000 });
  await create.scrollIntoViewIfNeeded();
  await sleep(5000);

  if (process.env.STOP_AT === "plan") {
    mark("end");
    await context.close();
    await browser.close();
    writeFileSync("out/markers.json", JSON.stringify(markers, null, 2));
    return;
  }

  // Create
  mark("03-create");
  await create.click();
  await page.waitForSelector("text=Your piggy banks are live", { timeout: 180_000 });
  await page.getByText("Your piggy banks are live").scrollIntoViewIfNeeded();
  await sleep(6000);
  await page.getByRole("button", { name: /See my piggy banks/ }).click();
  await page.waitForSelector("text=Total saved", { timeout: 60_000 });
  await sleep(3000);

  // Payday: the employer pays the salary in wARS
  mark("04-income");
  const pay = await employerWallet.writeContract({
    address: WARS,
    abi: [{ type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] }],
    functionName: "transfer",
    args: [user.address, parseUnits(SALARY, 18)],
  });
  console.log("   salary", pay);
  await pub.waitForTransactionReceipt({ hash: pay });
  mark("salary-landed");
  await page.reload();
  await page.waitForSelector("text=Total saved", { timeout: 60_000 });
  await sleep(3000);
  // Give SQD a few blocks to index the salary
  await sleep(8000);
  mark("sync-click");
  await page.getByRole("button", { name: /Sync/ }).click();
  await page.waitForSelector("text=/income of .* split/", { timeout: 300_000 });
  mark("sync-done");
  await page.waitForTimeout(2000);
  await page.locator(".font-mono").first().scrollIntoViewIfNeeded();
  await sleep(7000);
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: "smooth" }));
  await sleep(4000);

  // Try to break a piggy bank (first wARS one with balance)
  mark("05-break");
  await page.locator('button:has-text("Break the piggy bank"):not([disabled])').first().click();
  await sleep(2500);
  await slowType(page, "textarea", "Sneakers on sale, 50% off!! I NEED them 👟");
  await sleep(1200);
  await page.getByRole("button", { name: /Request withdrawal and continue/ }).click();
  await page.getByPlaceholder("Your answer").waitFor({ timeout: 180_000 });
  await sleep(6000);
  const { answer } = openRiddle(riddleToken);
  console.log("   riddle answer:", answer);
  await slowType(page, "input[placeholder='Your answer']", answer);
  await sleep(800);
  await page.getByRole("button", { name: "Answer", exact: true }).click();
  await page.waitForSelector("text=/Correct!/", { timeout: 180_000 });
  mark("approved");
  await sleep(5000);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await sleep(2500);
  const takeOut = page.getByRole("button", { name: /Take out/ }).first();
  await takeOut.scrollIntoViewIfNeeded();
  await sleep(1500);
  await takeOut.click();
  await page.waitForSelector("text=/Send it to your bank/", { timeout: 120_000 });
  await page.getByText(/Send it to your bank/).scrollIntoViewIfNeeded();
  mark("withdrawn");
  await sleep(5000);
  mark("end");

  await context.close();
  await browser.close();
  const raw = readdirSync("out/raw").find((f) => f.endsWith(".webm"));
  if (raw) renameSync(`out/raw/${raw}`, "out/demo.webm");
  writeFileSync("out/markers.json", JSON.stringify(markers, null, 2));
  console.log("done → out/demo.webm + out/markers.json");
}

main().catch(async (e) => {
  await currentPage?.screenshot({ path: "out/fail.png" }).catch(() => {});
  writeFileSync("out/markers.json", JSON.stringify(markers, null, 2));
  console.error(e);
  process.exit(1);
});
