"use client";
import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, connectorsForWallets, lightTheme } from "@rainbow-me/rainbowkit";
import { injectedWallet, metaMaskWallet, rabbyWallet, valoraWallet } from "@rainbow-me/rainbowkit/wallets";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { LangProvider, useI18n } from "@/lib/i18n";
import { celo } from "wagmi/chains";

const connectors = connectorsForWallets(
  [{ groupName: "Wallets", wallets: [injectedWallet, metaMaskWallet, rabbyWallet, valoraWallet] }],
  { appName: "Alcancía", projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "alcancia-demo" },
);

export const wagmiConfig = createConfig({
  chains: [celo],
  connectors,
  transports: { [celo.id]: http("https://forno.celo.org") },
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <LangProvider>
          <Rainbow>{children}</Rainbow>
        </LangProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function Rainbow({ children }: { children: React.ReactNode }) {
  const { lang } = useI18n();
  return (
    <RainbowKitProvider key={lang} theme={lightTheme({ accentColor: "#059669", borderRadius: "large" })} locale={lang === "en" ? "en-US" : "es-419"}>
      {children}
    </RainbowKitProvider>
  );
}
