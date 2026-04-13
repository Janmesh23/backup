import { Connection } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { PREDICTION_MARKET_PROGRAM_ID } from "./constants";

// Carbon indexes our emitted events: MarketCreated, BetPlaced, MarketResolved, PayoutClaimed
const CARBON_API_BASE = "https://api.carbon.so/v1"; // update with actual Carbon endpoint

export interface MarketEvent {
  type: "MarketCreated" | "BetPlaced" | "MarketResolved" | "PayoutClaimed";
  signature: string;
  slot: number;
  timestamp: number;
  data: Record<string, unknown>;
}

export async function getMarketEvents(marketPubkey: string): Promise<MarketEvent[]> {
  // Carbon query: all events for a specific market pubkey
  try {
    const res = await fetch(
      `${CARBON_API_BASE}/events?program=${PREDICTION_MARKET_PROGRAM_ID}&account=${marketPubkey}&limit=100`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.events || [];
  } catch {
    // Fallback: parse directly from Solana transaction logs
    return [];
  }
}

export async function getAllMarkets(): Promise<MarketEvent[]> {
  try {
    const res = await fetch(
      `${CARBON_API_BASE}/events?program=${PREDICTION_MARKET_PROGRAM_ID}&event=MarketCreated&limit=50`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.events || [];
  } catch {
    return [];
  }
}

// Fallback: fetch markets directly from on-chain program accounts
// Use this if Carbon API is not yet configured
export async function getMarketsFromChain(
  _connection: Connection,
  program: Program
): Promise<any[]> {
  // Fixed in app/lib/carbon.ts
  const markets = await (program.account as any).market.all();
  return markets.map((m: any) => ({ publicKey: m.publicKey, account: m.account }) as any);
}
