import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Solarpool } from "../target/types/solarpool";
import { assert } from "chai";
import {
    TOKEN_PROGRAM_ID,
    createAssociatedTokenAccount,
    createMint,
    mintTo,
} from "@solana/spl-token";

describe("solarpool", async () => {
    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());

    const program = anchor.workspace.Solarpool as Program<Solarpool>;

    const systemProgram = anchor.web3.SystemProgram.programId;

    const fromPrivkey = Uint8Array.from([
        4, 2, 166, 126, 90, 195, 29, 55, 156, 126, 154, 128, 225, 119, 55, 254,
        166, 102, 162, 91, 239, 131, 134, 27, 31, 71, 162, 8, 88, 87, 206, 221,
        133, 95, 225, 202, 233, 61, 166, 53, 236, 36, 135, 152, 95, 152, 207,
        194, 248, 76, 210, 22, 164, 108, 93, 111, 241, 201, 67, 22, 158, 98,
        214, 236,
    ]);
    const from = anchor.web3.Keypair.fromSecretKey(fromPrivkey);
    console.log("--> Your wallet address", from.publicKey.toBase58());

    const to = anchor.web3.Keypair.generate();
    console.log("--> Recipient wallet address", to.publicKey.toBase58());

    // Create SPL token accounts for the two users
    const createMintToken = async (
        payer: anchor.web3.Keypair,
        authority: anchor.web3.PublicKey
    ) => {
        const mint = await createMint(
            program.provider.connection,
            payer,
            authority,
            null,
            0
        );
        return mint;
    };
    const mintTokenA = await createMintToken(from, from.publicKey);
    const fromAtaTokenA = await createAssociatedTokenAccount(
        program.provider.connection,
        from,
        mintTokenA,
        from.publicKey
    );
    const toAtaTokenA = await createAssociatedTokenAccount(
        program.provider.connection,
        to,
        mintTokenA,
        to.publicKey
    );

    it("Transfer SOL", async () => {
        await program.methods
            .transferLamports(new anchor.BN(anchor.web3.LAMPORTS_PER_SOL))
            .accounts({
                from: from.publicKey,
                to: to.publicKey,
                systemProgram: systemProgram,
            })
            .signers([from])
            .rpc();

        assert.equal(
            await program.provider.connection.getBalance(to.publicKey),
            anchor.web3.LAMPORTS_PER_SOL
        );
    });

    it("Transfer SPL", async () => {
        const mintAmount = 1000;
        await mintTo(
            program.provider.connection,
            from,
            mintTokenA,
            fromAtaTokenA,
            from.publicKey,
            mintAmount
        );

        const amountToTransfer = 100;

        await program.methods
            .transferSplTokens(new anchor.BN(amountToTransfer))
            .accounts({
                from: from.publicKey,
                fromAta: fromAtaTokenA,
                toAta: toAtaTokenA,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([from])
            .rpc();

        const fromTokenABalance =
            await program.provider.connection.getTokenAccountBalance(
                fromAtaTokenA
            );
        const toTokenABalance =
            await program.provider.connection.getTokenAccountBalance(
                toAtaTokenA
            );

        assert.equal(
            fromTokenABalance.value.uiAmount,
            mintAmount - amountToTransfer
        );

        assert.equal(toTokenABalance.value.uiAmount, amountToTransfer);
    });
});
