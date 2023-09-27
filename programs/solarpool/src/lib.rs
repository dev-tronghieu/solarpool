use anchor_lang::prelude::*;

declare_id!("GUkh3LZRi1YrxCmJSrhRkj8rGKDxMKq1xJLWeMziHirj");

#[program]
pub mod solarpool {
    use anchor_lang::solana_program::system_instruction;

    use super::*;
    pub fn transfer_lamports(ctx: Context<TransferLamports>, amount: u64) -> Result<()> {
        let from_account = &ctx.accounts.from;
        let to_account = &ctx.accounts.to;

        // Create the transfer instruction
        let transfer_instruction =
            system_instruction::transfer(from_account.key, to_account.key, amount);

        // Invoke the transfer instruction
        anchor_lang::solana_program::program::invoke_signed(
            &transfer_instruction,
            &[
                from_account.to_account_info(),
                to_account.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[],
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct TransferLamports<'info> {
    #[account(mut)]
    pub from: Signer<'info>,
    #[account(mut)]
    /// CHECK: The `to` is just a recipient account
    pub to: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}
