"use client";
import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { Chat } from "@/components/Chat";
import { Dashboard, useAlcancias } from "@/components/Dashboard";
import { AGENT, explorer } from "@/lib/config";

export default function Home() {
  const { address, isConnected } = useAccount();
  const { count, loading, refetch } = useAlcancias(address);
  const [chat, setChat] = useState(false);
  const showChat = isConnected && !loading && (chat || count === 0);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-4">
      <header className="mb-4 flex items-center justify-between">
        <button onClick={() => setChat(false)} className="text-2xl font-black tracking-tight">💰 Alcancía</button>
        <ConnectButton showBalance={false} chainStatus="none" accountStatus="avatar" label="Conectar" />
      </header>

      {!isConnected && (
        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="text-8xl">💰</div>
          <h1 className="mt-4 text-4xl font-black leading-tight">Ahorrá para lo que querés,<br />en tu moneda.</h1>
          <p className="mt-3 max-w-md text-gray-600">
            Un agente que arma tu plan, reparte cada peso que te entra en alcancías onchain y te frena los impulsos. En pesos, sin pasar por el dólar.
          </p>
          <div className="mt-6"><ConnectButton label="Conectá tu wallet para empezar" /></div>
          <p className="mt-6 text-xs text-gray-400">Celo mainnet · wARS y wBRL de Ripio</p>
        </section>
      )}

      {isConnected && loading && <p className="text-center text-gray-500">Buscando tus alcancías…</p>}

      {showChat && (
        <section className="flex h-[calc(100dvh-7rem)] flex-col">
          <Chat onCreated={() => { setChat(false); refetch(); }} />
        </section>
      )}

      {isConnected && !loading && !showChat && <Dashboard onAdd={() => setChat(true)} />}

      <footer className="mt-auto pt-6 text-center text-xs text-gray-400">
        Agente <a className="underline" href={explorer(AGENT ?? "")} target="_blank">{AGENT?.slice(0, 8)}…</a> · <a className="underline" href="https://8004scan.io/agents/celo/9911" target="_blank">ERC-8004 #9911</a> · built for Agents on Open Rails
      </footer>
    </main>
  );
}
