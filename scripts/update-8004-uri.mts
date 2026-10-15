import { createPublicClient, createWalletClient, http, parseAbi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { codeFromRepo, verifyTx, withAttribution } from "@celo/attribution-tags";

const REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const code = [process.env.NEXT_PUBLIC_ATTRIBUTION_CODE || "celo_cbcc681c15b7", codeFromRepo("artugrande/alcancia")];
const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as Hex);
const wallet = createWalletClient({ account, chain: celo, transport: http("https://forno.celo.org") }).extend(withAttribution(code));
const pub = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });
const hash = await wallet.writeContract({ address: REGISTRY, abi: parseAbi(["function setAgentURI(uint256 agentId, string newURI)"]), functionName: "setAgentURI", args: [9911n, "https://alcancia-celo.vercel.app/agent.json"] });
await pub.waitForTransactionReceipt({ hash });
console.log("setAgentURI", hash, await verifyTx({ client: pub, hash }));
