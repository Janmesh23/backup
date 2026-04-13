import { Inter } from "next/font/google";
import ClientProviders from "@/components/providers/ClientProviders";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <title>RWA Prediction Market</title>
        <meta name="description" content="Bet on real-world asset prices — powered by Pyth oracles and Solana Token-2022." />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
