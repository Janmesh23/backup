"use client";
import { useMemo, useState, useEffect } from "react";
import { Buffer } from "buffer";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { Toaster } from "sonner";
import { Inter } from "next/font/google";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";

// 🛡️ Polyfill: Required for Solana web3.js in modern Next.js environments
if (typeof window !== "undefined") {
  (window as any).Buffer = Buffer;
  (window as any).process = { env: {} };
}

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

import { RPC_URL } from "@/lib/constants";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  // 🛡️ Mount Guard: Wait for hydration before initializing providers
  useEffect(() => {
    setMounted(true);
  }, []);

  // 🧬 Dynamic Wallets: Modern wallets are auto-detected via the Standard
  const wallets = useMemo(() => [
    // We leave this empty because Phantom/Solflare/etc follow the Wallet Standard
    // and are automatically registered by the provider.
  ], []);

  return (
    <html lang="en" className={inter.variable}>
      <head>
        <title>RWA Prediction Market</title>
        <meta name="description" content="Bet on real-world asset prices — powered by Pyth oracles and Solana Token-2022." />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {mounted ? (
          <ConnectionProvider endpoint={RPC_URL}>
            <WalletProvider wallets={wallets} autoConnect={false}>
              <WalletModalProvider>
                {children}
                <Toaster position="bottom-right" richColors theme="dark" />
              </WalletModalProvider>
            </WalletProvider>
          </ConnectionProvider>
        ) : (
          <div className="min-h-screen opacity-0 bg-background" />
        )}
      </body>
    </html>
  );
}
