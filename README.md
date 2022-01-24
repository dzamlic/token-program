<p align="center">
  <a href="https://solana.com">
    <img alt="Solana" src="https://i.imgur.com/uBVzyX3.png" width="250" />
  </a>
</p>

# About the program

Program create and mint token, transfer token from one address to another
https://spl.solana.com/token

After first mint is done, dont forget to replace dummy with mint id

Program written in rust counts trensfer calls


# Quick Start

The following dependencies are required to build and run this example, depending
on your OS, they may already be installed:

- Install node (v14 recommended)
- Install npm
- Install Rust v1.56.1 or later from https://rustup.rs/
- Install Solana v1.8.2 or later from
  https://docs.solana.com/cli/install-solana-cli-tools


## Start local Solana cluster

This example connects to a local Solana cluster by default.

Start a local Solana cluster:
```bash
solana-test-validator
```
> **Note**: You may need to do some [system tuning](https://docs.solana.com/running-validator/validator-start#system-tuning) (and restart your computer) to get the validator to run

Listen to transaction logs:
```bash
solana logs
```

## Install npm dependencies

```bash
npm install
```

## Deploy the on-chain program

```bash
solana program deploy --program-id dist/program/to-wallet-keypair.json dist/program/token_program.so
```

## Run the JavaScript client

```bash
npm run start
```

## Build rust program

```bash
npm run build:program
```

## Run test for the rust program

```bash
cargo test
```

