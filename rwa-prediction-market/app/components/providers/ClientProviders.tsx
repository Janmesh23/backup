"use client";

import dynamic from "next/dynamic";
import { Toaster } from "sonner";

// 🚀 Safe Client-Side Loading: Now managed inside a Client Component
// to satisfy Next.js 16's strict architectural rules.
const SolanaProvider = dynamic(
  () => import("./SolanaProvider"),
  { ssr: false }
);

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <SolanaProvider>
      {children}
      <Toaster position="bottom-right" richColors theme="dark" />
    </SolanaProvider>
  );
}
