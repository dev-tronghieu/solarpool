use anchor_lang::prelude::Pubkey;

use crate::LiquidityPool;

pub enum TransferDirection {
    AtoB,
    BtoA,
}

impl TransferDirection {
    pub fn new(pool: &LiquidityPool, source_mint: &Pubkey, dest_mint: &Pubkey) -> Self {
        match (source_mint, dest_mint) {
            (ata_source, ata_destination)
                if ata_source == &pool.mint_a && ata_destination == &pool.mint_b =>
            {
                TransferDirection::AtoB
            }
            (ata_source, ata_destination)
                if ata_source == &pool.mint_b && ata_destination == &pool.mint_a =>
            {
                TransferDirection::BtoA
            }
            _ => panic!("Invalid transfer direction"),
        }
    }
}
