"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { BarChart3, PlusSquare, Wallet, TrendingUp } from "lucide-react";

const navLinks = [
  { href: "/", label: "Markets", icon: BarChart3 },
  { href: "/create", label: "Create", icon: PlusSquare },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center glow-primary transition-all group-hover:scale-110">
            <TrendingUp className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight hidden sm:block">
            RWA<span className="text-primary">Predict</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:block">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Wallet */}
        <ClientOnlyWalletButton />
      </div>
    </header>
  );
}

function ClientOnlyWalletButton() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="h-[36px] w-[140px] bg-muted animate-pulse rounded-lg" />;

  return (
    <WalletMultiButton
      style={{
        background: "oklch(0.64 0.22 264)",
        borderRadius: "0.6rem",
        fontSize: "13px",
        fontWeight: 600,
        padding: "8px 16px",
        height: "36px",
      }}
    />
  );
}
