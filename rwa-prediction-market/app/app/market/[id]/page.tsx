"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { toast } from "sonner";
import { BN } from "@coral-xyz/anchor";
import Navbar from "@/components/layout/Navbar";
import PriceDisplay from "@/components/markets/PriceDisplay";
import { useProgram } from "@/hooks/useProgram";
import { checkRoomAccess, buyRoomAccess } from "@/lib/x402";
import { PYTH_FEEDS, PREDICTION_MARKET_PROGRAM_ID } from "@/lib/constants";
import { Clock, Lock, Unlock, TrendingUp } from "lucide-react";

type BetState = "idle" | "simulating" | "awaiting-signature" | "confirming" | "confirmed";

function useCountdown(expiryTs: number) {
  const [rem, setRem] = useState(Math.max(0, expiryTs - Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setRem(Math.max(0, expiryTs - Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, [expiryTs]);
  if (rem <= 0) return "Expired";
  const h = Math.floor(rem / 3600);
  const m = Math.floor((rem % 3600) / 60);
  const s = Math.floor(rem % 60);
  return `${h}h ${m}m ${s}s`;
}

export default function MarketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const program = useProgram();
  const { connection } = useConnection();
  const { publicKey: wallet, sendTransaction } = useWallet();

  const [market, setMarket] = useState<any>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [side, setSide] = useState<1 | 2>(1);
  const [amount, setAmount] = useState("");
  const [betState, setBetState] = useState<BetState>("idle");
  const [tab, setTab] = useState<"public" | "private">("public");
  const [tokenBalance, setTokenBalance] = useState("0");
  const [faucetLoading, setFaucetLoading] = useState(false);

  const fetchMarket = useCallback(async (retryCount = 0) => {
    if (!program) return;
    try {
      const acc = await (program.account as any).market.fetch(new PublicKey(id));
      setMarket(acc);
    } catch (e: any) {
      if (e.message?.includes("Account does not exist") || e.message?.includes("discriminator") || e.message?.includes("3012")) {
        if (retryCount < 3) {
          setTimeout(() => fetchMarket(retryCount + 1), 1500);
          return;
        }
      }
      console.error("fetchMarket Error:", e);
    }
  }, [program, id]);

  const fetchBalance = useCallback(async () => {
    if (!wallet || !market) return;
    try {
      const collateralMint = new PublicKey(market.collateralMint);
      const ata = getAssociatedTokenAddressSync(collateralMint, wallet, false, TOKEN_2022_PROGRAM_ID);
      const info = await connection.getTokenAccountBalance(ata);
      setTokenBalance(info.value.uiAmountString || "0");
    } catch (e) {
      setTokenBalance("0");
    }
  }, [wallet, market, connection]);

  useEffect(() => { fetchMarket(); }, [fetchMarket]);

  useEffect(() => {
    if (!wallet || !market) return;
    checkRoomAccess(connection, new PublicKey(id), wallet).then(setHasAccess);
  }, [wallet, market, connection, id]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  const { feedAddress, assetLabel, strike, expiry, expired } = useMemo(() => {
    if (!market) return { feedAddress: null, assetLabel: "ASSET", strike: 0, expiry: 0, expired: false };

    const fAddr = market.pythFeed?.toBase58 ? market.pythFeed.toBase58() : market.pythFeed?.toString() ?? null;
    const label = Object.entries(PYTH_FEEDS).find(([, v]) => v.toBase58() === fAddr)?.[0] ?? "ASSET";
    const strk = Number(market.strikePrice) * Math.pow(10, market.strikeExpo);
    const exp = Number(market.expiry);
    const hasExp = Date.now() / 1000 > exp;

    return { 
      feedAddress: fAddr, 
      assetLabel: label, 
      strike: strk, 
      expiry: exp, 
      expired: hasExp 
    };
  }, [market]);

  const countdown = useCountdown(market ? Number(market.expiry) : 0);

  if (!market) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-16 text-center text-muted-foreground">Loading market...</div>
      </div>
    );
  }

  const yesPool = Number(market.yesPool);
  const noPool = Number(market.noPool);
  const totalPool = yesPool + noPool;
  const yesPct = totalPool > 0 ? Math.round((yesPool / totalPool) * 100) : 50;
  const yesOdds = totalPool > 0 && yesPool > 0 ? (totalPool / yesPool).toFixed(2) : "—";
  const noOdds = totalPool > 0 && noPool > 0 ? (totalPool / noPool).toFixed(2) : "—";

  const formattedStrike = new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 2,
  }).format(strike);

  async function handleBuyAccess() {
    if (!wallet || !program) return toast.error("Connect your wallet first");
    try {
      const sig = await buyRoomAccess(program, new PublicKey(id), wallet, sendTransaction, connection);
      toast.success("Access granted!", {
        action: { label: "Explorer", onClick: () => window.open(`https://explorer.solana.com/tx/${sig}?cluster=devnet`) },
      });
      setHasAccess(true);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleFaucet() {
    if (!wallet || !program || !market) return;
    setFaucetLoading(true);
    try {
      const marketPda = new PublicKey(id);
      const collateralMint = new PublicKey(market.collateralMint);
      const ata = getAssociatedTokenAddressSync(collateralMint, wallet, false, TOKEN_2022_PROGRAM_ID);
      
      const sig = await (program.methods as any)
        .faucet(new BN(1000 * 10 ** 6)) // Mint 1,000 tokens
        .accounts({
          requester: wallet,
          market: marketPda,
          mint: collateralMint,
          requesterTokenAccount: ata,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        } as any)
        .rpc();

      toast.success("Minted 1,000 Tokens!", { id: sig });
      fetchBalance();
    } catch (e: any) {
      toast.error("Faucet failed: " + e.message);
    } finally {
      setFaucetLoading(false);
    }
  }

  async function handlePlaceBet() {
    if (!wallet || !program) return toast.error("Connect your wallet first");
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) return toast.error("Enter a valid amount");

    if (parseFloat(tokenBalance) < amountNum) {
      return toast.error("Insufficient tokens. Use the Quick-Mint button below!");
    }

    setBetState("simulating");
    try {
      const marketPda = new PublicKey(id);
      const collateralMint = new PublicKey(market.collateralMint);
      const bettorAta = getAssociatedTokenAddressSync(collateralMint, wallet, false, TOKEN_2022_PROGRAM_ID);
      const escrowAta = getAssociatedTokenAddressSync(collateralMint, marketPda, true, TOKEN_2022_PROGRAM_ID);

      const [positionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), marketPda.toBuffer(), wallet.toBuffer()],
        PREDICTION_MARKET_PROGRAM_ID
      );

      // 🛡️ Decimal Shield: Fetch actual decimals from the mint
      const mintInfo = await connection.getParsedAccountInfo(collateralMint);
      const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals ?? 6;
      const rawAmount = new BN(Math.round(amountNum * 10 ** decimals));

      console.log("BET DEBUG:", {
        market: marketPda.toBase58(),
        position: positionPda.toBase58(),
        decimals,
        rawAmount: rawAmount.toString()
      });
      const [roomPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("room-access"), marketPda.toBuffer(), wallet.toBuffer()],
        PREDICTION_MARKET_PROGRAM_ID
      );

      // 🛡️ Room Access Guardian: 
      // Only pass the roomPda if it actually exists on-chain and is initialized.
      // If we pass an uninitialized account, Anchor will throw 3012.
      const roomAccInfo = await connection.getAccountInfo(roomPda);
      const isRoomInitialized = roomAccInfo !== null && roomAccInfo.data.length > 0;

      // 💰 Rent Reserve Guardian:
      // Ensure user has at least ~0.005 SOL for rent if this is their first bet.
      const solBalance = await connection.getBalance(wallet);
      if (solBalance < 5_000_000) { // 0.005 SOL
        setBetState("idle");
        return toast.error("Insufficient SOL for transaction fees and account rent (min 0.005 SOL required).");
      }

      const accounts: any = {
        bettor: wallet,
        market: marketPda,
        position: positionPda,
        bettorTokenAccount: bettorAta,
        marketEscrow: escrowAta,
        collateralMint,
        roomAccess: (market.isPrivate && isRoomInitialized) ? roomPda : null,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: new PublicKey("ATokenGPvbdQxrV9zQGf6E6N6a4PzS8n37K98634"),
        systemProgram: SystemProgram.programId,
      };

      const tx = await (program.methods as any)
        .placeBet(side, rawAmount)
        .accounts(accounts)
        .transaction();

      tx.feePayer = wallet;
      tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;

      console.log("DEBUG: Sending bet transaction...", {
        side,
        amount: rawAmount.toString(),
        market: marketPda.toBase58(),
        includesRoom: !!accounts.roomAccess
      });

      const sig = await sendTransaction(tx, connection, {
        skipPreflight: true,
        preflightCommitment: "confirmed"
      });

      setBetState("confirming");
      toast.loading("Confirming transaction...", { id: sig });
      
      const result = await connection.confirmTransaction(sig, "confirmed");
      if (result.value.err) {
        throw new Error(`Transaction Failed: ${JSON.stringify(result.value.err)}`);
      }

      setBetState("confirmed");
      toast.success("Bet placed! 🎉", {
        id: sig,
        action: { label: "View on Explorer", onClick: () => window.open(`https://explorer.solana.com/tx/${sig}?cluster=devnet`) },
      });
      setAmount("");
      fetchMarket();
      fetchBalance();
    } catch (e: any) {
      // PRO TIP: Error objects often have hidden properties. This forces them out.
      const errorJson = JSON.stringify(e, Object.getOwnPropertyNames(e), 2);
      console.error("DEBUG: Full Bet Error Details:", errorJson);
      
      setBetState("idle");
      let msg = e.message || "Transaction failed";
      toast.error(msg);
    } finally {
      if (betState !== "confirmed") setBetState("idle");
    }
  }

  const stateLabel: Record<BetState, string> = {
    idle: side === 1 ? "Bet YES" : "Bet NO",
    simulating: "Simulating...",
    "awaiting-signature": "Sign in wallet",
    confirming: "Confirming...",
    confirmed: "Confirmed ✓",
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* LEFT – Market info */}
          <div className="lg:col-span-3 space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">{assetLabel}</span>
                {market.isPrivate && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 flex items-center gap-1"><Lock className="w-3 h-3" />Private</span>}
                {market.resolved && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">Resolved</span>}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold">{market.title}</h1>
              <p className="text-muted-foreground mt-1">Strike: {formattedStrike}</p>
            </div>

            {feedAddress && (
              <PriceDisplay feedAddress={feedAddress} strikePrice={strike} label="Live Pyth Oracle" />
            )}

            {/* Resolved outcome */}
            {market.resolved && (
              <div className={`rounded-xl p-5 text-center font-bold text-xl ${market.winningSide === 1 ? "bg-[--yes-color]/10 text-[--yes-color] border border-[--yes-color]/20" : "bg-[--no-color]/10 text-[--no-color] border border-[--no-color]/20"}`}>
                {market.winningSide === 1 ? "✓ YES WON" : "✗ NO WON"} · Final TWAP: {formattedStrike}
              </div>
            )}

            {/* Pool breakdown */}
            <div className="gradient-card rounded-xl p-5 space-y-4">
              <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Pool Breakdown</h2>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[--yes-color] font-semibold">YES — {yesPct}%</span>
                <span className="text-[--no-color] font-semibold">{100 - yesPct}% — NO</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                <div className="pool-bar-yes h-full transition-all duration-700" style={{ width: `${yesPct}%` }} />
                <div className="flex-1 pool-bar-no" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "YES Pool", value: yesPool },
                  { label: "Total Pool", value: totalPool },
                  { label: "NO Pool", value: noPool },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-bold mt-0.5">{(value / 1e6).toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-3 mt-3">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{expired ? "Market expired" : countdown}</span>
                <span>Expiry: {new Date(Number(market.expiry) * 1000).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* RIGHT – Bet panel */}
          <div className="lg:col-span-2">
            <div className="gradient-card rounded-2xl p-6 sticky top-24 space-y-5">
              <h2 className="font-bold text-lg">Place Bet</h2>

              {/* Tab selector for private */}
              {market.isPrivate && (
                <div className="flex rounded-lg bg-muted p-1 gap-1">
                  {(["public", "private"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`flex-1 text-xs font-semibold py-1.5 rounded-md capitalize transition-all ${tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}

              {/* x402 private gate */}
              {tab === "private" && !hasAccess ? (
                <div className="text-center py-4 space-y-4">
                  <Lock className="w-10 h-10 text-yellow-400 mx-auto" />
                  <p className="text-sm text-muted-foreground">This is a private room. Pay the room fee to access the private bet form.</p>
                  <p className="font-bold text-lg">{(Number(market.roomFeeLamports) / 1e9).toFixed(4)} SOL</p>
                  <button
                    onClick={handleBuyAccess}
                    className="w-full py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-bold transition-all"
                  >
                    Pay for Room Access
                  </button>
                </div>
              ) : tab === "private" && hasAccess ? (
                <div className="flex items-center gap-2 text-sm text-green-400 justify-center py-2">
                  <Unlock className="w-4 h-4" />
                  Private room access granted
                </div>
              ) : null}

              {/* Bet form (shown when: public tab, or private tab + has access) */}
              {(tab === "public" || hasAccess) && !market.resolved && !expired && (
                <>
                  {/* Side Selection */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setSide(1)}
                      className={`flex-1 py-4 rounded-xl font-bold text-sm transition-all duration-300 border-2 ${
                        side === 1
                          ? "bg-[--yes-color] text-black border-[--yes-color] glow-yes scale-[1.02]"
                          : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted/80"
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="uppercase tracking-tighter text-[10px] opacity-80">Predict</span>
                        <span className="text-base">YES · {yesOdds}×</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setSide(2)}
                      className={`flex-1 py-4 rounded-xl font-bold text-sm transition-all duration-300 border-2 ${
                        side === 2
                          ? "bg-[--no-color] text-white border-[--no-color] glow-no scale-[1.02]"
                          : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted/80"
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="uppercase tracking-tighter text-[10px] opacity-80">Predict</span>
                        <span className="text-base">NO · {noOdds}×</span>
                      </div>
                    </button>
                  </div>

                  {/* Amount Input */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Investment Amount</label>
                      <span className="text-[10px] text-muted-foreground font-medium">Balance: {tokenBalance} Tokens</span>
                    </div>
                    <div className="relative group">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-muted/60 border border-border/50 rounded-xl px-4 py-4 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all group-hover:bg-muted/80"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">RWA</div>
                    </div>
                    
                    <div className="flex justify-between items-center px-1">
                      <button 
                        onClick={handleFaucet}
                        disabled={faucetLoading}
                        className="text-[10px] text-primary hover:underline font-bold uppercase tracking-tighter disabled:opacity-50"
                      >
                        {faucetLoading ? "+ Minting..." : "+ Quick-Mint 1,000 Tokens"}
                      </button>
                      {amount && parseFloat(amount) > 0 && (
                        <span className={`text-[10px] font-bold ${side === 1 ? "text-[--yes-color]" : "text-[--no-color]"}`}>
                          Est. Payout: + {((parseFloat(amount) * (side === 1 ? parseFloat(yesOdds) : parseFloat(noOdds))) || 0).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handlePlaceBet}
                    disabled={betState !== "idle"}
                    className={`w-full py-5 rounded-2xl font-black text-base uppercase tracking-widest transform transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                      side === 1 
                        ? "bg-[--yes-color] text-black glow-yes hover:brightness-110" 
                        : "bg-[--no-color] text-white glow-no hover:brightness-110"
                    }`}
                  >
                    {stateLabel[betState]}
                  </button>

                  <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground/60 uppercase tracking-widest font-bold">
                    <div className="w-1 h-1 rounded-full bg-current" />
                    Secure Simulation Verified
                    <div className="w-1 h-1 rounded-full bg-current" />
                  </div>
                </>
              )}

              {(market.resolved || expired) && (
                <p className="text-center text-muted-foreground text-sm py-4">
                  {market.resolved ? "Market is resolved. Check your portfolio to claim winnings." : "Market has expired. Awaiting resolution."}
                </p>
              )}

              {!wallet && (
                <p className="text-center text-xs text-muted-foreground">Connect your wallet to place a bet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
