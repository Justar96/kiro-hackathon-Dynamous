# Thesis - Product Overview

Thesis is a prediction market platform combining structured debates with on-chain trading.

## Core Concept

Users participate in debates on resolutions (yes/no questions), with market prices reflecting collective belief in outcomes. The platform bridges off-chain debate mechanics with on-chain settlement via Gnosis Conditional Tokens Framework (CTF).

## Key Features

- **Debates**: 3-round structured debates (opening → rebuttal → closing) between support/oppose sides
- **Stance Voting**: Users record pre/post debate stances to measure persuasion
- **Prediction Markets**: Binary outcome markets with YES/NO tokens
- **Reputation System**: Tracks persuasion skill, prediction accuracy, and participation quality
- **On-Chain Settlement**: Merkle-based batch settlement for gas-efficient withdrawals

## User Flows

1. **Debaters**: Create resolutions, join as support/oppose, submit arguments within character limits
2. **Spectators**: Vote on stances, react to arguments, comment on debates
3. **Traders**: Buy/sell outcome tokens via central limit order book
4. **Settlement**: Claim winnings via Merkle proofs after market resolution

## Target Chain

Polygon (mainnet and Amoy testnet) with USDC as collateral token.
