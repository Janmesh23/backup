"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePythPrice } from "@/hooks/usePythPrice";
import { PYTH_FEEDS } from "@/lib/constants";
import { Lock, Clock, TrendingUp, TrendingDown } from "lucide-react";

export interface MarketAccountData {
  publicKey: string;
  account: {
    title: string;
    pythFeed: string;
    strikePrice: string | number;
    strikeExpo: number;
    yesPool: string | number;
    noPool: string | number;
    expiry: string | number;
    resolved: boolean;
    isPrivate: boolean;
    winningside: number;
    collateralMint: string;
  };
}

function useCountdown(expiryTs: number) {
  const [remaining, setRemaining] = useState(Math.max(0, expiryTs - Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setRemaining(Math.max(0, expiryTs - Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, [expiryTs]);
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = Math.floor(remaining % 60);
  return remaining > 0 ? `${h}h ${m}m ${s}s` : "Expired";
}

export default function MarketCard({ market }: { market: MarketAccountData }) {
  const { account, publicKey } = market;
  const expiryTs = Number(account.expiry);
  const countdown = useCountdown(expiryTs);

  // Guess the asset from pyth feed
  const assetLabel =
    Object.entries(PYTH_FEEDS).find(([, v]) => v.toBase58() === account.pythFeed)?.[0] ?? "ASSET";
  const feedAddress = PYTH_FEEDS[assetLabel as keyof typeof PYTH_FEEDS]?.toBase58() ?? null;
  const priceData = usePythPrice(feedAddress);

  const strike = Number(account.strikePrice) * Math.pow(10, account.strikeExpo);
  const yesPool = Number(account.yesPool);
  const noPool = Number(account.noPool);
  const totalPool = yesPool + noPool;
  const yesPct = totalPool > 0 ? Math.round((yesPool / totalPool) * 100) : 50;

  const isAbove = priceData ? priceData.price >= strike : null;

  const formattedStrike = new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 2,
  }).format(strike);

  const formattedPool = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : v.toString();

  return (
    <Link href={`/market/${publicKey}`} className="block group">
      <div className="gradient-card rounded-2xl p-5 transition-all duration-200 hover:border-primary/30 hover:glow-primary cursor-pointer">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary uppercase tracking-wider">
                {assetLabel}
              </span>
              {account.isPrivate && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Private
                </span>
              )}
              {account.resolved && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Resolved
                </span>
              )}
            </div>
            <h3 className="font-semibold text-sm leading-tight truncate">{account.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Strike: {formattedStrike}</p>
          </div>

          {/* Live price vs strike */}
          {isAbove !== null && (
            <div className={`shrink-0 flex items-center gap-1 text-xs font-bold ${isAbove ? "text-[--yes-color]" : "text-[--no-color]"}`}>
              {isAbove ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {priceData && new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(priceData.price)}
            </div>
          )}
        </div>

        {/* Pool bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span className="text-[--yes-color] font-medium">YES {yesPct}% · {formattedPool(yesPool)}</span>
            <span className="text-[--no-color] font-medium">{formattedPool(noPool)} · {100 - yesPct}% NO</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
            <div className="pool-bar-yes h-full rounded-full transition-all duration-500" style={{ width: `${yesPct}%` }} />
            <div className="flex-1 pool-bar-no h-full rounded-full" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {account.resolved ? "Market closed" : countdown}
          </span>
          <span>Pool: {formattedPool(totalPool)} tokens</span>
        </div>
      </div>
    </Link>
  );
}
