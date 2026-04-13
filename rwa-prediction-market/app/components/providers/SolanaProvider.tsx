"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { Buffer } from "buffer";
import { RPC_URL } from "@/lib/constants";

// 🛡️ Polyfill: Required for Solana web3.js in modern Next.js environments
// Injecting immediately at the top of the bundle to ensure all child imports find it.
if (typeof window !== "undefined") {
  (window as any).Buffer = (window as any).Buffer || Buffer;
  (window as any).process = (window as any).process || { env: {} };
}

export default function SolanaProvider({ children }: { children: React.ReactNode }) {
  // 🧬 Standard adapters are automatically detected
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
