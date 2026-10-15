import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { generateText, Output } from "ai";
import { z } from "zod";
import type { Address } from "viem";
import { agentWallet } from "@/lib/agent";
import { forno } from "@/lib/rates";
import { alcanciaAbi } from "@/lib/config";

export const maxDuration = 60;
const MODEL = process.env.AI_MODEL || "anthropic/claude-sonnet-5.5";
const key = createHash("sha256").update(`${process.env.AGENT_PRIVATE_KEY}:riddle`).digest();

function seal(obj: object) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(JSON.stringify(obj)), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64url");
}
function open<T>(token: string): T {
  const b = Buffer.from(token, "base64url");
  const d = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString());
}

type Body =
  | { action: "start"; alcancia: Address; reason: string; context: string }
  | { action: "answer"; alcancia: Address; token: string; answer: string };

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  if (body.action === "start") {
    const name = (await forno.readContract({ address: body.alcancia, abi: alcanciaAbi, functionName: "name" })) as string;
    const { output } = await generateText({
      model: MODEL,
      output: Output.object({
        schema: z.object({
          reply: z.string().describe("Respuesta corta (2-3 frases), cálida y con humor, en español rioplatense, a la razón que dio la persona. Si suena a impulso, decíselo con cariño."),
          question: z.string().describe("Un acertijo o pregunta de trivia corta relacionada con la meta, con una única respuesta clara de 1-3 palabras o un número."),
          answer: z.string().describe("La respuesta correcta, corta."),
          hint: z.string().describe("Una pista breve."),
        }),
      }),
      prompt: `La persona quiere romper antes de tiempo su alcancía "${name}".\nContexto: ${body.context}\nSu razón: "${body.reason}"\nGenerá la respuesta y un acertijo sobre "${name}".`,
    });
    const token = seal({ alcancia: body.alcancia.toLowerCase(), answer: output.answer, exp: Date.now() + 15 * 60_000, tries: 0 });
    return Response.json({ reply: output.reply, question: output.question, hint: output.hint, token });
  }

  if (body.action === "answer") {
    let t: { alcancia: string; answer: string; exp: number };
    try {
      t = open(body.token);
    } catch {
      return Response.json({ error: "token inválido" }, { status: 400 });
    }
    if (t.exp < Date.now() || t.alcancia !== body.alcancia.toLowerCase()) {
      return Response.json({ error: "el acertijo venció, pedí otro" }, { status: 400 });
    }
    const { output } = await generateText({
      model: MODEL,
      output: Output.object({ schema: z.object({ correct: z.boolean(), comment: z.string() }) }),
      prompt: `Respuesta esperada: "${t.answer}". Respuesta de la persona: "${body.answer}". ¿Es correcta (aceptá sinónimos, acentos, mayúsculas y números escritos distinto)? comment: una frase corta en rioplatense.`,
    });
    if (!output.correct) return Response.json({ correct: false, comment: output.comment });

    const pending = (await forno.readContract({ address: body.alcancia, abi: alcanciaAbi, functionName: "pendingWithdraw" })) as readonly [bigint, bigint, boolean];
    if (pending[0] === 0n) return Response.json({ correct: true, comment: output.comment, error: "no hay pedido de retiro pendiente" });
    const tx = await agentWallet.writeContract({ address: body.alcancia, abi: alcanciaAbi, functionName: "agentApprove", args: [] });
    await forno.waitForTransactionReceipt({ hash: tx });
    return Response.json({ correct: true, comment: output.comment, tx });
  }

  return Response.json({ error: "acción desconocida" }, { status: 400 });
}
