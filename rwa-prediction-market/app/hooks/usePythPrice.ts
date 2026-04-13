import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { parsePriceData, getPythProgramKeyForCluster, PriceStatus } from "@pythnetwork/client";
import { useConnection } from "@solana/wallet-adapter-react";

export interface PythPrice {
  price: number;
  confidence: number;
  publishTime: number;
  status: string;
}

export function usePythPrice(feedAddress: string | null): PythPrice | null {
  const { connection } = useConnection();
  const [price, setPrice] = useState<PythPrice | null>(null);

  useEffect(() => {
    if (!feedAddress || !connection) return;
    let subId: number | null = null;

    const initPyth = async () => {
      try {
        const pubkey = new PublicKey(feedAddress);
        
        // 1. Get initial state immediately
        const accountInfo = await connection.getAccountInfo(pubkey);
        
        if (accountInfo) {
          if (accountInfo.data.length < 3000) {
            return;
          }

          // Check for Pyth Magic Number (0xa1b2c3d4)
          const magic = accountInfo.data.readUInt32LE(0);
          if (magic !== 0xa1b2c3d4) {
            return;
          }

          const priceData = parsePriceData(accountInfo.data);
          if (priceData.price !== undefined && priceData.confidence !== undefined) {
             setPrice({
              price: priceData.price,
              confidence: priceData.confidence,
              publishTime: Number(priceData.aggregate.publishSlot),
              status: PriceStatus[priceData.status],
            });
          }
        }

        // 2. Subscribe to real-time updates
        subId = connection.onAccountChange(pubkey, (info) => {
          const priceData = parsePriceData(info.data);
          if (priceData.price !== undefined && priceData.confidence !== undefined) {
            setPrice({
              price: priceData.price,
              confidence: priceData.confidence,
              publishTime: Number(priceData.aggregate.publishSlot),
              status: PriceStatus[priceData.status],
            });
          }
        });
      } catch (e) {
        console.error("Pyth initialization failed:", e);
      }
    };

    initPyth();
    return () => { if (subId !== null) connection.removeAccountChangeListener(subId); };
  }, [feedAddress, connection]);

  return price;
}
