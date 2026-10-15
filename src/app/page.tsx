"use client";
import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { Chat } from "@/components/Chat";
import { Dashboard, useAlcancias, useHome } from "@/components/Dashboard";
import { useRates } from "@/components/ToolCards";
import { AGENT, explorer } from "@/lib/config";
import { LangToggle, useI18n } from "@/lib/i18n";

export default function Home() {
  const { t, lang } = useI18n();
  const { address, isConnected } = useAccount();
  const { count, loading, refetch } = useAlcancias(address);
  const rates = useRates();
  const { home } = useHome(address, rates);
  const [chat, setChat] = useState(false);
  const showChat = isConnected && !loading && (chat || count === 0);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-4">
      <header className="mb-4 flex items-center justify-between gap-2">
        <button onClick={() => setChat(false)} className="text-2xl font-black tracking-tight">💰 Alcancía</button>
        <div className="flex items-center gap-2">
          <LangToggle />
          <ConnectButton showBalance={false} chainStatus="none" accountStatus="avatar" label={t.connect} />
        </div>
      </header>

      {!isConnected && (
        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="text-8xl">💰</div>
          <h1 className="mt-4 text-4xl font-black leading-tight">{t.heroTitle1}<br />{t.heroTitle2}</h1>
          <p className="mt-3 max-w-md text-gray-600">{t.heroSub}</p>
          <div className="mt-6"><ConnectButton label={t.heroCta} /></div>
          <p className="mt-6 text-xs text-gray-400">🇦🇷 🇧🇷 🇲🇽 🇨🇴 🇵🇪 🇨🇱 · {t.heroFoot}</p>
        </section>
      )}

      {isConnected && loading && <p className="text-center text-gray-500">{t.loadingAlcancias}</p>}

      {showChat && (
        <section className="flex h-[calc(100dvh-7rem)] flex-col">
          <Chat key={lang} home={home} onCreated={() => { setChat(false); refetch(); }} />
        </section>
      )}

      {isConnected && !loading && !showChat && <Dashboard onAdd={() => setChat(true)} />}

      <footer className="mt-auto pt-6 text-center text-xs text-gray-400">
        {t.footerAgent} <a className="underline" href={explorer(AGENT ?? "")} target="_blank">{AGENT?.slice(0, 8)}…</a> · <a className="underline" href="https://8004scan.io/agents/celo/9911" target="_blank">ERC-8004 #9911</a> · built for Agents on Open Rails
      </footer>
    </main>
  );
}
