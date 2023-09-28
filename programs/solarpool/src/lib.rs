mod helpers;
use anchor_lang::prelude::{borsh::de, *};
use anchor_spl::token::{Token, TokenAccount};

declare_id!("GUkh3LZRi1YrxCmJSrhRkj8rGKDxMKq1xJLWeMziHirj");

#[program]
pub mod solarpool {
    use anchor_lang::solana_program::system_instruction;
    use anchor_spl::token::{self, Transfer};

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

    pub fn transfer_spl_tokens(ctx: Context<TransferSpl>, amount: u64) -> Result<()> {
        let authority = &ctx.accounts.from;
        let source = &ctx.accounts.from_ata;
        let destination = &ctx.accounts.to_ata;
        let token_program = &ctx.accounts.token_program;

        // Transfer tokens from taker to initializer
        let cpi_accounts = Transfer {
            from: source.to_account_info().clone(),
            to: destination.to_account_info().clone(),
            authority: authority.to_account_info().clone(),
        };
        let cpi_program = token_program.to_account_info();

        token::transfer(CpiContext::new(cpi_program, cpi_accounts), amount)?;
        Ok(())
    }

    pub fn create_solarpool(
        ctx: Context<CreateSolarpool>,
        mint_pool: Pubkey,
        mint_a: Pubkey,
        mint_b: Pubkey,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.owner = *ctx.accounts.owner.key;
        pool.mint_pool = mint_pool;
        pool.mint_a = mint_a;
        pool.mint_b = mint_b;
        let ata_pool = &mut ctx.accounts.ata_pool;
        let ata_a = &mut ctx.accounts.ata_a;
        let ata_b = &mut ctx.accounts.ata_b;
        pool.ata_pool = *ata_pool.to_account_info().key;
        pool.ata_a = *ata_a.to_account_info().key;
        pool.ata_b = *ata_b.to_account_info().key;

        println!("Solarpool created");

        Ok(())
    }

    pub fn swap(ctx: Context<Swap>, amount: u64) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        let ata_source = &mut ctx.accounts.ata_source;
        let ata_destination = &mut ctx.accounts.ata_destination;
        let user = &ctx.accounts.user;
        let token_program = &ctx.accounts.token_program;

        let transfer_direction =
            helpers::TransferDirection::new(&pool, &ata_source.mint, &ata_destination.mint);

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

#[derive(Accounts)]
pub struct TransferSpl<'info> {
    pub from: Signer<'info>,
    #[account(mut)]
    pub from_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub to_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct LiquidityPool {
    pub owner: Pubkey,
    pub mint_pool: Pubkey,
    pub mint_a: Pubkey,
    pub mint_b: Pubkey,
    pub ata_pool: Pubkey,
    pub ata_a: Pubkey,
    pub ata_b: Pubkey,
}

impl LiquidityPool {
    pub fn get_size() -> usize {
        32 + 32 + 32 + 32 + 32 + 32 + 32
    }
}

#[derive(Accounts)]
pub struct CreateSolarpool<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + LiquidityPool::get_size(),
        seeds = [b"solarpool".as_ref(), owner.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, LiquidityPool>,
    pub ata_pool: Account<'info, TokenAccount>,
    pub ata_a: Account<'info, TokenAccount>,
    pub ata_b: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,
    #[account(mut)]
    pub ata_source: Account<'info, TokenAccount>,
    #[account(mut)]
    pub ata_destination: Account<'info, TokenAccount>,
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}
