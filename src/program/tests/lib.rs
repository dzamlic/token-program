use borsh::BorshDeserialize;
use token_program::{process_instruction, TokenProgram};
use solana_program_test::*;
use solana_sdk::{
    account::Account,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::Signer,
    transaction::Transaction,
};
use std::mem;

#[tokio::test]
async fn test_token_program() {
    let program_id = Pubkey::new_unique();
    let token_pubkey = Pubkey::new_unique();

    let mut program_test = ProgramTest::new(
        "token_program", // Run the BPF version with `cargo test`
        program_id,
        processor!(process_instruction), // Run the native version with `cargo test`
    );
    program_test.add_account(
        token_pubkey,
        Account {
            lamports: 5,
            data: vec![0_u8; mem::size_of::<u32>()],
            owner: program_id,
            ..Account::default()
        },
    );
    let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

    // Verify account has zero transfers
    let token_account = banks_client
        .get_account(token_pubkey)
        .await
        .expect("get_account")
        .expect("token_account not found");
    assert_eq!(
        TokenProgram::try_from_slice(&token_account.data)
            .unwrap()
            .counter,
        0
    );

    // Transferred once
    let mut transaction = Transaction::new_with_payer(
        &[Instruction::new_with_bincode(
            program_id,
            &[0], // ignored but makes the instruction unique in the slot
            vec![AccountMeta::new(token_pubkey, false)],
        )],
        Some(&payer.pubkey()),
    );
    transaction.sign(&[&payer], recent_blockhash);
    banks_client.process_transaction(transaction).await.unwrap();

    // Verify account
    let token_account = banks_client
        .get_account(token_pubkey)
        .await
        .expect("get_account")
        .expect("token_account not found");
    assert_eq!(
        TokenProgram::try_from_slice(&token_account.data)
            .unwrap()
            .counter,
        1
    );

    // Transferred again
    let mut transaction = Transaction::new_with_payer(
        &[Instruction::new_with_bincode(
            program_id,
            &[1], // ignored but makes the instruction unique in the slot
            vec![AccountMeta::new(token_pubkey, false)],
        )],
        Some(&payer.pubkey()),
    );
    transaction.sign(&[&payer], recent_blockhash);
    banks_client.process_transaction(transaction).await.unwrap();

    // Verify accounts
    let token_account = banks_client
        .get_account(token_pubkey)
        .await
        .expect("get_account")
        .expect("token_account not found");
    assert_eq!(
        TokenProgram::try_from_slice(&token_account.data)
            .unwrap()
            .counter,
        2
    );
}
