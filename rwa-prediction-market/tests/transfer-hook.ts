import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TransferHook } from "../target/types/transfer_hook";
import { PredictionMarket } from "../target/types/prediction_market";
import {
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  createTransferCheckedWithTransferHookInstruction,
} from "@solana/spl-token";
import { expect } from "chai";

describe("transfer-hook", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;

  const pmProgram = anchor.workspace.PredictionMarket as Program<PredictionMarket>;
  const thProgram = anchor.workspace.TransferHook as Program<TransferHook>;

  const creator = anchor.web3.Keypair.generate();
  const receiver = anchor.web3.Keypair.generate();
  const mint = anchor.web3.Keypair.generate();

  const pmProgramId = pmProgram.programId;

  // Derive the PDA required for the Transfer Hook interface
  const [extraAccountMetaListPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("extra-account-metas"), mint.publicKey.toBuffer()],
    thProgram.programId
  );

  before(async () => {
    // 1. Airdrop SOL
    const sig1 = await provider.connection.requestAirdrop(creator.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig1);

    const sig2 = await provider.connection.requestAirdrop(receiver.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig2);

    const creatorTokenAccount = getAssociatedTokenAddressSync(
      mint.publicKey,
      creator.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const args = {
      name: "Tokenized Gold",
      symbol: "tGOLD",
      rwaType: "COMMODITY",
      initialSupply: new anchor.BN(1000000),
      decimals: 6,
    };

    // 2. Mint the RWA Token
    await pmProgram.methods
      .mintRwa(args)
      .accounts({
        creator: creator.publicKey,
        mint: mint.publicKey,
        creatorTokenAccount: creatorTokenAccount,
        transferHookProgram: thProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as any)
      .signers([creator, mint])
      .rpc();

    // 3. Initialize the ExtraAccountMetaList PDA
    const initTx = await thProgram.methods
      .initializeExtraAccountMetaList()
      .accounts({
        payer: creator.publicKey,
        extraAccountMetaList: extraAccountMetaListPDA,
        mint: mint.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([creator])
      .rpc();

    // Confirm metadata initialization
    await provider.connection.confirmTransaction(initTx, "confirmed");
  });

  it("wallet-to-wallet transfer ignores hook and completes successfully", async () => {
    const creatorATA = getAssociatedTokenAddressSync(mint.publicKey, creator.publicKey, false, TOKEN_2022_PROGRAM_ID);
    const receiverATA = getAssociatedTokenAddressSync(mint.publicKey, receiver.publicKey, false, TOKEN_2022_PROGRAM_ID);

    const createAtaIx = createAssociatedTokenAccountInstruction(
      creator.publicKey,
      receiverATA,
      receiver.publicKey,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID
    );

    const ix = await createTransferCheckedWithTransferHookInstruction(
      provider.connection,
      creatorATA,
      mint.publicKey,
      receiverATA,
      creator.publicKey,
      BigInt(100),
      6,
      [],
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );

    const tx = new anchor.web3.Transaction().add(createAtaIx, ix);
    await provider.sendAndConfirm(tx, [creator]);
  });

  it("market PDA transfer triggers CollateralDeposited event", async () => {
    const creatorATA = getAssociatedTokenAddressSync(mint.publicKey, creator.publicKey, false, TOKEN_2022_PROGRAM_ID);
    const marketATA = getAssociatedTokenAddressSync(mint.publicKey, pmProgramId, true, TOKEN_2022_PROGRAM_ID);

    console.log("Prediction Market ID:", pmProgramId.toBase58());
    console.log("Market ATA:", marketATA.toBase58());

    const createAtaIx = createAssociatedTokenAccountInstruction(
      creator.publicKey,
      marketATA,
      pmProgramId,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID
    );

    // Register listener for events (PascalCase as per Anchor standard)
    let eventReceived = false;
    const listener = thProgram.addEventListener("collateralDeposited", (event) => {
      console.log("LOG: Captured collateralDeposited event:", event);
      if (event.destination.toBase58() === marketATA.toBase58()) {
        eventReceived = true;
      }
    });

    // Add a log listener for direct program output
    const logListener = provider.connection.onLogs(thProgram.programId, (logs) => {
      if (logs.logs.some(l => l.includes("MATCH FOUND!"))) {
        console.log("MATCH FOUND in logs - Program recognized the market PDA.");
      }
    });

    const ix = await createTransferCheckedWithTransferHookInstruction(
      provider.connection,
      creatorATA,
      mint.publicKey,
      marketATA,
      creator.publicKey,
      BigInt(50),
      6,
      [],
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );

    const tx = new anchor.web3.Transaction().add(createAtaIx, ix);
    await provider.sendAndConfirm(tx, [creator]);

    // Robust Polling for event detection (up to 15 seconds)
    for (let i = 0; i < 30; i++) {
      if (eventReceived) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    thProgram.removeEventListener(listener);
    provider.connection.removeOnLogsListener(logListener);
    expect(eventReceived, "Event 'CollateralDeposited' was not detected, although logs show MATCH FOUND!").to.be.true;
  });
});