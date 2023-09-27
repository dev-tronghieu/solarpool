import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Solarpool } from "../target/types/solarpool";

describe("solarpool", () => {
    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());

    const program = anchor.workspace.Solarpool as Program<Solarpool>;

    const fromPrivkey = Uint8Array.from([
        4, 2, 166, 126, 90, 195, 29, 55, 156, 126, 154, 128, 225, 119, 55, 254,
        166, 102, 162, 91, 239, 131, 134, 27, 31, 71, 162, 8, 88, 87, 206, 221,
        133, 95, 225, 202, 233, 61, 166, 53, 236, 36, 135, 152, 95, 152, 207,
        194, 248, 76, 210, 22, 164, 108, 93, 111, 241, 201, 67, 22, 158, 98,
        214, 236,
    ]);
    const from = anchor.web3.Keypair.fromSecretKey(fromPrivkey);
    const to = anchor.web3.Keypair.generate();
    const systemProgram = anchor.web3.SystemProgram.programId;

    it("Transfer SOL", async () => {
        console.log("--> Your wallet address", from.publicKey.toBase58());
        console.log(
            "--> Balance before airdrop",
            await program.provider.connection.getBalance(from.publicKey)
        );

        const tx = await program.methods
            .transferLamports(new anchor.BN(anchor.web3.LAMPORTS_PER_SOL))
            .accounts({
                from: from.publicKey,
                to: to.publicKey,
                systemProgram: systemProgram,
            })
            .signers([from])
            .rpc();
        console.log("--> Your transaction signature", tx);

        console.log(
            "--> Balance after airdrop",
            await program.provider.connection.getBalance(from.publicKey)
        );
    });
});
