import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, encodeDeployData, http, type Abi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { codeFromRepo, toDataSuffix } from "@celo/attribution-tags";

const code = process.env.NEXT_PUBLIC_ATTRIBUTION_CODE || codeFromRepo("artugrande/alcancia");
const suffix = toDataSuffix(code);
const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as Hex);
const wallet = createWalletClient({ account, chain: celo, transport: http("https://forno.celo.org") });
const pub = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });
const art = (n: string) => JSON.parse(readFileSync(`contracts/out/${n}.sol/${n}.json`, "utf8")) as { abi: Abi; bytecode: { object: Hex } };

async function deploy(name: string, args: unknown[] = []) {
  const a = art(name);
  // ERC-8021 suffix after the constructor args: abi.decode ignores trailing bytes.
  const data = (encodeDeployData({ abi: a.abi, bytecode: a.bytecode.object, args }) + suffix.slice(2)) as Hex;
  const hash = await wallet.sendTransaction({ data });
  const r = await pub.waitForTransactionReceipt({ hash });
  console.log(name, r.contractAddress, "block", r.blockNumber, "tx", hash);
  return r;
}

const impl = await deploy("Alcancia");
const fac = await deploy("AlcanciaFactory", [impl.contractAddress, account.address]);
console.log(`\nNEXT_PUBLIC_FACTORY_ADDRESS=${fac.contractAddress}\nNEXT_PUBLIC_FACTORY_DEPLOY_BLOCK=${fac.blockNumber}\nIMPLEMENTATION=${impl.contractAddress}\nATTRIBUTION_CODE=${code}`);
