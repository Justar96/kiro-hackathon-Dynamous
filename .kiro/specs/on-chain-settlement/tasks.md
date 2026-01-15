# Implementation Plan: On-Chain Settlement

## Overview

This implementation transforms Thesis from a centralized debate platform into a decentralized prediction market on Polygon. The approach is incremental: first deploy smart contracts, then integrate with the existing React frontend using wagmi v2 hooks.

## Technology Stack

- **Runtime**: Bun v1.1+ (package management, scripts, testing)
- **Smart Contracts**: Solidity 0.8.24, Foundry (forge/anvil)
- **Frontend**: React 18, Vite 5, wagmi v2, viem v2, TanStack Query v5
- **Testing**: Foundry fuzz tests (contracts), Vitest + fast-check (frontend)
- **Testnet**: Polygon Amoy (chainId: 80002) - Mumbai is deprecated

## Tasks

- [x] 1. Set up smart contract development environment
  - [x] 1.1 Initialize Foundry project structure in `contracts/` directory
    - Create foundry.toml with Polygon configuration
    - Set up remappings for OpenZeppelin and Gnosis CTF
    - Configure test and deployment scripts
    - _Requirements: 9.1, 9.2_
  
  - [x] 1.2 Install contract dependencies
    - Add OpenZeppelin contracts (access control, security, token standards)
    - Add Gnosis Conditional Token Framework
    - Add UMA Oracle interfaces
    - _Requirements: 2.3, 4.2_

- [x] 2. Implement ConditionalTokens contract (ERC-1155)
  - [x] 2.1 Create ConditionalTokens.sol with core token logic
    - Implement ERC-1155 standard with batch operations
    - Add condition preparation for binary outcomes
    - Implement splitPosition for minting YES/NO tokens from collateral
    - Implement mergePositions for redeeming equal YES/NO back to collateral
    - _Requirements: 2.1, 2.2, 2.3, 2.5_
  
  - [x] 2.2 Write property test for token minting balance invariant
    - **Property 1: Token Minting Balance Invariant**
    - **Validates: Requirements 1.2, 2.1**
  
  - [x] 2.3 Write property test for token redemption round-trip
    - **Property 2: Token Redemption Round-Trip**
    - **Validates: Requirements 2.2**
  
  - [x] 2.4 Write property test for total supply invariant
    - **Property 17: Total Supply Invariant**
    - **Validates: Requirements 2.5**

- [x] 3. Implement Market contract
  - [x] 3.1 Create Market.sol with state management
    - Define State enum (ACTIVE, PENDING_RESOLUTION, DISPUTED, RESOLVED)
    - Define Outcome enum (UNRESOLVED, YES, NO, INVALID)
    - Store question, resolution criteria, end time immutably
    - Implement state transition logic
    - _Requirements: 1.3, 4.1, 4.5_
  
  - [x] 3.2 Implement token minting in Market contract
    - Add mintTokens function that deposits USDC and mints equal YES/NO
    - Add redeemTokens function for equal YES/NO redemption
    - Emit TokensMinted and TokensRedeemed events
    - _Requirements: 1.2, 2.1, 2.4, 2.6_
  
  - [x] 3.3 Implement resolution and settlement logic
    - Add proposeResolution function (oracle only)
    - Add disputeResolution function with 24-hour window
    - Add finalizeResolution function after dispute period
    - Add redeemWinnings function with 2% fee
    - Handle INVALID outcome with 50/50 redemption
    - _Requirements: 4.2, 4.3, 4.4, 4.6, 4.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  
  - [x] 3.4 Write property test for settlement payout
    - **Property 6: Settlement Payout for Winners**
    - **Validates: Requirements 5.1, 5.2, 5.7**
  
  - [x] 3.5 Write property test for fee calculation
    - **Property 7: Settlement Fee Calculation**
    - **Validates: Requirements 5.4, 5.5**
  
  - [x] 3.6 Write property test for invalid market redemption
    - **Property 8: Invalid Market 50/50 Redemption**
    - **Validates: Requirements 4.6**

- [x] 4. Checkpoint - Core contracts compile and pass tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement MarketFactory contract
  - [x] 5.1 Create MarketFactory.sol
    - Store references to ConditionalTokens, USDC, OrderBook
    - Implement createMarket with validation (end date, min liquidity)
    - Deploy new Market contracts with CREATE2 for deterministic addresses
    - Track all markets by questionId
    - Emit MarketCreated events
    - _Requirements: 1.1, 1.4, 1.5, 1.6_
  
  - [x] 5.2 Write property test for market end date validation
    - **Property 15: Market End Date Validation**
    - **Validates: Requirements 1.5**
  
  - [x] 5.3 Write property test for minimum collateral enforcement
    - **Property 16: Minimum Collateral Enforcement**
    - **Validates: Requirements 1.6**

- [x] 6. Implement OrderBook contract
  - [x] 6.1 Create OrderBook.sol with order data structures
    - Define Order struct with id, maker, marketId, tokenId, side, price, quantity, filled, timestamp, active
    - Implement order storage with price-sorted linked lists for bids/asks
    - _Requirements: 3.1_
  
  - [x] 6.2 Implement order placement logic
    - Add placeOrder function with price validation (0.01-0.99)
    - Escrow tokens for sell orders, collateral for buy orders
    - Emit OrderPlaced events
    - _Requirements: 3.1, 3.2, 3.7, 3.8_
  
  - [x] 6.3 Implement order matching engine
    - Match incoming orders against existing orders at same or better price
    - Maintain price-time priority (best price first, then earliest)
    - Execute trades atomically with token transfers
    - Emit OrderFilled and Trade events
    - _Requirements: 3.3, 3.4, 3.5, 3.7_
  
  - [x] 6.4 Implement order cancellation
    - Add cancelOrder function
    - Return escrowed tokens to maker
    - Emit OrderCancelled events
    - _Requirements: 3.6, 3.7_
  
  - [x] 6.5 Write property test for order escrow round-trip
    - **Property 3: Order Escrow Round-Trip**
    - **Validates: Requirements 3.2, 3.6**
  
  - [x] 6.6 Write property test for price-time priority
    - **Property 4: Order Matching Price-Time Priority**
    - **Validates: Requirements 3.5**
  
  - [x] 6.7 Write property test for trade settlement flows
    - **Property 5: Trade Settlement Token Flows**
    - **Validates: Requirements 3.4**
  
  - [x] 6.8 Write property test for price boundary validation
    - **Property 14: Price Boundary Validation**
    - **Validates: Requirements 3.8**

- [x] 7. Implement security features
  - [x] 7.1 Add reentrancy guards to all contracts
    - Use OpenZeppelin ReentrancyGuard
    - Apply nonReentrant modifier to all external state-changing functions
    - _Requirements: 9.1_
  
  - [x] 7.2 Implement access control
    - Add Ownable for admin functions
    - Add oracle role for resolution
    - Implement role-based access for pause/unpause
    - _Requirements: 9.3_
  
  - [x] 7.3 Implement emergency pause functionality
    - Add Pausable to MarketFactory and OrderBook
    - Pause trading operations while allowing withdrawals
    - _Requirements: 9.4_
  
  - [x] 7.4 Write property test for reentrancy protection
    - **Property 11: Reentrancy Protection**
    - **Validates: Requirements 9.1**
  
  - [x] 7.5 Write property test for access control
    - **Property 12: Access Control Enforcement**
    - **Validates: Requirements 9.3**
  
  - [x] 7.6 Write property test for pause functionality
    - **Property 13: Pause Functionality**
    - **Validates: Requirements 9.4**

- [x] 8. Checkpoint - All smart contracts complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Set up frontend contract integration
  - [x] 9.1 Generate TypeScript types from contract ABIs
    - Use forge to output ABIs to packages/shared/src/contracts
    - Create typed contract constants with `as const` assertions
    - Export typed contract interfaces to packages/shared
    - _Requirements: 10.6_
  
  - [x] 9.2 Create contract configuration module
    - Add contract addresses for Polygon mainnet and Amoy testnet
    - Export ABI constants from packages/shared
    - Add chain configuration for wagmi v2 (polygon, polygonAmoy)
    - _Requirements: 10.1, 10.2_
  
  - [x] 9.3 Set up wagmi v2 provider in frontend
    - Install wagmi v2, viem v2, @tanstack/react-query v5
    - Configure WagmiProvider with Polygon chain
    - Add supported wallet connectors (injected, walletConnect, coinbaseWallet)
    - Wrap app in WagmiProvider and QueryClientProvider
    - _Requirements: 6.1, 6.2_

- [x] 10. Implement wallet connection hooks
  - [x] 10.1 Create useWalletConnection hook
    - Implement connect/disconnect functionality
    - Add chain verification for Polygon
    - Implement switchToPolygon for wrong network
    - Persist connection state across refreshes
    - _Requirements: 6.1, 6.2, 6.3, 6.7_
  
  - [x] 10.2 Create useTokenBalances hook
    - Read USDC balance using wagmi useBalance
    - Read outcome token balances from ConditionalTokens
    - Subscribe to Transfer events for real-time updates
    - _Requirements: 6.5_

- [x] 11. Implement market interaction hooks
  - [x] 11.1 Create useMarket hook for market state
    - Read market state, outcome, end time from contract
    - Cache with TanStack Query (5 minute stale time for static data)
    - Subscribe to StateChanged events
    - _Requirements: 10.1, 10.4, 10.5_
  
  - [x] 11.2 Create useMarketActions hook for write operations
    - Implement mintTokens with USDC approval flow
    - Implement redeemTokens for equal YES/NO redemption
    - Implement redeemWinnings for settlement
    - Handle transaction states and errors
    - _Requirements: 10.2, 10.3, 6.4, 6.6_
  
  - [x] 11.3 Create useMarketFactory hook
    - Implement createMarket with validation
    - Read all markets list
    - Subscribe to MarketCreated events
    - _Requirements: 1.1, 1.4, 10.5_

- [x] 12. Implement order book hooks
  - [x] 12.1 Create useOrderBook hook for order book state
    - Read bids and asks with depth
    - Calculate mid-price and spread
    - Subscribe to Trade events for price updates
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 10.5_
  
  - [x] 12.2 Write property test for mid-price calculation
    - **Property 9: Mid-Price Calculation**
    - **Validates: Requirements 8.1**
  
  - [x] 12.3 Create useOrderBookActions hook
    - Implement placeBuyOrder with collateral approval
    - Implement placeSellOrder with token approval
    - Implement cancelOrder
    - _Requirements: 3.1, 3.2, 3.6, 10.2_

- [x] 13. Implement position management hooks
  - [x] 13.1 Create usePositions hook
    - Aggregate user positions across all markets
    - Calculate unrealized P&L per position
    - Calculate portfolio totals
    - _Requirements: 7.1, 7.3, 7.6_
  
  - [x] 13.2 Write property test for P&L calculation
    - **Property 10: P&L Calculation**
    - **Validates: Requirements 7.3**
  
  - [x] 13.3 Write property test for position aggregation
    - **Property 18: Position Aggregation**
    - **Validates: Requirements 7.6**
  
  - [x] 13.4 Create useOpenOrders hook
    - Read user's active orders from OrderBook
    - Subscribe to OrderFilled and OrderCancelled events
    - _Requirements: 7.4, 10.5_

- [x] 14. Checkpoint - All hooks implemented
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Create utility functions and error handling
  - [x] 15.1 Create price conversion utilities
    - Implement priceToBasisPoints and basisPointsToPrice
    - Implement toUsdcUnits and fromUsdcUnits
    - Add implied probability calculation
    - _Requirements: 8.4_
  
  - [x] 15.2 Create contract error parser
    - Parse Solidity revert reasons to user-friendly messages
    - Handle common error cases (insufficient balance, invalid price, etc.)
    - _Requirements: 6.6_
  
  - [x] 15.3 Create transaction state hook
    - Track pending_signature, pending_confirmation, confirmed, failed states
    - Provide transaction hash for block explorer links
    - _Requirements: 10.3_

- [x] 16. Update frontend components for on-chain integration
  - [x] 16.1 Update market creation flow
    - Replace backend API calls with useMarketFactory hook
    - Add USDC approval step before market creation
    - Display transaction confirmation UI
    - _Requirements: 1.1, 6.4_
  
  - [x] 16.2 Update market view components
    - Replace backend data fetching with useMarket hook
    - Display order book using useOrderBook
    - Show real-time price updates from events
    - _Requirements: 8.3, 8.6_
  
  - [x] 16.3 Update trading interface
    - Replace backend order submission with useOrderBookActions
    - Add token approval flow before sell orders
    - Display order status and fill progress
    - _Requirements: 3.1, 3.2_
  
  - [x] 16.4 Update portfolio/positions view
    - Replace backend position data with usePositions
    - Display open orders with cancel functionality
    - Show P&L calculations
    - _Requirements: 7.1, 7.4, 7.5_
  
  - [x] 16.5 Update settlement flow
    - Add resolution status display
    - Implement claim winnings button using useMarketActions
    - Display payout amount with fee breakdown
    - _Requirements: 5.1, 5.2, 5.4_

- [x] 17. Final checkpoint - Full integration complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks including property tests are required for comprehensive testing
- Smart contract development uses Foundry with Solidity 0.8.24 (Cancun EVM)
- Frontend uses wagmi v2 with viem v2 for contract interactions
- All contract interactions require proper approval flows for ERC-20/ERC-1155 tokens
- Property tests: 256 runs for Foundry fuzz tests, 100 runs for fast-check
- Each property test references its design document property number for traceability
- Use Polygon Amoy testnet (chainId: 80002) for testing - Mumbai is deprecated
- Run tests with: `cd contracts && forge test` (contracts) or `bun run --cwd packages/frontend test` (frontend)
