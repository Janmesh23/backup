"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PublicKey, SystemProgram, Keypair, ComputeBudgetProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddressSync, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { toast } from "sonner";
import Navbar from "@/components/layout/Navbar";
import { useProgram } from "@/hooks/useProgram";
import { PREDICTION_MARKET_PROGRAM_ID, PYTH_FEEDS, TOKEN_2022_PROGRAM_ID, TRANSFER_HOOK_PROGRAM_ID } from "@/lib/constants";
import { PlusCircle, Lock } from "lucide-react";

const ASSET_OPTIONS = Object.entries(PYTH_FEEDS).map(([label, pubkey]) => ({
  label,
  value: pubkey.toBase58(),
}));

export default function CreateMarketPage() {
  const program = useProgram();
  const { connection } = useConnection();
  const { publicKey: wallet, sendTransaction, connected } = useWallet();
  const router = useRouter();

  const [form, setForm] = useState({
    title: "",
    asset: ASSET_OPTIONS[0].value,
    strikePrice: "",
    expiry: "",
    isPrivate: false,
    roomFee: "0.01",
    collateralMint: "",
  });
  const [loading, setLoading] = useState(false);

  function update(k: keyof typeof form, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function validate() {
    if (!form.title.trim() || form.title.length > 100) return "Title must be 1-100 characters";
    if (!form.strikePrice || isNaN(parseFloat(form.strikePrice))) return "Enter a valid strike price";
    if (!form.expiry) return "Choose an expiry date";
    const exp = new Date(form.expiry).getTime() / 1000;
    if (exp < Date.now() / 1000 + 120) return "Expiry must be at least 2 minutes from now";
    if (!form.collateralMint) return "Enter the collateral token mint address";
    try { new PublicKey(form.collateralMint); } catch { return "Invalid collateral mint address"; }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!connected || !wallet || !program) return toast.error("Connect your wallet first");

    const err = validate();
    if (err) return toast.error(err);

    setLoading(true);
    try {
      const marketId = new BN(Date.now());
      const [marketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), wallet.toBuffer(), marketId.toArrayLike(Buffer, "le", 8)],
        PREDICTION_MARKET_PROGRAM_ID
      );

      const strikePriceRaw = new BN(Math.round(parseFloat(form.strikePrice) * 1e6));
      const expiryTs = new BN(Math.floor(new Date(form.expiry).getTime() / 1000));
      const roomFeeLamports = new BN(Math.round(parseFloat(form.roomFee) * 1e9));

      // Deriving the Escrow ATA for the Market PDA
      const marketEscrow = getAssociatedTokenAddressSync(
        new PublicKey(form.collateralMint),
        marketPda,
        true, // allowOwnerOffCurve must be true for PDAs!
        TOKEN_2022_PROGRAM_ID
      );

      const tx = await (program.methods as any)
        .createMarket(
          marketId,
          form.title.trim(),
          new PublicKey(form.asset),
          strikePriceRaw,
          -6, // expo for 6 decimal representation
          new PublicKey(form.collateralMint),
          expiryTs,
          form.isPrivate,
          roomFeeLamports
        )
        .accounts({
          creator: wallet,
          market: marketPda,
          marketEscrow: marketEscrow,
          collateralMint: new PublicKey(form.collateralMint),
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      tx.feePayer = wallet;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const sim = await connection.simulateTransaction(tx);
      if (sim.value.err) {
        toast.error("Simulation failed — check your inputs");
        setLoading(false);
        return;
      }

      const sig = await sendTransaction(tx, connection);
      toast.loading("Creating market...", { id: sig });
      await connection.confirmTransaction(sig, "confirmed");
      toast.success("Market created! 🎉", {
        id: sig,
        action: { label: "View", onClick: () => window.open(`https://explorer.solana.com/tx/${sig}?cluster=devnet`) },
      });
      router.push(`/market/${marketPda.toBase58()}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to create market");
    } finally {
      setLoading(false);
    }
  }

  const selectedAsset = ASSET_OPTIONS.find((a) => a.value === form.asset);

  const minExpiry = new Date(Date.now() + 60_000).toISOString().slice(0, 16);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <PlusCircle className="w-6 h-6 text-primary" />
          <h1 className="text-3xl font-extrabold">Create Market</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Market Title</label>
            <input
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              maxLength={100}
              placeholder="e.g. BTC/USD above $100,000 by end of year"
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{form.title.length}/100</p>
          </div>

          {/* Asset */}
          <div>
            <label className="block text-sm font-medium mb-2">Asset (Pyth Feed)</label>
            <select
              value={form.asset}
              onChange={(e) => update("asset", e.target.value)}
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {ASSET_OPTIONS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>

          {/* Strike */}
          <div>
            <label className="block text-sm font-medium mb-2">Strike Price (USD)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <input
                type="number"
                value={form.strikePrice}
                onChange={(e) => update("strikePrice", e.target.value)}
                placeholder="70000"
                className="w-full bg-muted rounded-xl pl-8 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Will be stored as raw i64 with expo −6. {selectedAsset?.label} will be compared to this value.
            </p>
          </div>

          {/* Expiry */}
          <div>
            <label className="block text-sm font-medium mb-2">Expiry Date &amp; Time</label>
            <input
              type="datetime-local"
              value={form.expiry}
              min={minExpiry}
              onChange={(e) => update("expiry", e.target.value)}
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-xs text-muted-foreground mt-1">All times shown in your local timezone.</p>
          </div>

          {/* Collateral mint */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium">Collateral Token Mint (Token-2022)</label>
              <button
                type="button"
                onClick={async () => {
                  if (!connected || !wallet || !program) return toast.error("Connect wallet to mint");
                  setLoading(true);
                  try {
                    const mintKp = Keypair.generate();
                    const creatorAta = getAssociatedTokenAddressSync(mintKp.publicKey, wallet, false, TOKEN_2022_PROGRAM_ID);
                    
                    const tx = await (program.methods as any)
                      .mintRwa({
                        name: "Test Gold",
                        symbol: "tGOLD",
                        rwaType: "COMMODITY",
                        initialSupply: new BN(10_000_000_000), // 10k tokens (6 decimals)
                        decimals: 6,
                      })
                      .accounts({
                        creator: wallet,
                        mint: mintKp.publicKey,
                        creatorTokenAccount: creatorAta,
                        extraAccountMetaList: PublicKey.findProgramAddressSync(
                          [Buffer.from("extra-account-metas"), mintKp.publicKey.toBuffer()],
                          TRANSFER_HOOK_PROGRAM_ID
                        )[0],
                        transferHookProgram: TRANSFER_HOOK_PROGRAM_ID,
                        tokenProgram: TOKEN_2022_PROGRAM_ID,
                        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                        rent: SYSVAR_RENT_PUBKEY,
                      } as any)
                      .preInstructions([
                        ComputeBudgetProgram.setComputeUnitLimit({ units: 800000 }),
                      ])
                      .transaction();

                    tx.feePayer = wallet;
                    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
                    tx.partialSign(mintKp);

                    const sig = await sendTransaction(tx, connection);
                    toast.loading("Confirmation in progress...", { id: sig });
                    await connection.confirmTransaction(sig, "confirmed");

                    toast.success("Test Token Minted!", { description: mintKp.publicKey.toBase58(), id: sig });
                    update("collateralMint", mintKp.publicKey.toBase58());
                  } catch (e: any) {
                    toast.error("Minting failed: " + e.message);
                  } finally {
                    setLoading(false);
                  }
                }}
                className="text-xs text-primary hover:underline font-semibold disabled:opacity-50"
                disabled={loading}
              >
                {loading ? "Minting..." : "+ Mint a Test RWA Token"}
              </button>
            </div>
            <input
              value={form.collateralMint}
              onChange={(e) => update("collateralMint", e.target.value)}
              placeholder="Enter Token-2022 mint address"
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Use a Token-2022 Mint ID. If you don't have one, click "Mint a Test RWA Token" above to create a sample Gold token on devnet.
            </p>
          </div>

          {/* Privacy toggle */}
          <div className="gradient-card rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="w-4 h-4 text-yellow-400" />
                <div>
                  <p className="font-medium text-sm">Private Market</p>
                  <p className="text-xs text-muted-foreground">Require users to pay a room fee to bet</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => update("isPrivate", !form.isPrivate)}
                className={`relative w-11 h-6 rounded-full transition-all ${form.isPrivate ? "bg-yellow-500" : "bg-muted"}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${form.isPrivate ? "translate-x-5" : ""}`} />
              </button>
            </div>

            {form.isPrivate && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Room Access Fee (SOL)</label>
                <input
                  type="number"
                  step="0.001"
                  value={form.roomFee}
                  onChange={(e) => update("roomFee", e.target.value)}
                  className="w-full bg-background/40 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !wallet}
            className="w-full py-4 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-bold text-base transition-all disabled:opacity-50 glow-primary"
          >
            {!wallet ? "Connect wallet to create market" : loading ? "Creating..." : "Create Market"}
          </button>
        </form>
      </div>
    </div>
  );
}
