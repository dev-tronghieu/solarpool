use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

declare_id!("GUkh3LZRi1YrxCmJSrhRkj8rGKDxMKq1xJLWeMziHirj");

#[program]
pub mod solarpool {
    use anchor_spl::token::{self, Transfer};

    use super::*;

    pub fn create_solarpool(
        ctx: Context<CreateSolarpool>,
        bump: u8,
        fee_rate: f64,
        mint_pool: Pubkey,
        mint_a: Pubkey,
        mint_b: Pubkey,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.bump = bump;
        pool.owner = *ctx.accounts.owner.key;
        pool.mint_pool = mint_pool;
        pool.mint_a = mint_a;
        pool.mint_b = mint_b;
        pool.fee_account = *ctx.accounts.fee_account.to_account_info().key;
        pool.fee_rate = fee_rate;
        let ata_pool = &mut ctx.accounts.ata_pool;
        let ata_a = &mut ctx.accounts.ata_a;
        let ata_b = &mut ctx.accounts.ata_b;
        pool.ata_pool = *ata_pool.to_account_info().key;
        pool.ata_a = *ata_a.to_account_info().key;
        pool.ata_b = *ata_b.to_account_info().key;
        pool.constant_product = ata_a.amount * ata_b.amount;

        println!("Solarpool created");

        Ok(())
    }

    pub fn swap(ctx: Context<Swap>, amount: u64) -> Result<()> {
        let pool = &ctx.accounts.pool;
        let fee_ata_source = &mut ctx.accounts.fee_ata_source;
        let pool_ata_source = &mut ctx.accounts.pool_ata_source;
        let pool_ata_destination = &mut ctx.accounts.pool_ata_destination;
        let ata_source = &mut ctx.accounts.ata_source;
        let ata_destination = &mut ctx.accounts.ata_destination;
        let user = &ctx.accounts.user;
        let token_program = &ctx.accounts.token_program;

        let fee = ((amount as f64) * pool.fee_rate).round() as u64;
        let send_amount = amount - fee;

        // Constant Product AMMs
        let receive_amount = pool_ata_destination.amount
            - (pool.constant_product / (pool_ata_source.amount + send_amount));

        // Transfer fee token from user source to fee account
        let cpi_accounts = Transfer {
            from: ata_source.to_account_info().clone(),
            to: fee_ata_source.to_account_info().clone(),
            authority: user.to_account_info().clone(),
        };
        let cpi_program = token_program.to_account_info();
        token::transfer(CpiContext::new(cpi_program, cpi_accounts), fee)?;

        // Transfer from user source to pool ata
        let cpi_accounts = Transfer {
            from: ata_source.to_account_info().clone(),
            to: pool_ata_source.to_account_info().clone(),
            authority: user.to_account_info().clone(),
        };
        let cpi_program = token_program.to_account_info();
        token::transfer(CpiContext::new(cpi_program, cpi_accounts), send_amount)?;

        // Transfer from pool ata to user destination
        let cpi_accounts = Transfer {
            from: pool_ata_destination.to_account_info().clone(),
            to: ata_destination.to_account_info().clone(),
            authority: pool.to_account_info().clone(),
        };
        let cpi_program = token_program.to_account_info();
        token::transfer(
            CpiContext::new_with_signer(
                cpi_program,
                cpi_accounts,
                &[&[&b"solarpool"[..], &pool.owner.to_bytes(), &[pool.bump]]],
            ),
            receive_amount,
        )?;

        Ok(())
    }
}

#[account]
pub struct LiquidityPool {
    pub owner: Pubkey,
    pub fee_account: Pubkey,
    pub fee_rate: f64,
    pub constant_product: u64,
    pub mint_pool: Pubkey,
    pub mint_a: Pubkey,
    pub mint_b: Pubkey,
    pub ata_pool: Pubkey,
    pub ata_a: Pubkey,
    pub ata_b: Pubkey,
    pub bump: u8,
}

impl LiquidityPool {
    pub fn get_size() -> usize {
        32 + 32 + 32 + 32 + 32 + 32 + 32 + 32 + 32 + 1
    }
}

#[derive(Accounts)]
pub struct CreateSolarpool<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: `fee_account` is just a recipient account
    pub fee_account: UncheckedAccount<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + LiquidityPool::get_size(),
        seeds = [b"solarpool".as_ref(), owner.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, LiquidityPool>,
    #[account(constraint = ata_pool.owner == pool.key())]
    pub ata_pool: Account<'info, TokenAccount>,
    #[account(constraint = ata_a.owner == pool.key())]
    pub ata_a: Account<'info, TokenAccount>,
    #[account(constraint = ata_b.owner == pool.key())]
    pub ata_b: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut, seeds=[b"solarpool".as_ref(), pool.owner.as_ref()], bump=pool.bump)]
    pub pool: Account<'info, LiquidityPool>,
    #[account(mut, constraint = fee_ata_source.owner == pool.fee_account && fee_ata_source.mint == ata_source.mint)]
    pub fee_ata_source: Account<'info, TokenAccount>,
    #[account(mut, constraint = pool_ata_source.owner == pool.key() && pool_ata_source.mint == ata_source.mint)]
    pub pool_ata_source: Account<'info, TokenAccount>,
    #[account(mut, constraint = pool_ata_destination.owner == pool.key() && pool_ata_destination.mint == ata_destination.mint)]
    pub pool_ata_destination: Account<'info, TokenAccount>,
    pub user: Signer<'info>,
    #[account(mut, constraint = ata_source.owner == user.key())]
    pub ata_source: Account<'info, TokenAccount>,
    #[account(mut, constraint = ata_destination.owner == user.key())]
    pub ata_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}
