"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { GoalCards, BudgetForm, PlanCard } from "./ToolCards";
import type { Budget, GoalDraft } from "@/lib/plan";
import type { Local } from "@/lib/config";

const HELLO: UIMessage[] = [
  {
    id: "hello",
    role: "assistant",
    parts: [{ type: "text", text: "¡Hola! 💰 Soy Alcancía. Vamos a armar tu plan de ahorro en tu moneda, onchain. Para arrancar: ¿cuáles son tus metas este año?" }],
  },
];

export function Chat({ onCreated, home }: { onCreated: () => void; home: Local }) {
  const homeRef = useRef(home);
  homeRef.current = home;
  const { messages, sendMessage, addToolOutput, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat", body: () => ({ home: homeRef.current }) }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    messages: HELLO,
  });
  const [input, setInput] = useState("");
  const [goals, setGoals] = useState<GoalDraft[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [messages]);
  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-1 pb-4">
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={m.role === "user" ? "max-w-[85%] space-y-2" : "w-full space-y-3"}>
              {m.parts.map((part, i) => {
                const k = `${m.id}-${i}`;
                if (part.type === "text")
                  return (
                    <p key={k} className={m.role === "user" ? "rounded-2xl rounded-br-sm bg-emerald-600 px-4 py-2 text-white" : "rounded-2xl rounded-bl-sm bg-white px-4 py-2 shadow-sm"}>
                      {part.text}
                    </p>
                  );
                if (part.type === "tool-showGoals") {
                  if (part.state === "input-streaming") return <Skeleton key={k} label="Armando tus metas…" />;
                  if (part.state === "input-available")
                    return (
                      <GoalCards
                        key={k}
                        initial={(part.input as { goals: GoalDraft[] }).goals}
                        home={budget?.home ?? home}
                        onConfirm={(g) => {
                          setGoals(g);
                          addToolOutput({ tool: "showGoals", toolCallId: part.toolCallId, output: { confirmed: g } });
                        }}
                      />
                    );
                  if (part.state === "output-available") return <Done key={k} label={`${goals.length || "Tus"} metas confirmadas ✅`} />;
                }
                if (part.type === "tool-askBudget") {
                  if (part.state === "input-streaming") return <Skeleton key={k} label="Preparando tu presupuesto…" />;
                  if (part.state === "input-available")
                    return (
                      <BudgetForm
                        key={k}
                        suggested={(part.input as { suggestedCosts: string[] }).suggestedCosts}
                        home={home}
                        onConfirm={(b) => {
                          setBudget(b);
                          addToolOutput({ tool: "askBudget", toolCallId: part.toolCallId, output: b });
                        }}
                      />
                    );
                  if (part.state === "output-available") return <Done key={k} label="Presupuesto cargado ✅" />;
                }
                if (part.type === "tool-showPlan") {
                  if (part.state === "input-streaming") return <Skeleton key={k} label="Calculando tu plan…" />;
                  if (part.state === "input-available" && budget)
                    return (
                      <PlanCard
                        key={k}
                        note={(part.input as { note: string }).note}
                        goals={goals}
                        budget={budget}
                        onCreated={(addrs) => {
                          addToolOutput({ tool: "showPlan", toolCallId: part.toolCallId, output: { created: addrs } });
                          setTimeout(onCreated, 2500);
                        }}
                      />
                    );
                  if (part.state === "output-available") return <Done key={k} label="¡Alcancías creadas onchain! 🎉" />;
                }
                return null;
              })}
            </div>
          </div>
        ))}
        {status === "submitted" && <Skeleton label="Pensando…" />}
        <div ref={end} />
      </div>
      <form
        className="flex gap-2 border-t border-emerald-100 pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || busy) return;
          sendMessage({ text: input });
          setInput("");
        }}
      >
        <input
          className="flex-1 rounded-full border border-emerald-200 bg-white px-4 py-3 outline-none focus:border-emerald-500"
          placeholder="Ej: viajar a Florianópolis en enero, un Ironman, cambiar la notebook"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button disabled={busy} className="rounded-full bg-emerald-600 px-5 font-semibold text-white disabled:opacity-50">
          ➤
        </button>
      </form>
    </div>
  );
}

function Skeleton({ label }: { label: string }) {
  return <div className="animate-pulse rounded-2xl bg-white/70 px-4 py-3 text-sm text-gray-500">{label}</div>;
}
function Done({ label }: { label: string }) {
  return <div className="text-sm text-gray-500">{label}</div>;
}
