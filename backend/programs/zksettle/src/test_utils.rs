#![cfg(test)]

use anchor_lang::prelude::*;

pub fn err_code<T: std::fmt::Debug>(r: Result<T>) -> u32 {
    match r {
        Err(anchor_lang::error::Error::AnchorError(e)) => e.error_code_number,
        other => panic!("expected AnchorError, got {other:?}"),
    }
}
