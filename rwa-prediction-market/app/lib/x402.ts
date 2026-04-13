import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { PREDICTION_MARKET_PROGRAM_ID } from "./constants";

export async function buyRoomAccess(
  program: Program<any>,
  marketPubkey: PublicKey,
  buyer: PublicKey,
  sendTransaction: Function,
  connection: Connection
): Promise<string> {
  // Derive RoomAccess PDA
  const [roomAccessPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("room-access"), marketPubkey.toBuffer(), buyer.toBuffer()],
    PREDICTION_MARKET_PROGRAM_ID
  );

  // Check if already purchased
  const existing = await connection.getAccountInfo(roomAccessPda);
  if (existing) {
    throw new Error("Room access already purchased for this market");
  }

  // Build transaction
  // Use any cast to stop excessively deep type instantiation in complex IDLs
  const tx = await (program.methods as any)
    .buyRoomAccess()
    .accounts({
      buyer,
      market: marketPubkey,
      roomAccess: roomAccessPda,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  // Simulate first
  const sim = await connection.simulateTransaction(tx);
  if (sim.value.err) {
    throw new Error(`Simulation failed: ${JSON.stringify(sim.value.err)}`);
  }

  const sig = await sendTransaction(tx, connection);
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}

export async function checkRoomAccess(
  connection: Connection,
  marketPubkey: PublicKey,
  userPubkey: PublicKey
): Promise<boolean> {
  const [roomAccessPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("room-access"), marketPubkey.toBuffer(), userPubkey.toBuffer()],
    PREDICTION_MARKET_PROGRAM_ID
  );
  const account = await connection.getAccountInfo(roomAccessPda);
  return account !== null;
}
