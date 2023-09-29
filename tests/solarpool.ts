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
    const wallet = anchor.Wallet.local();
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
    let amountAtaA: number;
    let ataB: Account;
    let amountAtaB: number;
    let feeAtaA: Account;
    let feeAtaB: Account;
    let userAtaA: Account;
    let userAtaB: Account;

    const ammOwner = anchor.web3.Keypair.generate();
    const feeAccount = anchor.web3.Keypair.generate();
    const feeRate = 0.01;
    const payer = anchor.web3.Keypair.generate();
    const tokenOwner = anchor.web3.Keypair.generate();
    const user = wallet.payer;

    const getSOL = async (publicKey: anchor.web3.PublicKey) => {
        return (
            (await program.provider.connection.getBalance(publicKey)) /
            anchor.web3.LAMPORTS_PER_SOL
        );
    };

    const getBalance = async (ata: anchor.web3.PublicKey) => {
        return (await program.provider.connection.getTokenAccountBalance(ata))
            .value.amount;
    };

    const printGeneralAddress = async () => {
        console.log("--> Address");
        console.log("  - Payer: ", payer.publicKey.toBase58());
        console.log("  - TokenOwner: ", tokenOwner.publicKey.toBase58());
        console.log("  - User: ", user.publicKey.toBase58());
        console.log("  - ammOwner: ", ammOwner.publicKey.toBase58());
        console.log("  - feeAccount: ", feeAccount.publicKey.toBase58());
        console.log("  - Solarpool PDA: ", solarPDA.toBase58());
    };

    const printGeneralBalance = async () => {
        console.log("--> General balance");
        console.log("  - Payer", await getSOL(payer.publicKey));
        console.log("  - TokenOwner", await getSOL(tokenOwner.publicKey));
        console.log("  - User", await getSOL(user.publicKey));
        console.log("  - ammOwner", await getSOL(ammOwner.publicKey));
        console.log("  - feeAccount", await getSOL(feeAccount.publicKey));
        console.log("  - Solarpool PDA", await getSOL(solarPDA));
    };

    const printSolarpool = async () => {
        const solarpool = await program.account.liquidityPool.fetch(solarPDA);
        console.log("--> Solarpool");
        console.log("  - SOL: ", await getSOL(solarPDA));
        console.log("  - TokenA: ", await getBalance(solarpool.ataA));
        console.log("  - TokenB: ", await getBalance(solarpool.ataB));
        console.log("  - Fee rate: ", solarpool.feeRate);
    };

    it("Setup", async () => {
        console.log();
        console.log("---- Setup ----");

        const latestBlockHash = await provider.connection.getLatestBlockhash();

        const airdropPayerSig = await provider.connection.requestAirdrop(
            payer.publicKey,
            10_000_000_000
        );
        await provider.connection.confirmTransaction(
            {
                signature: airdropPayerSig,
                blockhash: latestBlockHash.blockhash,
                lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
            },
            "confirmed"
        );

        const airdropAmmOwnerSig = await provider.connection.requestAirdrop(
            ammOwner.publicKey,
            3_000_000_000
        );
        await provider.connection.confirmTransaction(
            {
                signature: airdropAmmOwnerSig,
                blockhash: latestBlockHash.blockhash,
                lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
            },
            "confirmed"
        );

        [solarPDA, bump] = anchor.web3.PublicKey.findProgramAddressSync(
            [
                anchor.utils.bytes.utf8.encode("solarpool"),
                ammOwner.publicKey.toBuffer(),
            ],
            program.programId
        );

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
            100_000
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
            100_000
        );
    });

    it("Create Solarpool", async () => {
        console.log();
        console.log("---- Create Solarpool ----");

        await program.methods
            .createSolarpool(bump, feeRate, mintPool, mintA, mintB)
            .accounts({
                owner: ammOwner.publicKey,
                feeAccount: feeAccount.publicKey,
                pool: solarPDA,
                ataPool: ataPool.address,
                ataA: ataA.address,
                ataB: ataB.address,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([ammOwner])
            .rpc();
    });

    it("Health check", async () => {
        console.log();
        console.log("---- Health check ----");
        await printGeneralAddress();
        console.log();
        await printGeneralBalance();
        console.log();
        await printSolarpool();
    });

    it("Swap", async () => {
        console.log();
        console.log("---- Swap ----");

        // Setup
        const latestBlockHash = await provider.connection.getLatestBlockhash();

        userAtaA = await getOrCreateAssociatedTokenAccount(
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
            1_000
        );

        userAtaB = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            payer,
            mintB,
            user.publicKey,
            true
        );

        await mintTo(
            provider.connection,
            payer,
            mintB,
            userAtaB.address,
            tokenOwner,
            2_000
        );

        feeAtaA = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            payer,
            mintA,
            feeAccount.publicKey,
            true
        );

        feeAtaB = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            payer,
            mintB,
            feeAccount.publicKey,
            true
        );

        console.log("--> Before swap");
        amountAtaA = parseInt(await getBalance(ataA.address));
        amountAtaB = parseInt(await getBalance(ataB.address));
        console.log(
            `- Exchange rate: 1 TokenA = ${amountAtaA / amountAtaB} TokenB`
        );
        console.log("- SOL (Solarpool): ", await getSOL(solarPDA));
        console.log("- TokenA balance (Solarpool): ", amountAtaA);
        console.log("- TokenB balance (Solarpool): ", amountAtaB);
        console.log("- SOL (User): ", await getSOL(user.publicKey));
        console.log(
            "- TokenA balance (User): ",
            await getBalance(userAtaA.address)
        );
        console.log(
            "- TokenB balance (User): ",
            await getBalance(userAtaB.address)
        );
        console.log(
            "- TokenA balance (Fee): ",
            await getBalance(feeAtaA.address)
        );

        // Swap 800 TokenA for TokenB
        const swap_amount = 800;

        const swap1Sig = await program.methods
            .swap(new anchor.BN(swap_amount))
            .accounts({
                pool: solarPDA,
                feeAtaSource: feeAtaA.address,
                poolAtaSource: ataA.address,
                poolAtaDestination: ataB.address,
                ataSource: userAtaA.address,
                ataDestination: userAtaB.address,
                user: user.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([user])
            .rpc();

        await provider.connection.confirmTransaction(
            {
                signature: swap1Sig,
                blockhash: latestBlockHash.blockhash,
                lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
            },
            "confirmed"
        );

        // Check results of swapping 800 TokenA for TokenB
        console.log();
        console.log(`--> After swap ${swap_amount} tokenA for tokenB`);
        amountAtaA = parseInt(await getBalance(ataA.address));
        amountAtaB = parseInt(await getBalance(ataB.address));
        console.log(
            `- Exchange rate: 1 TokenA = ${amountAtaA / amountAtaB} TokenB`
        );
        console.log("- SOL (Solarpool): ", await getSOL(solarPDA));
        console.log("- TokenA balance (Solarpool): ", amountAtaA);
        console.log("- TokenB balance (Solarpool): ", amountAtaB);
        console.log("- SOL (User): ", await getSOL(user.publicKey));
        console.log(
            "- TokenA balance (User): ",
            await getBalance(userAtaA.address)
        );
        console.log(
            "- TokenB balance (User): ",
            await getBalance(userAtaB.address)
        );
        console.log(
            "- TokenA balance (Fee): ",
            await getBalance(feeAtaA.address)
        );
        console.log(
            "- TokenB balance (Fee): ",
            await getBalance(feeAtaB.address)
        );

        // Swap 2000 TokenB for TokenA
        const swap_amount2 = 2000;

        const swap2Sig = await program.methods
            .swap(new anchor.BN(swap_amount2))
            .accounts({
                pool: solarPDA,
                feeAtaSource: feeAtaB.address,
                poolAtaSource: ataB.address,
                poolAtaDestination: ataA.address,
                ataSource: userAtaB.address,
                ataDestination: userAtaA.address,
                user: user.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([user])
            .rpc();

        await provider.connection.confirmTransaction(
            {
                signature: swap2Sig,
                blockhash: latestBlockHash.blockhash,
                lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
            },
            "confirmed"
        );

        // Check results of swapping 2000 TokenB for TokenA
        console.log();
        console.log(`--> After swap ${swap_amount2} tokenB for tokenA`);
        amountAtaA = parseInt(await getBalance(ataA.address));
        amountAtaB = parseInt(await getBalance(ataB.address));
        console.log(
            `- Exchange rate: 1 TokenA = ${amountAtaA / amountAtaB} TokenB`
        );
        console.log("- SOL (Solarpool): ", await getSOL(solarPDA));
        console.log("- TokenA balance (Solarpool): ", amountAtaA);
        console.log("- TokenB balance (Solarpool): ", amountAtaB);
        console.log("- SOL (User): ", await getSOL(user.publicKey));
        console.log(
            "- TokenA balance (User): ",
            await getBalance(userAtaA.address)
        );
        console.log(
            "- TokenB balance (User): ",
            await getBalance(userAtaB.address)
        );
        console.log(
            "- TokenA balance (Fee): ",
            await getBalance(feeAtaA.address)
        );
        console.log(
            "- TokenB balance (Fee): ",
            await getBalance(feeAtaB.address)
        );
    });
});
