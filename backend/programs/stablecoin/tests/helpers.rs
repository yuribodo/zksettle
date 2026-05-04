use anchor_lang::prelude::Pubkey;
use litesvm::LiteSVM;
use solana_instruction::Instruction;
use solana_keypair::Keypair;
use solana_message::Message;
use solana_signer::Signer;
use solana_transaction::Transaction;

#[allow(unused_imports)]
pub use stablecoin::test_helpers::{
    accept_admin_ix, approve_redemption_ix, cancel_pending_admin_ix, cancel_redemption_ix,
    escrow_authority_pda, freeze_account_ix, freeze_authority_pda, initialize_mint_ix,
    mint_authority_pda, mint_tokens_ix, pause_ix, propose_admin_ix, redemption_pda,
    request_redemption_ix, set_operator_ix, thaw_account_ix, treasury_pda, unpause_ix,
    update_mint_cap_ix,
};

pub const ANCHOR_ERROR_CODE_OFFSET: u32 = 6000;

pub fn create_mint_account_ix(payer: &Pubkey, mint: &Pubkey) -> Vec<Instruction> {
    use anchor_lang::solana_program::program_pack::Pack;
    use spl_token_2022::state::Mint as SplMint;

    let space = SplMint::LEN;
    let rent = anchor_lang::solana_program::rent::Rent::default();

    let create_ix = anchor_lang::solana_program::system_instruction::create_account(
        payer,
        mint,
        rent.minimum_balance(space),
        space as u64,
        &spl_token_2022::ID,
    );

    vec![create_ix]
}

pub fn create_token_account_ix(
    payer: &Pubkey,
    account: &Pubkey,
    mint: &Pubkey,
    owner: &Pubkey,
) -> Vec<Instruction> {
    use anchor_lang::solana_program::program_pack::Pack;
    use spl_token_2022::state::Account as TokenAccountState;

    let space = TokenAccountState::LEN;
    let rent = anchor_lang::solana_program::rent::Rent::default();

    let create_ix = anchor_lang::solana_program::system_instruction::create_account(
        payer,
        account,
        rent.minimum_balance(space),
        space as u64,
        &spl_token_2022::ID,
    );

    let init_ix = spl_token_2022::instruction::initialize_account3(
        &spl_token_2022::ID,
        account,
        mint,
        owner,
    )
    .unwrap();

    vec![create_ix, init_ix]
}

pub fn read_redemption_request(svm: &LiteSVM, treasury: &Pubkey, holder: &Pubkey, nonce: u64) -> stablecoin::state::RedemptionRequest {
    use anchor_lang::AccountDeserialize;
    let (pda, _) = redemption_pda(treasury, holder, nonce);
    let account = svm.get_account(&pda).expect("redemption request account not found");
    let mut data: &[u8] = &account.data;
    stablecoin::state::RedemptionRequest::try_deserialize(&mut data).expect("failed to deserialize redemption request")
}

pub fn read_treasury(svm: &LiteSVM, mint: &Pubkey) -> stablecoin::state::Treasury {
    use anchor_lang::AccountDeserialize;
    let (treasury_key, _) = treasury_pda(mint);
    let account = svm.get_account(&treasury_key).expect("treasury account not found");
    let mut data: &[u8] = &account.data;
    stablecoin::state::Treasury::try_deserialize(&mut data).expect("failed to deserialize treasury")
}

pub struct TestEnv {
    pub svm: LiteSVM,
    pub admin: Keypair,
    pub mint_kp: Keypair,
}

pub fn setup() -> TestEnv {
    let mut svm = LiteSVM::new();

    let so_path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../target/deploy/stablecoin.so");
    let program_bytes = std::fs::read(so_path)
        .expect("stablecoin.so not found — run `anchor build` first");
    svm.add_program(stablecoin::ID, &program_bytes).unwrap();

    let admin = Keypair::new();
    svm.airdrop(&admin.pubkey(), 100_000_000_000).unwrap();

    let mint_kp = Keypair::new();

    let create_ixs = create_mint_account_ix(&admin.pubkey(), &mint_kp.pubkey());
    let init_ix = initialize_mint_ix(&admin.pubkey(), &mint_kp.pubkey(), 6);

    let mut ixs = create_ixs;
    ixs.push(init_ix);

    let tx = Transaction::new(
        &[&admin, &mint_kp],
        Message::new(&ixs, Some(&admin.pubkey())),
        svm.latest_blockhash(),
    );
    svm.send_transaction(tx).expect("initialize_mint should succeed");

    TestEnv { svm, admin, mint_kp }
}

pub struct TestEnvWithToken {
    pub svm: LiteSVM,
    pub admin: Keypair,
    pub mint_kp: Keypair,
    pub token_kp: Keypair,
}

pub fn setup_with_token_account() -> TestEnvWithToken {
    let TestEnv { mut svm, admin, mint_kp } = setup();
    let token_kp = Keypair::new();
    let create_ixs = create_token_account_ix(
        &admin.pubkey(),
        &token_kp.pubkey(),
        &mint_kp.pubkey(),
        &admin.pubkey(),
    );
    send_tx(&mut svm, &create_ixs, &admin, &[&admin, &token_kp]).unwrap();
    TestEnvWithToken { svm, admin, mint_kp, token_kp }
}

pub fn setup_with_funded_token(amount: u64) -> TestEnvWithToken {
    let mut env = setup_with_token_account();
    let ix = mint_tokens_ix(
        &env.admin.pubkey(),
        &env.mint_kp.pubkey(),
        &env.token_kp.pubkey(),
        amount,
    );
    send_tx(&mut env.svm, &[ix], &env.admin, &[&env.admin]).unwrap();
    env
}

pub fn send_tx(
    svm: &mut LiteSVM,
    ixs: &[Instruction],
    payer: &Keypair,
    signers: &[&Keypair],
) -> litesvm::types::TransactionResult {
    let msg = Message::new(ixs, Some(&payer.pubkey()));
    let tx = Transaction::new(signers, msg, svm.latest_blockhash());
    let result = svm.send_transaction(tx);
    svm.expire_blockhash();
    result
}

pub fn assert_anchor_error(
    result: litesvm::types::TransactionResult,
    expected_code: u32,
) {
    use solana_instruction::error::InstructionError;
    use solana_transaction_error::TransactionError;

    let err = result.expect_err("expected transaction to fail");
    match err.err {
        TransactionError::InstructionError(_, InstructionError::Custom(code)) => {
            assert_eq!(
                code, expected_code,
                "expected error code {expected_code}, got {code}"
            );
        }
        other => panic!("expected InstructionError::Custom, got {other:?}"),
    }
}
