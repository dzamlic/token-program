/**
 * Token Program
 */

import {
  establishConnection,
  establishPayer,
  checkProgram,
  create_reward_pool,
  reward_lp_tokens
} from './token_program';

async function main() {

  // Establish connection to the cluster
  await establishConnection();

  // Determine who pays for the fees
  await establishPayer();

  // Check if the program has been deployed
  await checkProgram();

  //Play with solana tokens
  await create_reward_pool();

  //This function should mint LP tokens for a stake
  await reward_lp_tokens();

}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);
