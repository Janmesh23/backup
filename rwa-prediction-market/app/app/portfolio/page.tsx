"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { toast } from "sonner";
import Navbar from "@/components/layout/Navbar";
import { useProgram } from "@/hooks/useProgram";
import { PREDICTION_MARKET_PROGRAM_ID } from "@/lib/constants";
import { Wallet, CheckCircle, XCircle, Clock, ArrowRight } from "lucide-react";

interface PositionItem {
  positionPda: string;
  marketPda: string;
  side: number;
  amount: number;
  claimed: boolean;
  marketTitle: string;
  marketResolved: boolean;
  winningSide: number;
  yesPool: number;
  noPool: number;
  marketId: string;
  collateralMint: string;
  marketBump: number;
}

export default function PortfolioPage() {
  const program = useProgram();
  const { connection } = useConnection();
  const { publicKey: wallet, sendTransaction } = useWallet();
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!program || !wallet) return;
    setLoading(true);
    try {
      const allPositions = await (program.account as any).position.all([
        { memcmp: { offset: 8, bytes: wallet.toBase58() } },
      ]);

      const enriched: PositionItem[] = await Promise.all(
        allPositions.map(async (p: any) => {
          let marketTitle = "Unknown Market";
          let marketResolved = false;
          let winningSide = 0;
          let yesPool = 0;
          let noPool = 0;
          let collateralMint = "";
          let marketId = "";
          let marketBump = 0;

          try {
            const mkt = await (program.account as any).market.fetch(p.account.market);
            marketTitle = mkt.title;
            marketResolved = mkt.resolved;
            winningSide = mkt.winningSide ?? 0;
            yesPool = Number(mkt.yesPool);
            noPool = Number(mkt.noPool);
            collateralMint = mkt.collateralMint?.toBase58?.() ?? "";
            marketId = mkt.marketId?.toString?.() ?? "";
            marketBump = mkt.bump;
          } catch {}

          return {
            positionPda: p.publicKey.toBase58(),
            marketPda: p.account.market.toBase58(),
            side: p.account.side,
            amount: Number(p.account.amount),
            claimed: p.account.claimed,
            marketTitle,
            marketResolved,
            winningSide,
            yesPool,
            noPool,
            marketId,
            collateralMint,
            marketBump,
          };
        })
      );
      setPositions(enriched);
    } catch (e) {
      console.error("fetchPositions", e);
    } finally {
      setLoading(false);
    }
  }, [program, wallet]);

  useEffect(() => { fetchPositions(); }, [fetchPositions]);

  async function handleClaim(pos: PositionItem) {
    if (!wallet || !program) return toast.error("Connect your wallet first");
    setClaiming(pos.positionPda);
    try {
      const marketPda = new PublicKey(pos.marketPda);
      const collateralMint = new PublicKey(pos.collateralMint);
      const claimantAta = getAssociatedTokenAddressSync(collateralMint, wallet, false, TOKEN_2022_PROGRAM_ID);
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), marketPda.toBuffer()],
        PREDICTION_MARKET_PROGRAM_ID
      );

      const tx = await (program.methods as any)
        .claimWinnings()
        .accounts({
          claimant: wallet,
          market: marketPda,
          position: new PublicKey(pos.positionPda),
          owner: wallet,
          claimantTokenAccount: claimantAta,
          marketEscrow: escrowPda,
          collateralMint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .transaction();

      tx.feePayer = wallet;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const sim = await connection.simulateTransaction(tx);
      if (sim.value.err) {
        toast.error("Simulation failed — " + JSON.stringify(sim.value.err));
        return;
      }

      const sig = await sendTransaction(tx, connection);
      toast.loading("Claiming...", { id: sig });
      await connection.confirmTransaction(sig, "confirmed");
      toast.success("Winnings claimed! 🎉", {
        id: sig,
        action: { label: "View", onClick: () => window.open(`https://explorer.solana.com/tx/${sig}?cluster=devnet`) },
      });
      fetchPositions();
    } catch (e: any) {
      toast.error(e.message || "Claim failed");
    } finally {
      setClaiming(null);
    }
  }

  if (!wallet) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-24 text-center">
          <Wallet className="w-14 h-14 text-muted-foreground mx-auto mb-5 opacity-40" />
          <h2 className="text-xl font-semibold mb-2">Connect your wallet</h2>
          <p className="text-muted-foreground">Connect to view your open and resolved positions.</p>
        </div>
      </div>
    );
  }

  const active = positions.filter((p) => !p.marketResolved && !p.claimed);
  const claimable = positions.filter((p) => p.marketResolved && !p.claimed && p.side === p.winningSide);
  const closed = positions.filter((p) => p.claimed || (p.marketResolved && p.side !== p.winningSide));

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-extrabold mb-2">Portfolio</h1>
        <p className="text-muted-foreground mb-8">Your open and resolved positions on devnet.</p>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="gradient-card rounded-xl h-20 animate-pulse" />
            ))}
          </div>
        ) : positions.length === 0 ? (
          <div className="text-center py-16">
            <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-muted-foreground">No positions found. Place a bet first!</p>
            <Link href="/" className="inline-flex items-center gap-2 mt-4 text-primary hover:underline text-sm font-medium">
              Browse Markets <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {claimable.length > 0 && (
              <>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-green-400">Claim Winnings ({claimable.length})</h2>
                <div className="space-y-3">
                  {claimable.map((pos) => {
                    const totalPool = pos.yesPool + pos.noPool;
                    const winPool = pos.side === 1 ? pos.yesPool : pos.noPool;
                    const payout = winPool > 0 ? Math.floor((pos.amount * totalPool) / winPool) : 0;
                    return (
                      <div key={pos.positionPda} className="gradient-card rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 border border-green-500/20">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{pos.marketTitle}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Side: <span className={pos.side === 1 ? "text-[--yes-color]" : "text-[--no-color]"}>{pos.side === 1 ? "YES" : "NO"}</span> · Staked: {(pos.amount / 1e6).toFixed(2)} tokens
                          </p>
                          <p className="text-xs text-green-400 mt-1 font-medium">Winnings: ~{(payout / 1e6).toFixed(2)} tokens</p>
                        </div>
                        <button
                          onClick={() => handleClaim(pos)}
                          disabled={claiming === pos.positionPda}
                          className="shrink-0 px-5 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold text-sm transition-all disabled:opacity-60"
                        >
                          {claiming === pos.positionPda ? "Claiming..." : "Claim Winnings"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {active.length > 0 && (
              <>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Active Positions ({active.length})</h2>
                <div className="space-y-3">
                  {active.map((pos) => (
                    <Link key={pos.positionPda} href={`/market/${pos.marketPda}`}>
                      <div className="gradient-card rounded-xl p-5 flex items-center gap-4 hover:border-primary/30 transition-all cursor-pointer">
                        <Clock className="w-5 h-5 text-muted-foreground shrink-0" />
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{pos.marketTitle}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Side: <span className={pos.side === 1 ? "text-[--yes-color]" : "text-[--no-color]"}>{pos.side === 1 ? "YES" : "NO"}</span> · {(pos.amount / 1e6).toFixed(2)} tokens
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}

            {closed.length > 0 && (
              <>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground opacity-60">Settled ({closed.length})</h2>
                <div className="space-y-3 opacity-60">
                  {closed.map((pos) => {
                    const won = pos.claimed && pos.marketResolved && pos.side === pos.winningSide;
                    return (
                      <div key={pos.positionPda} className="gradient-card rounded-xl p-5 flex items-center gap-4">
                        {won ? <CheckCircle className="w-5 h-5 text-[--yes-color]" /> : <XCircle className="w-5 h-5 text-[--no-color]" />}
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{pos.marketTitle}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            <span className={pos.side === 1 ? "text-[--yes-color]" : "text-[--no-color]"}>{pos.side === 1 ? "YES" : "NO"}</span> · {won ? "Won & Claimed" : "Lost"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
