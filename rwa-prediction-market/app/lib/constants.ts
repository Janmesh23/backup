import { PublicKey } from "@solana/web3.js";

// 🏁 NETWORK TOGGLE: Switch to "localnet" or "devnet" here
export const CLUSTER: "localnet" | "devnet" = "devnet";

export const RPC_URL = CLUSTER === "devnet"
  ? "https://api.devnet.solana.com"
  : "http://127.0.0.1:8899";

export const PREDICTION_MARKET_PROGRAM_ID = new PublicKey(
  "9t99QGY5dSmQv9RcomjrCHBmvfYhgwdrWjVspb1QmBT7"
);

export const TRANSFER_HOOK_PROGRAM_ID = new PublicKey(
  "92qKWPPnd9LaHj2dEiPCKuBJ94nb7TkHCR4gvYKE2ofB"
);

export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);

// Mock addresses for localnet (predictable seeds)
export const PYTH_FEEDS = CLUSTER === "devnet"
  ? {
    "SOL/USD": new PublicKey("J83w4HBpjtSksZoaEe7MssS6swo9r7pUaJscLi9hxMhg"),
    "BTC/USD": new PublicKey("HovQMDrbAgAYPCmtQStnH2aCb2a6q1LtEBrX4HJQMNJb"),
    "ETH/USD": new PublicKey("EdVCmQ9FSPcVe5YySXDPCRmc8aDQLKJ9xvYBMZPie1Vw"),
  }
  : {
    "SOL/USD": new PublicKey("4fdfK85u4hth5ZzN9Xhth5ZzN9Xhth5ZzN9Xhth5ZzN9"),
    "BTC/USD": new PublicKey("6fdfK85u4hth5ZzN9Xhth5ZzN9Xhth5ZzN9Xhth5ZzN9"),
    "ETH/USD": new PublicKey("8fdfK85u4hth5ZzN9Xhth5ZzN9Xhth5ZzN9Xhth5ZzN9"),
  };

export const TWAP_WINDOW_SECONDS = 1800;
export const MAX_CONFIDENCE_RATIO = 0.005;
export const MAX_PRICE_AGE_SECONDS = 60;
export const X402_PRIVATE_ROOM_FEE_LAMPORTS = 10_000_000;
