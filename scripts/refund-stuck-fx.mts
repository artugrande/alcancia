// One-off: return USD₮ left in the agent wallet by the stale-balance FX bug (fixed in 2543f17).
import { createPublicClient, createWalletClient, http, parseAbi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { codeFromRepo, withAttribution } from "@celo/attribution-tags";

const USDT = "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e";
const REFUNDS = [
  { to: "0xF17270964c05AA8C0393d2fc33bCAbB60af196cE", amount: 786462n }, // FxPulled 1264.8 wARS @ block 80268285
  { to: "0x19ec1797000f434eb2fd622e642bef80234425cb", amount: 1053993n }, // FxPulled 1704.28 wARS @ block 80268418
] as const;

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as Hex);
const codes = [process.env.NEXT_PUBLIC_ATTRIBUTION_CODE || "celo_cbcc681c15b7", codeFromRepo("artugrande/alcancia")];
const wallet = createWalletClient({ account, chain: celo, transport: http("https://forno.celo.org") }).extend(withAttribution(codes));
const pub = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });
const abi = parseAbi(["function transfer(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"]);

const bal = await pub.readContract({ address: USDT, abi, functionName: "balanceOf", args: [account.address] });
const total = REFUNDS.reduce((s, r) => s + r.amount, 0n);
if (bal < total) throw new Error(`agent has ${bal}, needs ${total}`);
for (const r of REFUNDS) {
  const hash = await wallet.writeContract({ address: USDT, abi, functionName: "transfer", args: [r.to, r.amount] });
  const rc = await pub.waitForTransactionReceipt({ hash });
  console.log(r.to, Number(r.amount) / 1e6, "USDT", rc.status, hash);
}
