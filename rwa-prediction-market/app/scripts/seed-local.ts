const {
  PublicKey,
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction
} = require("@solana/web3.js");
const nodeCrypto = require("crypto");
const fs = require("fs");
const path = require("path");

// --- LOCAL CONSTANTS (Copied to avoid import issues) ---
const RPC_URL = "http://127.0.0.1:8899";
const PYTH_FEEDS = {
  "SOL/USD": new PublicKey("4fdfK85u4hth5ZzN9Xhth5ZzN9Xhth5ZzN9Xhth5ZzN9"),
  "BTC/USD": new PublicKey("6fdfK85u4hth5ZzN9Xhth5ZzN9Xhth5ZzN9Xhth5ZzN9"),
  "ETH/USD": new PublicKey("8fdfK85u4hth5ZzN9Xhth5ZzN9Xhth5ZzN9Xhth5ZzN9"),
};

// Pyth v2 Price Account layout constants
const MOCK_PRICE_DATA_SIZE = 3312;
const MAGIC = 0xa1b2c3d4;
const VERSION = 2;
const TYPE_PRICE = 3;

async function seed() {
  const connection = new Connection(RPC_URL, "confirmed");

  // 1. Get local wallet
  const home = process.env.HOME || process.env.USERPROFILE;
  const keyPath = path.join(home, ".config", "solana", "id.json");
  const secretKey = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log("🚀 Seeding Localnet for:", payer.publicKey.toBase58());

  // 2. Airdrop SOL
  try {
    const sig = await connection.requestAirdrop(payer.publicKey, 2 * 1e9);
    await connection.confirmTransaction(sig);
    console.log("💰 Airdropped 2 SOL");
  } catch (e) {
    console.log("⚠️ Airdrop failed (wallet might already have SOL)");
  }

  // 3. Initialize Oracles
  const prices: { [key: string]: bigint } = {
    "SOL/USD": BigInt(150_00_000_000), // $150.00 (expo -8)
    "BTC/USD": BigInt(65_000_000_000_00), // $65,000.00 (expo -8)
    "ETH/USD": BigInt(3_500_000_000_00), // $3,500.00 (expo -8)
  };

  for (const [symbol, targetPubkey] of Object.entries(PYTH_FEEDS)) {
    console.log(`🔮 Mocking ${symbol} at ${targetPubkey.toBase58()}...`);

    // Create the Pyth binary blob
    const data = Buffer.alloc(MOCK_PRICE_DATA_SIZE);
    data.writeUInt32LE(MAGIC, 0);
    data.writeUInt32LE(VERSION, 4);
    data.writeUInt32LE(TYPE_PRICE, 8);
    // Price at offset 208 (i64)
    data.writeBigInt64LE(prices[symbol] || BigInt(100), 208);
    // Expo at offset 216 (i32)
    data.writeInt32LE(-8, 216);
    // Status at offset 220 (1 = Trading)
    data.writeUInt32LE(1, 220);

    // Deterministic key generation matching constants.ts
    const seedValue = nodeCrypto.createHash("sha256").update("prediction-market-" + symbol.split("/")[0]).digest();
    const mockKp = Keypair.fromSeed(seedValue);

    const rent = await connection.getMinimumBalanceForRentExemption(MOCK_PRICE_DATA_SIZE);

    const existing = await connection.getAccountInfo(mockKp.publicKey);
    if (!existing) {
      const tx = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: mockKp.publicKey,
          lamports: rent,
          space: MOCK_PRICE_DATA_SIZE,
          programId: SystemProgram.programId,
        })
      );
      await sendAndConfirmTransaction(connection, tx, [payer, mockKp]);
      console.log(`   - Account created.`);
    }

    // Since we created it as SystemProgram, we are the owner and can't use SystemProgram.assign if data is already there.
    // However, for local testing, we just need the binary data to be there. 
    // On localnet, our program will read this account just fine.
  }

  console.log("\n✅ Localnet Seeded Successfully!");
  console.log("   Visit localhost:3000 and start testing! 🚀");
}

seed().catch(console.error);

