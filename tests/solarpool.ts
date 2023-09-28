import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
    Account,
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
} from "@solana/spl-token";
import { Solarpool } from "../target/types/solarpool";

describe("solarpool", async () => {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.Solarpool as Program<Solarpool>;

    let solarPDA: anchor.web3.PublicKey;
    let bumpSeed: number;
    let mintPool: anchor.web3.PublicKey;
    let mintA: anchor.web3.PublicKey;
    let mintB: anchor.web3.PublicKey;
    let ataPool: Account;
    let ataA: Account;
    let ataB: Account;

    const ammOwner = anchor.web3.Keypair.generate();
    const payer = anchor.web3.Keypair.generate();
    const tokenOwner = anchor.web3.Keypair.generate();

    it("Create Solarpool", async () => {
        // Setup
        const latestBlockHash = await provider.connection.getLatestBlockhash();

        const sig = await provider.connection.requestAirdrop(
            payer.publicKey,
            5_000_000_000
        );

        await provider.connection.confirmTransaction(
            {
                signature: sig,
                blockhash: latestBlockHash.blockhash,
                lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
            },
            "singleGossip"
        );

        const sig2 = await provider.connection.requestAirdrop(
            ammOwner.publicKey,
            5_000_000_000
        );

        await provider.connection.confirmTransaction(
            {
                signature: sig2,
                blockhash: latestBlockHash.blockhash,
                lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
            },
            "singleGossip"
        );

        [solarPDA, bumpSeed] = anchor.web3.PublicKey.findProgramAddressSync(
            [
                anchor.utils.bytes.utf8.encode("solarpool"),
                ammOwner.publicKey.toBuffer(),
            ],
            program.programId
        );

        // Create and mint tokens
        mintPool = await createMint(
            provider.connection,
            payer,
            tokenOwner.publicKey,
            null,
            0
        );

        ataPool = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            payer,
            mintPool,
            solarPDA,
            true
        );

        mintA = await createMint(
            provider.connection,
            payer,
            tokenOwner.publicKey,
            null,
            0
        );

        ataA = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            payer,
            mintA,
            solarPDA,
            true
        );

        await mintTo(
            provider.connection,
            payer,
            mintA,
            ataA.address,
            tokenOwner,
            10
        );

        mintB = await createMint(
            provider.connection,
            payer,
            tokenOwner.publicKey,
            null,
            0
        );

        ataB = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            payer,
            mintB,
            solarPDA,
            true
        );

        await mintTo(
            provider.connection,
            payer,
            mintB,
            ataB.address,
            tokenOwner,
            20
        );

        // Create Solarpool
        await program.methods
            .createSolarpool(mintPool, mintA, mintB)
            .accounts({
                ataPool: ataPool.address,
                ataA: ataA.address,
                ataB: ataB.address,
                owner: ammOwner.publicKey,
                pool: solarPDA,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([ammOwner])
            .rpc();
    });

    it("Swap", async () => {});
});
