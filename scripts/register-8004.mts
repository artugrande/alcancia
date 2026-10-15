import { createPublicClient, createWalletClient, http, parseAbi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { codeFromRepo, withAttribution } from "@celo/attribution-tags";

const REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const URI = "https://alcancia-celo.vercel.app/agent.json";
const code = [process.env.NEXT_PUBLIC_ATTRIBUTION_CODE || "celo_cbcc681c15b7", codeFromRepo("artugrande/alcancia")];
const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as Hex);
const wallet = createWalletClient({ account, chain: celo, transport: http("https://forno.celo.org") }).extend(withAttribution(code));
const pub = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });

const hash = await wallet.writeContract({ address: REGISTRY, abi: parseAbi(["function register(string agentURI) returns (uint256)"]), functionName: "register", args: [URI] });
const r = await pub.waitForTransactionReceipt({ hash });
const t = r.logs.find((l) => l.address.toLowerCase() === REGISTRY.toLowerCase() && l.topics.length === 4);
console.log("agentId", BigInt(t!.topics[3]!).toString(), "tx", hash);
