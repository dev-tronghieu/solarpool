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
    let bump: number;
    let mintPool: anchor.web3.PublicKey;
    let mintA: anchor.web3.PublicKey;
    let mintB: anchor.web3.PublicKey;
    let ataPool: Account;
    let ataA: Account;
    let ataB: Account;

    const ammOwner = anchor.web3.Keypair.generate();
    const payer = anchor.web3.Keypair.generate();
    const tokenOwner = anchor.web3.Keypair.generate();

    const getBalance = async (ata: anchor.web3.PublicKey) => {
        return (await program.provider.connection.getTokenAccountBalance(ata))
            .value.amount;
    };

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

        [solarPDA, bump] = anchor.web3.PublicKey.findProgramAddressSync(
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
            .createSolarpool(bump, mintPool, mintA, mintB)
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
        console.log("--> Solarpool");
        console.log(
            "- TokenA balance (Solarpool): ",
            await getBalance(solarpool.ataA)
        );
        console.log(
            "- TokenB balance (Solarpool): ",
            await getBalance(solarpool.ataB)
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

        console.log("--> Before swap");
        console.log(
            "- Solarpool TokenA balance: ",
            await getBalance(ataA.address)
        );
        console.log(
            "- Solarpool TokenB balance: ",
            await getBalance(ataB.address)
        );
        console.log(
            "- User TokenA balance: ",
            await getBalance(userAtaA.address)
        );
        console.log(
            "- User TokenB balance: ",
            await getBalance(userAtaB.address)
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

        console.log("--> After swap");
        console.log(
            "- TokenA balance (Solarpool): ",
            await getBalance(solarpool.ataA)
        );
        console.log(
            "- TokenB balance (Solarpool): ",
            await getBalance(solarpool.ataB)
        );
        console.log(
            "- TokenA balance (User): ",
            await getBalance(userAtaA.address)
        );
        console.log(
            "- TokenB balance (User): ",
            await getBalance(userAtaB.address)
        );
    });
});
