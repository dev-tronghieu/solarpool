# Solarpool Test cases

```ts
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
```

```ts
it("Transfer SPL", async () => {
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
        await program.provider.connection.getTokenAccountBalance(fromAtaTokenA);
    const toTokenABalance =
        await program.provider.connection.getTokenAccountBalance(toAtaTokenA);

    assert.equal(
        fromTokenABalance.value.uiAmount,
        mintAmount - amountToTransfer
    );

    assert.equal(toTokenABalance.value.uiAmount, amountToTransfer);
});
```
