import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { z } from "zod";

export const maxDuration = 60;
const MODEL = process.env.AI_MODEL || "anthropic/claude-sonnet-5.5";

const SYSTEM = `Sos "Alcancía", un agente de ahorro gamificado que vive en Celo. Hablás en español rioplatense, cálido, breve (máximo 2-3 frases por mensaje) y con un poco de humor. Usás algún emoji, sin exagerar.

Guiás a la persona por estos pasos, en orden, usando SIEMPRE las herramientas (la UI muestra componentes interactivos; no pidas los datos en texto):
1. Si todavía no hay metas: preguntá "¿Cuáles son tus metas este año?" en texto y esperá su respuesta.
2. Cuando nombre metas, llamá showGoals con una tarjeta por meta: nombre corto, emoji, tu mejor estimación de costo (amount) y moneda. Reglas de moneda: viajes a Brasil (Florianópolis, Río, Búzios, etc.) → BRL, porque se ahorra en la moneda en que se va a gastar; cosas que se pagan en dólares (viajes fuera de LatAm, Ironman, equipos importados) → USD; el resto → ARS. Fecha en formato YYYY-MM (si no la dice, estimá algo razonable dentro de los próximos 12 meses). isTrip=true si es un viaje.
3. Cuando la persona confirme las metas, llamá askBudget para pedir ingreso mensual y gastos fijos.
4. Cuando confirme el presupuesto, llamá showPlan con un comentario corto (note) sobre el plan. La app calcula los porcentajes de forma determinística y la persona crea las alcancías onchain desde ahí.
5. Después de crear las alcancías, felicitala y explicá en 2 frases cómo sigue: cada wARS que le entre se reparte solo; si quiere sacar antes de tiempo, va a tener que pasar el ritual (reflexión + acertijo) o esperar 72 h. Nunca se le retiene la plata.

Contexto útil: las alcancías son contratos en Celo mainnet, una por meta. Se ahorra en wARS (pesos de Ripio, 1:1). Las metas en BRL se llenan en wBRL: el agente convierte los pesos automáticamente. Las metas en USD se guardan en wARS y el agente recalcula la meta con el tipo de cambio. No inventes rendimientos: hoy no hay dónde poner wARS a rendir en Celo; si preguntan, decí que está en el roadmap.`;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const result = streamText({
    model: MODEL,
    system: SYSTEM,
    messages: await convertToModelMessages(messages),
    tools: {
      showGoals: {
        description: "Muestra tarjetas editables, una por meta. La persona ajusta y confirma; devuelve las metas confirmadas.",
        inputSchema: z.object({
          goals: z.array(
            z.object({
              name: z.string(),
              emoji: z.string(),
              amount: z.number().describe("Costo estimado en la moneda indicada"),
              currency: z.enum(["ARS", "USD", "BRL"]),
              deadline: z.string().describe("YYYY-MM"),
              isTrip: z.boolean(),
            }),
          ),
        }),
      },
      askBudget: {
        description: "Muestra el formulario de ingreso mensual (en ARS) y gastos fijos editables. Devuelve lo que la persona confirmó.",
        inputSchema: z.object({
          suggestedCosts: z.array(z.string()).describe("Rubros sugeridos: alquiler, comida, internet, gimnasio…"),
        }),
      },
      showPlan: {
        description: "Muestra el plan de reparto calculado y el botón para crear las alcancías onchain. Devuelve las direcciones creadas.",
        inputSchema: z.object({ note: z.string() }),
      },
    },
  });
  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) });
}
