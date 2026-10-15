"use client";
import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, connectorsForWallets, lightTheme } from "@rainbow-me/rainbowkit";
import { injectedWallet, metaMaskWallet, rabbyWallet, valoraWallet } from "@rainbow-me/rainbowkit/wallets";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
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
        <RainbowKitProvider theme={lightTheme({ accentColor: "#059669", borderRadius: "large" })} locale="es-419">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
