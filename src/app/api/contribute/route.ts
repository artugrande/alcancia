import { decodeEventLog, parseAbiItem, type Address, type Hex } from "viem";
import { account, agentWallet, contributionProcessed, convertAndDeposit } from "@/lib/agent";
import { FACTORY, LOCALS, LOCAL_CODES, alcanciaAbi, factoryAbi } from "@/lib/config";
import { forno, readRates } from "@/lib/rates";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const inFlight = new Set<string>();

// A user sent wFiat X to the agent to top up an alcancía held in wFiat Y.
// The agent verifies the transfer onchain, converts X → USD₮ → Y on Textile and deposits.
export async function POST(req: Request) {
  const { tx, alcancia } = (await req.json()) as { tx: Hex; alcancia: Address };
  if (!/^0x[0-9a-fA-F]{64}$/.test(tx ?? "")) return Response.json({ error: "tx inválida" }, { status: 400 });
  if (inFlight.has(tx)) return Response.json({ error: "ya se está procesando" }, { status: 409 });
  inFlight.add(tx);
  try {
    const receipt = await forno.waitForTransactionReceipt({ hash: tx, timeout: 60_000 });
    if (receipt.status !== "success") return Response.json({ error: "la transferencia falló" }, { status: 400 });
    const head = await forno.getBlockNumber();
    if (head - receipt.blockNumber > 1800n) return Response.json({ error: "transferencia demasiado vieja" }, { status: 400 });

    const tokens = LOCAL_CODES.map((c) => LOCALS[c].token.toLowerCase());
    let found: { token: Address; from: Address; amount: bigint } | undefined;
    for (const l of receipt.logs) {
      if (!tokens.includes(l.address.toLowerCase())) continue;
      try {
        const ev = decodeEventLog({ abi: [transferEvent], data: l.data, topics: l.topics });
        if (ev.args.to.toLowerCase() === account.address.toLowerCase() && ev.args.from.toLowerCase() === receipt.from.toLowerCase()) {
          found = { token: l.address, from: ev.args.from, amount: ev.args.value };
        }
      } catch {}
    }
    if (!found) return Response.json({ error: "no encontré una transferencia de stablecoin local al agente" }, { status: 400 });

    const owns = (await forno.readContract({ address: FACTORY, abi: factoryAbi, functionName: "isAlcancia", args: [found.from, alcancia] })) as boolean;
    if (!owns) return Response.json({ error: "esa alcancía no es tuya" }, { status: 400 });
    if (await contributionProcessed(tx, Number(receipt.blockNumber))) return Response.json({ error: "este aporte ya fue procesado" }, { status: 409 });

    const to = (await forno.readContract({ address: alcancia, abi: alcanciaAbi, functionName: "token" })) as Address;
    if (to.toLowerCase() === found.token.toLowerCase()) {
      const ap = await agentWallet.writeContract({ address: to, abi: [parseAbiItem("function approve(address,uint256) returns (bool)")], functionName: "approve", args: [alcancia, found.amount] });
      await forno.waitForTransactionReceipt({ hash: ap });
      const depositTx = await agentWallet.writeContract({ address: alcancia, abi: alcanciaAbi, functionName: "deposit", args: [found.amount], dataSuffix: tx });
      await forno.waitForTransactionReceipt({ hash: depositTx });
      return Response.json({ amountIn: found.amount.toString(), amountOut: found.amount.toString(), depositTx });
    }
    const rates = await readRates();
    const log = await convertAndDeposit(found.from, found.token, to, found.amount, alcancia, rates, tx);
    return Response.json(log);
  } catch (e) {
    return Response.json({ error: String(e).slice(0, 300) }, { status: 500 });
  } finally {
    inFlight.delete(tx);
  }
}
