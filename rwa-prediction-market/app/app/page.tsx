"use client";
import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import MarketCard, { MarketAccountData } from "@/components/markets/MarketCard";
import { useProgram } from "@/hooks/useProgram";
import { getMarketsFromChain } from "@/lib/carbon";
import { useConnection } from "@solana/wallet-adapter-react";
import { RefreshCw, TrendingUp } from "lucide-react";

export default function MarketsPage() {
  const program = useProgram();
  const { connection } = useConnection();
  const [markets, setMarkets] = useState<MarketAccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchMarkets = useCallback(async () => {
    if (!program) return;
    setLoading(true);
    try {
      const raw = await getMarketsFromChain(connection, program);
      const formatted: MarketAccountData[] = raw.map((m: any) => ({
        publicKey: m.publicKey.toBase58(),
        account: {
          title: m.account.title,
          pythFeed: m.account.pythFeed?.toBase58?.() ?? m.account.pythFeed,
          strikePrice: m.account.strikePrice?.toString?.() ?? m.account.strikePrice,
          strikeExpo: m.account.strikeExpo,
          yesPool: m.account.yesPool?.toString?.() ?? 0,
          noPool: m.account.noPool?.toString?.() ?? 0,
          expiry: m.account.expiry?.toString?.() ?? 0,
          resolved: m.account.resolved,
          isPrivate: m.account.isPrivate,
          winningside: m.account.winningSide ?? 0,
          collateralMint: m.account.collateralMint?.toBase58?.() ?? "",
        },
      }));
      setMarkets(formatted);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("fetchMarkets error", err);
    } finally {
      setLoading(false);
    }
  }, [program, connection]);

  useEffect(() => {
    fetchMarkets();
    const t = setInterval(fetchMarkets, 30_000);
    return () => clearInterval(t);
  }, [fetchMarkets]);

  const active = markets.filter((m) => !m.account.resolved);
  const resolved = markets.filter((m) => m.account.resolved);

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span className="text-xs font-semibold text-primary uppercase tracking-widest">Live Markets</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
              Predict Real-World
              <span className="text-primary"> Assets</span>
            </h1>
            <p className="mt-3 text-muted-foreground max-w-lg">
              Bet on Pyth oracle prices using Token-2022 collateral. Permissionless, on-chain, fully transparent.
            </p>
          </div>

          <button
            onClick={fetchMarkets}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-all disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {lastRefresh && (
          <p className="mt-2 text-xs text-muted-foreground">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        )}
      </section>

      {/* Markets grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        {loading && markets.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="gradient-card rounded-2xl h-44 animate-pulse" />
            ))}
          </div>
        ) : markets.length === 0 ? (
          <div className="text-center py-24">
            <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-muted-foreground">No markets yet. Connect your wallet and create the first one!</p>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  Active ({active.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                  {active.map((m) => (
                    <MarketCard key={m.publicKey} market={m} />
                  ))}
                </div>
              </>
            )}

            {resolved.length > 0 && (
              <>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  Resolved ({resolved.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70">
                  {resolved.map((m) => (
                    <MarketCard key={m.publicKey} market={m} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
