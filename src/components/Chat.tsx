"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { GoalCards, BudgetForm, PlanCard } from "./ToolCards";
import type { Budget, GoalDraft } from "@/lib/plan";
import type { Local } from "@/lib/config";
import { useI18n } from "@/lib/i18n";

export function Chat({ onCreated, home }: { onCreated: () => void; home: Local }) {
  const { t, lang } = useI18n();
  const homeRef = useRef(home);
  homeRef.current = home;
  const [demo, setDemo] = useState(false);
  const hello: UIMessage[] = [{ id: "hello", role: "assistant", parts: [{ type: "text", text: t.hello }] }];
  const { messages, sendMessage, addToolOutput, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat", body: () => ({ home: homeRef.current, lang }) }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    messages: hello,
  });
  const [input, setInput] = useState("");
  const [goals, setGoals] = useState<GoalDraft[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
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
                    <p key={k} className={m.role === "user" ? "rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2 text-white" : "rounded-2xl rounded-bl-sm bg-white px-4 py-2 shadow-sm"}>
                      {part.text}
                    </p>
                  );
                if (part.type === "tool-showGoals") {
                  if (part.state === "input-streaming") return <Skeleton key={k} label={t.buildingGoals} />;
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
                  if (part.state === "output-available") return <Done key={k} label={t.goalsConfirmed} />;
                }
                if (part.type === "tool-askBudget") {
                  if (part.state === "input-streaming") return <Skeleton key={k} label={t.buildingBudget} />;
                  if (part.state === "input-available")
                    return (
                      <BudgetForm
                        key={k}
                        suggested={(part.input as { suggestedCosts: string[] }).suggestedCosts}
                        home={home}
                        demo={demo}
                        onConfirm={(b) => {
                          setBudget(b);
                          addToolOutput({ tool: "askBudget", toolCallId: part.toolCallId, output: b });
                        }}
                      />
                    );
                  if (part.state === "output-available") return <Done key={k} label={t.budgetLoaded} />;
                }
                if (part.type === "tool-showPlan") {
                  if (part.state === "input-streaming") return <Skeleton key={k} label={t.buildingPlan} />;
                  // Keep the card mounted after the output so the created alcancías stay on screen.
                  if ((part.state === "input-available" || part.state === "output-available") && budget)
                    return (
                      <PlanCard
                        key={k}
                        note={(part.input as { note: string }).note}
                        goals={goals}
                        budget={budget}
                        onCreated={(addrs) => {
                          addToolOutput({ tool: "showPlan", toolCallId: part.toolCallId, output: { created: addrs } });
                        }}
                        onDone={onCreated}
                      />
                    );
                  if (part.state === "output-available") return <Done key={k} label={t.created} />;
                }
                return null;
              })}
            </div>
          </div>
        ))}
        {status === "submitted" && <Skeleton label={t.thinking} />}
        <div ref={end} />
      </div>
      {messages.length === 1 && !busy && (
        <button
          className="mb-2 self-start rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-200"
          onClick={() => {
            setDemo(true);
            sendMessage({ text: t.demoMsg });
          }}
        >
          {t.demoBtn}
        </button>
      )}
      <form
        className="flex gap-2 border-t border-brand-100 pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || busy) return;
          sendMessage({ text: input });
          setInput("");
        }}
      >
        <input
          className="flex-1 rounded-full border border-brand-200 bg-white px-4 py-3 outline-none focus:border-brand-500"
          placeholder={t.placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button disabled={busy} className="rounded-full bg-brand-600 px-5 font-semibold text-white disabled:opacity-50">
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
