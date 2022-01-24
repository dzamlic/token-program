/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  Keypair,
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
  clusterApiUrl,
} from '@solana/web3.js';
import {
  Token,
  TOKEN_PROGRAM_ID,
  AccountInfo,
} from '@solana/spl-token';
import fs from 'mz/fs';
import path from 'path';
import * as borsh from 'borsh';

import { createKeypairFromFile} from './utils';


/**
 * Connection to the network
 */
let connection: Connection;

/**
 * Token program id
 */
let programId: PublicKey;

/**
 * The public key of the token account 
 */
 let tokenPubkey: PublicKey;

/**
 * Keypair associated to the fees' payer
 */
 let payer: Keypair;

 /**
 * Mint token only first time
 */
let mint:  Token;

let fromTokenProgram: AccountInfo;
let toTokenProgram: AccountInfo;

/**
 * Path to program files
 */
const PROGRAM_PATH = path.resolve(__dirname, '../../dist/program');

/**
 * Path to program shared object file which should be deployed on chain.
 * This file is created when running either:
 *   `npm run build:program`
 */
const PROGRAM_SO_PATH = path.join(PROGRAM_PATH, 'token_program.so');

/**
 * Path to the keypair of the deployed program.
 * This file is created when running `solana program deploy dist/program/token_program.so`
 */
//const FROM_WALLET = path.join(PROGRAM_PATH, 'from-wallet-keypair.json');
const TO_WALLET = path.join(PROGRAM_PATH, 'to-wallet-keypair.json');
const DEFAULT_WALLET = path.join(PROGRAM_PATH, 'default-keypair.json');

/**
 * The state of a token account managed by the token program
 */
 class TokenProgram {
  counter = 0;
  constructor(fields: {counter: number} | undefined = undefined) {
    if (fields) {
      this.counter = fields.counter;
    }
  }
}

/**
 * Borsh schema definition for token accounts
 */
const TokenSchema = new Map([
  [TokenProgram, {kind: 'struct', fields: [['counter', 'u32']]}],
]);

/**
 * The expected size of each token account.
 */
const TOKEN_SIZE = borsh.serialize(
  TokenSchema,
  new TokenProgram(),
).length;

/**
 * Establish a connection to the cluster
 */
 export async function establishConnection(): Promise<void> {
  connection = new Connection(clusterApiUrl("devnet"),'confirmed',);
  const version = await connection.getVersion();
  console.log('Connection to cluster established:', version);
}

/**
 * Establish an account to pay for everything
 */
 export async function establishPayer(): Promise<void> {
  let fees = 0;
  if (!payer) {
    const {feeCalculator} = await connection.getRecentBlockhash();

    // Calculate the cost to fund the token account
    fees += await connection.getMinimumBalanceForRentExemption(TOKEN_SIZE);

    // Calculate the cost of sending transactions
    fees += feeCalculator.lamportsPerSignature * 100; // wag

    payer = await createKeypairFromFile(DEFAULT_WALLET);
  }

  let lamports = await connection.getBalance(payer.publicKey);
  if (lamports < fees) {
    // If current balance is not enough to pay for fees, request an airdrop
    const sig = await connection.requestAirdrop(
      payer.publicKey,
      100000,
    );
    await connection.confirmTransaction(sig);
    lamports = await connection.getBalance(payer.publicKey);
  }

  console.log(
    'Using account',
    payer.publicKey.toBase58(),
    'containing',
    lamports / LAMPORTS_PER_SOL,
    'SOL to pay for, fees cost is',
    fees / LAMPORTS_PER_SOL,
    'SOL',
  );
}

/**
 * Check if the token program has been deployed
 */
export async function checkProgram(): Promise<void> {
  // Read program id from keypair file
  try {
    const programKeypair = await createKeypairFromFile(TO_WALLET);
    programId = programKeypair.publicKey;
  } catch (err) {
    const errMsg = (err as Error).message;
    throw new Error(
      `Failed to read program keypair at '${TO_WALLET}' due to error: ${errMsg}. Program may need to be deployed with \`solana program deploy dist/program/token_program.so\``,
    );
  }

  // Check if the program has been deployed
  const programInfo = await connection.getAccountInfo(programId);
  if (programInfo === null) {
    if (fs.existsSync(PROGRAM_SO_PATH)) {
      throw new Error(
        'Program needs to be deployed with `solana program deploy dist/program/token_program.so`',
      );
    } else {
      throw new Error('Program needs to be built and deployed');
    }
  } else if (!programInfo.executable) {
    throw new Error(`Program is not executable`);
  }
  console.log(`Using program ${programId.toBase58()}`);

    // Derive the address (public key) of a token account from the program so that it's easy to find later.
    const TOKEN_SEED = 'token';
    tokenPubkey = await PublicKey.createWithSeed(
      payer.publicKey,
      TOKEN_SEED,
      programId,
    );
  
    // Check if the token account has already been created
    const tokenAccount = await connection.getAccountInfo(tokenPubkey);
    if (tokenAccount === null) {
      console.log(
        'Creating account',
        tokenPubkey.toBase58(),
      );
      const lamports = await connection.getMinimumBalanceForRentExemption(
        TOKEN_SIZE,
      );
  
      const transaction = new Transaction().add(
        SystemProgram.createAccountWithSeed({
          fromPubkey: payer.publicKey,
          basePubkey: payer.publicKey,
          seed: TOKEN_SEED,
          newAccountPubkey: tokenPubkey,
          lamports,
          space: TOKEN_SIZE,
          programId,
        }),
      );
      await sendAndConfirmTransaction(connection, transaction, [payer]);
    }
}

/**
 * Pool function
 */
 export async function create_reward_pool(): Promise<void> {

  // Construct wallet keypairs
  var fromWallet =  await createKeypairFromFile(DEFAULT_WALLET);
  var toWallet = await createKeypairFromFile(TO_WALLET);

  
  const instruction = new TransactionInstruction({
    keys: [{pubkey: tokenPubkey, isSigner: false, isWritable: true}],
    programId,
    data: Buffer.alloc(0), 
  });
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payer],
  );

  const accountInfo = await connection.getAccountInfo(tokenPubkey);
  if (accountInfo === null) {
    throw 'Error: cannot find the token account';
  }
  const transfer = borsh.deserialize(
    TokenSchema,
    TokenProgram,
    accountInfo.data,
  );
  console.log(
    'Tokens was transferred on',
    tokenPubkey.toBase58(),
    transfer.counter,
    'time(s)',
  );

  //First time minting token
  if(transfer.counter == 0)
  {
    // Create new token mint
    mint = await Token.createMint(
      connection,
      fromWallet,
      fromWallet.publicKey,
      null,
      1,
      TOKEN_PROGRAM_ID,
    );

    console.log('Token public key',mint.publicKey.toBase58())

    // Get the token account of the fromWallet Solana address, if it does not exist, create it
    fromTokenProgram = await mint.getOrCreateAssociatedAccountInfo(
      fromWallet.publicKey,
    );

    //get the token account of the toWallet Solana address, if it does not exist, create it
    toTokenProgram = await mint.getOrCreateAssociatedAccountInfo(
      toWallet.publicKey,
    );
    
    // Minting 1 new token to the "fromTokenProgram" account we just returned/created
    await mint.mintTo(
      fromTokenProgram.address,
      fromWallet.publicKey,
      [],
      10000,
    );
  }
  //After token was created use public key of that token
  else{
    const key = new PublicKey('dummy');//replace dummy with Token public key
    mint = new Token(connection,key,TOKEN_PROGRAM_ID,fromWallet);
    
    // Get the token account of the fromWallet Solana address, if it does not exist, create it
    fromTokenProgram = await mint.getOrCreateAssociatedAccountInfo(
      fromWallet.publicKey,
    );

    //get the token account of the toWallet Solana address, if it does not exist, create it
    toTokenProgram = await mint.getOrCreateAssociatedAccountInfo(
      toWallet.publicKey,
    );
  }

  console.log('From token address', fromTokenProgram.address.toBase58());
  console.log('To token address', toTokenProgram.address.toBase58());

  // Add token transfer instructions to transaction
  const transaction = new Transaction().add(
    Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      fromTokenProgram.address,
      toTokenProgram.address,
      fromWallet.publicKey,
      [],
      5,
    ),
  );

  //console.log('TRANSACTION', transaction);

  // Sign transaction, broadcast, and confirm
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [fromWallet],
    {commitment: 'confirmed'},
  );
  console.log('SIGNATURE', signature);

  console.log('Finished...')
}

/**
 * This function should mint LP tokens for a stake
 */
 export async function reward_lp_tokens(): Promise<void> {
 }


