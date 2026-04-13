import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor";
import { useMemo } from "react";
import { PREDICTION_MARKET_PROGRAM_ID } from "../lib/constants";
import idl from "../idl/prediction_market.json";

export function useProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const program = useMemo(() => {
    if (!wallet) return null;
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });
    // Anchor 0.30+ constructor signature is (idl, provider)
    return new Program(idl as Idl, provider);
  }, [connection, wallet]);

  return program;
}
