//! Optional `sol_log_compute_units` probes (feature `hook-cu-probe`).
//! Used on the Token-2022 hook path (ADR-022) and on `verify_proof` after
//! Light + Bubblegum CPIs (ADR-019 CU budgeting).

#[macro_export]
macro_rules! cu_probe {
    ($label:literal) => {
        #[cfg(feature = "hook-cu-probe")]
        {
            anchor_lang::prelude::msg!(concat!("cu-probe ", $label));
            anchor_lang::solana_program::log::sol_log_compute_units();
        }
    };
}
