# Requirements Document

## Introduction

This document specifies the requirements for implementing a Polymarket-style hybrid CLOB (Central Limit Order Book) trading system that combines off-chain order matching with on-chain settlement. The system enables gas-efficient trading of conditional tokens (YES/NO outcome tokens) while maintaining trustless settlement guarantees through the CTFExchange and SettlementVault smart contracts.

The hybrid architecture provides CEX-like trading experience (instant matching, zero gas for orders) with DEX-level security (non-custodial deposits, verifiable settlement proofs).

## Glossary

- **CLOB**: Central Limit Order Book - an order matching system using price-time priority
- **CTF**: Conditional Tokens Framework - Gnosis protocol for creating outcome tokens
- **CTFExchange**: Smart contract that executes EIP-712 signed order settlements
- **SettlementVault**: Smart contract holding user deposits with Merkle-based withdrawals
- **Matching_Engine**: Off-chain service that matches buy/sell orders
- **Settlement_Service**: Backend service that batches trades and commits to blockchain
- **Indexer**: Service that monitors blockchain events and updates off-chain state
- **Off_Chain_Ledger**: In-memory balance tracking for instant order validation
- **Merkle_Proof**: Cryptographic proof of inclusion in a settlement batch
- **EIP_712**: Ethereum typed structured data signing standard
- **Operator**: Authorized address that can execute settlements on CTFExchange
- **Epoch**: A settlement batch period with associated Merkle root
- **Nonce**: Replay protection counter for order signatures

## Requirements

### Requirement 1: Deposit Flow

**User Story:** As a trader, I want to deposit USDC into the trading system, so that I can place orders and trade outcome tokens.

#### Acceptance Criteria

1. WHEN a user calls deposit on SettlementVault with a valid USDC amount, THE SettlementVault SHALL transfer USDC from user and emit a Deposit event
2. WHEN the Indexer detects a Deposit event with sufficient confirmations (20 blocks), THE Indexer SHALL credit the user's Off_Chain_Ledger balance
3. WHEN a deposit is indexed, THE Off_Chain_Ledger SHALL update the user's available balance atomically
4. IF a chain reorganization occurs after indexing a deposit, THEN THE Indexer SHALL revert the Off_Chain_Ledger credit and re-process from the new chain state
5. WHEN querying deposit status, THE System SHALL return the on-chain deposit amount and off-chain credited amount

### Requirement 2: Order Signing and Submission

**User Story:** As a trader, I want to sign orders off-chain and submit them for matching, so that I can trade without paying gas for order placement.

#### Acceptance Criteria

1. WHEN a user creates an order, THE Frontend SHALL construct an EIP_712 typed data structure matching the CTFExchange ORDER_TYPEHASH
2. WHEN a user signs an order, THE Frontend SHALL use the connected wallet to produce an EIP_712 signature
3. WHEN an order is submitted to the backend, THE Order_Service SHALL validate the EIP_712 signature against the signer address
4. WHEN validating an order, THE Order_Service SHALL verify the nonce matches the user's current nonce in Off_Chain_Ledger
5. WHEN validating an order, THE Order_Service SHALL verify the user has sufficient available balance for the order
6. IF order validation fails, THEN THE Order_Service SHALL return a specific error code indicating the failure reason
7. WHEN an order passes validation, THE Order_Service SHALL lock the required balance in Off_Chain_Ledger

### Requirement 3: Order Matching

**User Story:** As a trader, I want my orders matched against the best available prices, so that I can execute trades efficiently.

#### Acceptance Criteria

1. WHEN a valid order is submitted, THE Matching_Engine SHALL attempt to match it against existing orders using price-time priority
2. WHEN a buy order price >= ask price, THE Matching_Engine SHALL execute a trade at the maker's (ask) price
3. WHEN a sell order price <= bid price, THE Matching_Engine SHALL execute a trade at the maker's (bid) price
4. WHEN two buy orders can be matched (prices sum >= $1.00), THE Matching_Engine SHALL flag the trade for MINT settlement
5. WHEN two sell orders can be matched (prices sum <= $1.00), THE Matching_Engine SHALL flag the trade for MERGE settlement
6. WHEN a trade is executed, THE Matching_Engine SHALL update both parties' Off_Chain_Ledger balances immediately
7. WHEN a trade is executed, THE Matching_Engine SHALL queue the trade for batch settlement
8. WHEN an order is partially filled, THE Matching_Engine SHALL keep the remaining quantity in the order book

### Requirement 4: Settlement Batching

**User Story:** As a system operator, I want trades batched for efficient on-chain settlement, so that gas costs are minimized.

#### Acceptance Criteria

1. WHEN pending trades accumulate, THE Settlement_Service SHALL create batches at configurable intervals (default: 60 seconds)
2. WHEN creating a batch, THE Settlement_Service SHALL compute net balance deltas per user from all trades
3. WHEN creating a batch, THE Settlement_Service SHALL build a Merkle tree from positive balance deltas (amounts owed to users)
4. WHEN a batch is ready, THE Settlement_Service SHALL call commitEpoch on SettlementVault with the Merkle root
5. WHEN a batch is committed, THE Settlement_Service SHALL store proofs for each user to claim their settlement
6. IF batch submission fails, THEN THE Settlement_Service SHALL retry with exponential backoff
7. WHEN a batch is successfully committed, THE Settlement_Service SHALL emit a settlement event for frontend updates

### Requirement 5: On-Chain Trade Settlement

**User Story:** As a system operator, I want matched trades settled on-chain via CTFExchange, so that token transfers are executed trustlessly.

#### Acceptance Criteria

1. WHEN settling complementary trades (BUY vs SELL), THE Settlement_Service SHALL call matchOrders on CTFExchange
2. WHEN settling MINT trades (BUY vs BUY), THE Settlement_Service SHALL call matchOrders which triggers splitPosition on CTF
3. WHEN settling MERGE trades (SELL vs SELL), THE Settlement_Service SHALL call matchOrders which triggers mergePositions on CTF
4. WHEN calling matchOrders, THE Settlement_Service SHALL provide the original signed orders and fill amounts
5. IF on-chain settlement fails, THEN THE Settlement_Service SHALL mark the batch as failed and alert operators
6. WHEN settlement succeeds, THE Settlement_Service SHALL update the settlement status for affected trades

### Requirement 6: Withdrawal Flow

**User Story:** As a trader, I want to withdraw my funds using cryptographic proofs, so that I can access my funds even if the off-chain system is unavailable.

#### Acceptance Criteria

1. WHEN a user requests withdrawal, THE System SHALL check the user's claimable balance across all epochs
2. WHEN generating a withdrawal proof, THE Settlement_Service SHALL return the Merkle proof for the user's balance in each epoch
3. WHEN a user calls claim on SettlementVault with valid proof, THE SettlementVault SHALL transfer the claimed amount
4. WHEN a claim is processed, THE SettlementVault SHALL mark the epoch as claimed for that user to prevent double-claims
5. IF a user provides an invalid proof, THEN THE SettlementVault SHALL revert with InvalidProof error
6. WHEN a withdrawal is completed on-chain, THE Indexer SHALL update the Off_Chain_Ledger to reflect the withdrawal

### Requirement 7: Order Cancellation

**User Story:** As a trader, I want to cancel my open orders, so that I can manage my trading positions.

#### Acceptance Criteria

1. WHEN a user requests off-chain cancellation, THE Matching_Engine SHALL remove the order and unlock the user's balance
2. WHEN a user calls cancelOrder on CTFExchange, THE CTFExchange SHALL mark the order as cancelled on-chain
3. WHEN a user calls incrementNonce on CTFExchange, THE CTFExchange SHALL invalidate all orders with the previous nonce
4. WHEN an on-chain cancellation is detected, THE Indexer SHALL sync the cancellation to Off_Chain_Ledger
5. IF a cancelled order has pending settlement, THEN THE Settlement_Service SHALL exclude it from the batch

### Requirement 8: Balance Reconciliation

**User Story:** As a system operator, I want continuous reconciliation between off-chain and on-chain state, so that discrepancies are detected immediately.

#### Acceptance Criteria

1. WHILE the system is running, THE Reconciliation_Service SHALL periodically compare Off_Chain_Ledger totals with SettlementVault balances
2. IF a discrepancy exceeds the threshold (0.01%), THEN THE Reconciliation_Service SHALL trigger an alert
3. IF a critical discrepancy is detected, THEN THE System SHALL pause new order acceptance until resolved
4. WHEN reconciliation runs, THE System SHALL log the comparison results for audit purposes
5. THE Reconciliation_Service SHALL track historical discrepancies for trend analysis

### Requirement 9: Real-Time Order Book Updates

**User Story:** As a trader, I want to see real-time order book updates, so that I can make informed trading decisions.

#### Acceptance Criteria

1. WHEN an order is added to the book, THE Backend SHALL broadcast an SSE event with the new order details
2. WHEN an order is filled or cancelled, THE Backend SHALL broadcast an SSE event with the update
3. WHEN a trade is executed, THE Backend SHALL broadcast an SSE event with trade details
4. WHEN a user subscribes to a market, THE Backend SHALL send the current order book state
5. THE Frontend SHALL maintain a local order book state updated from SSE events

### Requirement 10: Risk Management

**User Story:** As a system operator, I want risk controls on trading activity, so that the system is protected from abuse.

#### Acceptance Criteria

1. WHEN validating an order, THE Risk_Engine SHALL check the order size against user limits
2. WHEN validating an order, THE Risk_Engine SHALL check the user's total exposure against limits
3. WHEN validating an order, THE Risk_Engine SHALL enforce rate limits (orders per minute)
4. WHEN validating a withdrawal, THE Risk_Engine SHALL enforce daily withdrawal limits
5. IF any risk check fails, THEN THE System SHALL reject the operation with a specific error
6. THE Risk_Engine SHALL support configurable limits per user tier

### Requirement 11: Nonce Synchronization

**User Story:** As a trader, I want my order nonces synchronized between off-chain and on-chain, so that my orders are always valid.

#### Acceptance Criteria

1. WHEN a user's nonce is incremented on-chain, THE Indexer SHALL update the Off_Chain_Ledger nonce
2. WHEN validating an order, THE Order_Service SHALL reject orders with stale nonces
3. WHEN a user queries their nonce, THE System SHALL return both off-chain and on-chain nonce values
4. IF nonces are out of sync, THEN THE System SHALL use the higher (on-chain) nonce as authoritative

### Requirement 12: Fee Collection

**User Story:** As a platform operator, I want fees collected on trades, so that the platform is sustainable.

#### Acceptance Criteria

1. WHEN calculating trade fees, THE System SHALL use the formula: fee = feeRateBps × min(price, 1-price) × outcomeTokens
2. WHEN settling trades, THE CTFExchange SHALL deduct fees and transfer to the operator
3. WHEN displaying order previews, THE Frontend SHALL show estimated fees
4. THE System SHALL support configurable fee rates per market

### Requirement 13: Multi-Signature Support

**User Story:** As a trader using a multi-sig wallet, I want to trade using my Gnosis Safe, so that I can maintain my security practices.

#### Acceptance Criteria

1. WHEN validating signatures, THE CTFExchange SHALL support POLY_GNOSIS_SAFE signature type
2. WHEN a Gnosis Safe signs an order, THE System SHALL verify the signature against the Safe's signing threshold
3. WHEN validating proxy signatures, THE CTFExchange SHALL support POLY_PROXY signature type for account abstraction wallets
