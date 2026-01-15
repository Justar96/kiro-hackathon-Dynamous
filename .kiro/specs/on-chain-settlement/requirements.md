# Requirements Document

## Introduction

This specification defines the on-chain settlement system for transforming Thesis from a debate platform into a Polymarket-style prediction market on Polygon. The system enables users to create binary prediction markets, trade YES/NO outcome shares, and receive automatic settlement payouts based on oracle-verified resolutions.

The architecture follows Polymarket's proven hybrid-decentralized model:
- **On-chain**: Token minting/redemption via Gnosis Conditional Token Framework (CTF), settlement, and fund custody
- **Off-chain**: Order matching via operator service for gas efficiency
- **Frontend**: Complete migration from debate UI to prediction market UI using wagmi/viem

Key technical decisions aligned with Polymarket:
- Use existing Gnosis CTF contract (`0x4d97dcd97ec945f40cf65f87097ace5ea0476045`) on Polygon
- Native USDC as collateral (`0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`) on Polygon mainnet
- EIP-712 signed orders for off-chain matching
- UMA Oracle for decentralized resolution
- Polygon Amoy testnet (chainId: 80002) for development - Mumbai is deprecated

## Glossary

- **Market**: A prediction market representing a binary question with YES/NO outcomes, identified by a conditionId
- **Outcome_Token**: ERC-1155 tokens from CTF representing shares in a specific outcome (YES or NO)
- **CLOB**: Central Limit Order Book - hybrid system with off-chain matching and on-chain settlement
- **CTF_Exchange**: The smart contract that settles matched orders on-chain
- **Collateral_Token**: Native USDC on Polygon (`0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`) used to mint outcome tokens and settle payouts
- **Oracle**: UMA Optimistic Oracle that provides resolution data for markets
- **Resolution**: The process of determining the winning outcome via oracle
- **Settlement**: The process of redeeming winning outcome tokens for collateral
- **Position**: A user's holdings of outcome tokens in a specific market
- **Operator**: Off-chain service that matches orders and submits settlements to chain
- **Split**: CTF operation converting 1 USDC into 1 YES + 1 NO token
- **Merge**: CTF operation converting 1 YES + 1 NO token back into 1 USDC
- **Condition_ID**: Unique identifier for a market's resolution condition in CTF
- **Question_ID**: Unique identifier linking market to oracle resolution

## Requirements

### Requirement 1: Market Creation

**User Story:** As a market creator, I want to create binary prediction markets with clear resolution criteria, so that users can trade on real-world outcomes.

#### Acceptance Criteria

1. WHEN a user submits a market creation request with question, resolution criteria, and end date, THE System SHALL prepare a new condition in the CTF contract with unique conditionId
2. WHEN a Market is created, THE System SHALL register the market with the UMA Oracle for resolution
3. THE Market metadata (question, resolution criteria, end date) SHALL be stored off-chain with on-chain conditionId reference
4. WHEN a Market is created, THE System SHALL emit events and index market data for frontend discovery
5. IF a user attempts to create a Market with end date in the past, THEN THE System SHALL reject the request
6. THE Market SHALL require the creator to provide initial liquidity by splitting USDCe into YES/NO tokens

### Requirement 2: Outcome Token Management (CTF Operations)

**User Story:** As a trader, I want to mint and redeem outcome tokens using the Gnosis CTF, so that I can take positions on market outcomes.

#### Acceptance Criteria

1. WHEN a user calls splitPosition with USDC, THE CTF SHALL mint equal amounts of YES and NO Outcome_Tokens (1 USDC → 1 YES + 1 NO)
2. WHEN a user calls mergePositions with equal YES and NO tokens, THE CTF SHALL burn tokens and return USDC (1 YES + 1 NO → 1 USDC)
3. THE Outcome_Tokens SHALL be ERC-1155 tokens managed by the existing Gnosis CTF at `0x4d97dcd97ec945f40cf65f87097ace5ea0476045`
4. WHEN tokens are split or merged, THE CTF SHALL emit PositionSplit or PositionMerge events
5. THE System SHALL track token balances via CTF contract reads
6. IF a user attempts to merge mismatched token amounts, THEN THE CTF SHALL revert the transaction

### Requirement 3: Order Book Trading (Hybrid CLOB)

**User Story:** As a trader, I want to place limit orders to buy and sell outcome tokens at specific prices, so that I can trade at my desired probability levels.

#### Acceptance Criteria

1. WHEN a user places an order, THE Frontend SHALL create an EIP-712 signed order message with price (0.01-0.99), quantity, expiration, and nonce
2. WHEN a user places a sell order, THE User SHALL have approved the CTF_Exchange to transfer their Outcome_Tokens
3. WHEN the Operator matches orders off-chain, THE Operator SHALL submit matched orders to CTF_Exchange for atomic on-chain settlement
4. WHEN a trade settles on-chain, THE CTF_Exchange SHALL transfer Outcome_Tokens to buyer and USDC to seller atomically
5. THE Operator SHALL maintain price-time priority for order matching (best price first, then earliest timestamp)
6. WHEN a user cancels an order, THE System SHALL invalidate the order nonce on-chain
7. THE CTF_Exchange SHALL emit OrderFilled events for all settled trades
8. IF an order has price outside 0.01-0.99 range, THEN THE System SHALL reject the order

### Requirement 4: Market Resolution (UMA Oracle)

**User Story:** As a market participant, I want markets to be resolved accurately by the UMA Oracle, so that I can trust the settlement process.

#### Acceptance Criteria

1. WHEN the market end date passes, THE System SHALL request resolution from UMA Optimistic Oracle
2. WHEN UMA proposes a resolution, THE Market SHALL enter a dispute period (typically 2 hours for optimistic oracle)
3. IF no dispute is raised during the dispute period, THE Resolution SHALL be finalized automatically
4. WHEN a resolution is disputed, THE UMA DVM (Data Verification Mechanism) SHALL arbitrate
5. WHEN resolution is finalized, THE Oracle SHALL call reportPayouts on CTF to enable redemption
6. IF the Oracle returns INVALID, THEN THE CTF SHALL allow all token holders to redeem at 0.50 USDC per token
7. THE System SHALL emit resolution events for frontend updates

### Requirement 5: Settlement and Payouts

**User Story:** As a winning position holder, I want to redeem my outcome tokens for USDC, so that I receive my winnings.

#### Acceptance Criteria

1. WHEN a Market is resolved with YES outcome, THE CTF SHALL allow YES token holders to call redeemPositions for 1.00 USDC per token
2. WHEN a Market is resolved with NO outcome, THE CTF SHALL allow NO token holders to call redeemPositions for 1.00 USDC per token
3. THE CTF SHALL burn redeemed Outcome_Tokens upon payout
4. WHEN a user redeems winning tokens, THE System MAY charge a protocol fee (configurable, default 0%)
5. THE CTF SHALL emit PayoutRedemption events with user address and payout amount
6. IF a user attempts to redeem before resolution, THEN THE CTF SHALL revert the transaction
7. Losing tokens SHALL have zero redemption value after resolution

### Requirement 6: Wallet Integration

**User Story:** As a user, I want to connect my wallet and interact with markets seamlessly, so that I can trade without friction.

#### Acceptance Criteria

1. WHEN a user clicks connect wallet, THE Frontend SHALL display supported wallet options (MetaMask, WalletConnect, Coinbase Wallet, Rainbow)
2. WHEN a wallet connects, THE System SHALL verify the user is on Polygon network (chainId: 137)
3. IF the user is on wrong network, THEN THE System SHALL prompt to switch to Polygon
4. WHEN a user initiates a transaction, THE Frontend SHALL display gas estimation and confirmation dialog
5. THE Frontend SHALL display real-time balance updates for USDC and Outcome_Tokens
6. WHEN a transaction fails, THE System SHALL display human-readable error message
7. THE System SHALL persist wallet connection state across page refreshes using wagmi's persistence

### Requirement 7: Position Management

**User Story:** As a trader, I want to view and manage my positions across all markets, so that I can track my portfolio.

#### Acceptance Criteria

1. THE Frontend SHALL display all user positions with current market price and profit/loss
2. WHEN market prices change, THE Position_Display SHALL update via order book websocket or polling
3. THE System SHALL calculate unrealized P&L as (current_price - average_entry_price) × quantity
4. WHEN a user has open orders, THE Frontend SHALL display pending orders with cancel option
5. THE Frontend SHALL display trade history fetched from indexed events
6. THE System SHALL aggregate positions across multiple markets into portfolio view

### Requirement 8: Price Discovery

**User Story:** As a market participant, I want to see accurate market prices reflecting collective probability estimates, so that I can make informed trading decisions.

#### Acceptance Criteria

1. THE System SHALL calculate mid-price as average of best bid and best ask from order book
2. WHEN no orders exist on one side, THE System SHALL display last trade price
3. THE Frontend SHALL display order book depth with bid/ask quantities at each price level
4. THE System SHALL calculate implied probability as the mid-price (e.g., 0.65 = 65% probability)
5. WHEN a trade executes, THE System SHALL update displayed price within 2 seconds
6. THE Frontend SHALL display price history chart with configurable time ranges

### Requirement 9: Smart Contract Security

**User Story:** As a platform operator, I want secure smart contracts that protect user funds, so that the platform maintains trust.

#### Acceptance Criteria

1. THE CTF_Exchange SHALL implement reentrancy guards on all settlement functions
2. THE System SHALL use the audited Gnosis CTF contract (ChainSecurity audited)
3. THE CTF_Exchange SHALL implement operator access control for order submission
4. THE System SHALL implement emergency pause functionality for the exchange contract
5. THE Smart_Contracts SHALL emit events for all state-changing operations
6. THE System SHALL validate all EIP-712 signatures before processing orders

### Requirement 10: Frontend Migration

**User Story:** As a developer, I want to replace the debate UI with prediction market UI, so that users can trade on markets.

#### Acceptance Criteria

1. THE Frontend SHALL remove all debate-specific components (ArgumentBlock, RoundSection, SteelmanGate, etc.)
2. THE Frontend SHALL replace debate routes with market routes (/markets, /markets/:id)
3. THE Frontend SHALL implement new market listing page with price, volume, and end date
4. THE Frontend SHALL implement market detail page with order book, trading interface, and position display
5. THE Frontend SHALL use wagmi v2 hooks for all contract interactions
6. THE System SHALL provide TypeScript types for all contract ABIs
7. THE Frontend SHALL implement responsive design for mobile trading
