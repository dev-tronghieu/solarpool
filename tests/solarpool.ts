import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
    Account,
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Solarpool } from "../target/types/solarpool";

describe("solarpool", async () => {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.Solarpool as Program<Solarpool>;

    let solarPDA: anchor.web3.PublicKey;
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

        solarPDA = anchor.web3.PublicKey.findProgramAddressSync(
            [
                anchor.utils.bytes.utf8.encode("solarpool"),
                ammOwner.publicKey.toBuffer(),
            ],
            program.programId
        )[0];

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
            100
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
            100
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

        // Check
        const solarpool = await program.account.liquidityPool.fetch(solarPDA);
        console.log(
            "--> Solarpool TokenA balance: ",
            await program.provider.connection.getTokenAccountBalance(
                solarpool.ataA
            )
        );
        console.log(
            "--> Solarpool TokenB balance: ",
            await program.provider.connection.getTokenAccountBalance(
                solarpool.ataB
            )
        );
    });

    it("Swap", async () => {
        // Setup
        const user = anchor.web3.Keypair.generate();

        const latestBlockHash = await provider.connection.getLatestBlockhash();

        const sig = await provider.connection.requestAirdrop(
            user.publicKey,
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

        const userAtaA = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            payer,
            mintA,
            user.publicKey,
            true
        );

        await mintTo(
            provider.connection,
            payer,
            mintA,
            userAtaA.address,
            tokenOwner,
            100
        );

        const userAtaB = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            payer,
            mintB,
            user.publicKey,
            true
        );

        // Swap
        await program.methods
            .swap(new anchor.BN(10))
            .accounts({
                pool: solarPDA,
                poolAtaSource: ataA.address,
                poolAtaDestination: ataB.address,
                ataSource: userAtaA.address,
                ataDestination: userAtaB.address,
                user: user.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([user])
            .rpc();

        // Check
        const solarpool = await program.account.liquidityPool.fetch(solarPDA);
        console.log(
            "--> Solarpool TokenA balance: ",
            await program.provider.connection.getTokenAccountBalance(
                solarpool.ataA
            )
        );
    });
});
