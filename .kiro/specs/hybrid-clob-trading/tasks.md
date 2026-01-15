# Implementation Plan: Hybrid CLOB Trading

## Overview

This implementation plan converts the hybrid CLOB trading design into discrete coding tasks. The plan follows an incremental approach: building core infrastructure first, then layering on matching, settlement, and frontend integration. Each task builds on previous work to ensure no orphaned code.

## Tasks

- [ ] 1. Enhance Off-Chain Ledger Service
  - [ ] 1.1 Create dedicated Ledger service with balance management
    - Create `packages/backend/src/services/ledger.ts`
    - Implement credit, debit, lock, unlock, transfer operations
    - Add nonce tracking per user
    - Add total balance aggregation for reconciliation
    - _Requirements: 1.3, 2.5, 2.7, 7.1_
  
  - [ ] 1.2 Write property tests for Ledger balance invariants
    - **Property 6: Balance Locking Invariant**
    - Test that available + locked remains constant after lock/unlock
    - **Validates: Requirements 2.7**
  
  - [ ] 1.3 Write property tests for Ledger transfer conservation
    - **Property 11: Trade Balance Conservation**
    - Test that sum of all balance changes equals zero
    - **Validates: Requirements 3.6**

- [ ] 2. Implement Blockchain Indexer Service
  - [ ] 2.1 Create Indexer service for monitoring blockchain events
    - Create `packages/backend/src/services/indexer.ts`
    - Implement deposit event monitoring from SettlementVault
    - Add confirmation tracking (20 blocks for deposits)
    - Implement chain reorg detection and handling
    - Wire to Ledger for balance credits
    - _Requirements: 1.2, 1.4, 6.6, 7.4, 11.1_
  
  - [ ] 2.2 Add nonce synchronization from CTFExchange
    - Monitor OrderCancelled and nonce increment events
    - Sync on-chain nonce to Ledger
    - _Requirements: 11.1, 11.4_

- [ ] 3. Enhance Matching Engine with MINT/MERGE Detection
  - [ ] 3.1 Add MatchType enum and detection logic
    - Update `packages/backend/src/services/matchingEngine.ts`
    - Add COMPLEMENTARY, MINT, MERGE match type detection
    - Detect MINT when two BUY orders have prices summing >= 1.0
    - Detect MERGE when two SELL orders have prices summing <= 1.0
    - _Requirements: 3.4, 3.5_
  
  - [ ] 3.2 Write property tests for MINT detection
    - **Property 9: MINT Match Type Detection**
    - Generate random buy order pairs and verify MINT flag
    - **Validates: Requirements 3.4**
  
  - [ ] 3.3 Write property tests for MERGE detection
    - **Property 10: MERGE Match Type Detection**
    - Generate random sell order pairs and verify MERGE flag
    - **Validates: Requirements 3.5**
  
  - [ ] 3.4 Integrate Matching Engine with Ledger service
    - Replace internal balance tracking with Ledger service calls
    - Ensure balance locking on order acceptance
    - Ensure balance updates on trade execution
    - _Requirements: 2.7, 3.6_
  
  - [ ] 3.5 Write property tests for price-time priority matching
    - **Property 7: Price-Time Priority Matching**
    - Generate order books and verify matching order
    - **Validates: Requirements 3.1**
  
  - [ ] 3.6 Write property tests for trade execution at maker price
    - **Property 8: Trade Execution at Maker Price**
    - Generate crossing orders and verify trade price
    - **Validates: Requirements 3.2, 3.3**

- [ ] 4. Checkpoint - Core Services
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Create Order Service with Validation
  - [ ] 5.1 Create Order Service for order submission and validation
    - Create `packages/backend/src/services/orderService.ts`
    - Implement EIP-712 signature validation using OrderSigner
    - Implement nonce validation against Ledger
    - Implement balance sufficiency check
    - Wire to Risk Engine for limit checks
    - Wire to Matching Engine for order submission
    - _Requirements: 2.3, 2.4, 2.5, 2.6_
  
  - [ ] 5.2 Write property tests for signature validation
    - **Property 3: Signature Validation Correctness**
    - Generate valid/invalid signatures and verify validation
    - **Validates: Requirements 2.3**
  
  - [ ] 5.3 Write property tests for nonce validation
    - **Property 4: Nonce Validation**
    - Generate orders with various nonces and verify validation
    - **Validates: Requirements 2.4, 11.2**
  
  - [ ] 5.4 Write property tests for balance sufficiency
    - **Property 5: Balance Sufficiency Check**
    - Generate orders with amounts above/below balance
    - **Validates: Requirements 2.5**

- [ ] 6. Enhance Settlement Service with CTFExchange Integration
  - [ ] 6.1 Add CTFExchange settlement execution
    - Update `packages/backend/src/services/settlement.ts`
    - Implement matchOrders call for COMPLEMENTARY trades
    - Implement matchOrders call for MINT trades (triggers splitPosition)
    - Implement matchOrders call for MERGE trades (triggers mergePositions)
    - Add retry logic with exponential backoff
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_
  
  - [ ] 6.2 Write property tests for balance delta computation
    - **Property 14: Balance Delta Computation Correctness**
    - Generate trade sets and verify computed deltas
    - **Validates: Requirements 4.2**
  
  - [ ] 6.3 Write property tests for Merkle proof validity
    - **Property 15: Merkle Tree Inclusion**
    - Generate batches and verify all proofs
    - **Validates: Requirements 4.3, 4.5, 6.2**
  
  - [ ] 6.4 Add cancelled order exclusion from batches
    - Filter out cancelled orders before batch creation
    - _Requirements: 7.5_
  
  - [ ] 6.5 Write property tests for cancelled order exclusion
    - **Property 23: Cancelled Order Settlement Exclusion**
    - Verify cancelled orders don't appear in batches
    - **Validates: Requirements 7.5**

- [ ] 7. Create Reconciliation Service
  - [ ] 7.1 Create Reconciliation service for balance verification
    - Create `packages/backend/src/services/reconciliation.ts`
    - Implement periodic comparison of Ledger vs SettlementVault
    - Add discrepancy threshold alerting (0.01%)
    - Add system pause on critical discrepancy
    - Track historical discrepancies
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [ ] 7.2 Write property tests for discrepancy alerting
    - **Property 24: Risk Limit Enforcement** (partial - discrepancy threshold)
    - Verify alerts trigger above threshold
    - **Validates: Requirements 8.2**

- [ ] 8. Checkpoint - Backend Services Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Enhance Risk Engine
  - [ ] 9.1 Add tier-based limit configuration
    - Update `packages/backend/src/services/riskEngine.ts`
    - Add user tier support with configurable limits
    - Ensure all risk checks use tier-specific limits
    - _Requirements: 10.6_
  
  - [ ] 9.2 Write property tests for risk limit enforcement
    - **Property 24: Risk Limit Enforcement**
    - Generate operations exceeding limits and verify rejection
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
  
  - [ ] 9.3 Write property tests for tier-based limits
    - **Property 25: Tier-Based Limit Application**
    - Verify different tiers have different limits applied
    - **Validates: Requirements 10.6**

- [ ] 10. Add API Endpoints
  - [ ] 10.1 Add order submission and management endpoints
    - Update `packages/backend/src/index.ts`
    - POST /api/orders - Submit signed order
    - DELETE /api/orders/:id - Cancel order
    - GET /api/orders/:id - Get order status
    - GET /api/orders/user/:addr - Get user's orders
    - _Requirements: 2.3, 7.1_
  
  - [ ] 10.2 Add order book and market data endpoints
    - GET /api/orderbook/:marketId/:tokenId - Get order book
    - GET /api/orderbook/:marketId/:tokenId/stream - SSE subscription
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  
  - [ ] 10.3 Add balance and settlement endpoints
    - GET /api/balances/:addr - Get user balances
    - GET /api/deposits/:addr - Get deposit history
    - GET /api/withdrawals/:addr - Get withdrawal proofs
    - GET /api/settlement/epochs - Get recent epochs
    - GET /api/settlement/proof/:epochId/:addr - Get withdrawal proof
    - _Requirements: 1.5, 6.1, 6.2_
  
  - [ ] 10.4 Add health and reconciliation endpoints
    - GET /api/health - System health
    - GET /api/health/reconciliation - Reconciliation status
    - _Requirements: 8.4_

- [ ] 11. Enhance CTFExchange Contract
  - [ ] 11.1 Add multi-signature support
    - Update `contracts/src/CTFExchange.sol`
    - Implement POLY_PROXY signature validation
    - Implement POLY_GNOSIS_SAFE signature validation
    - Add IProxyWallet and IGnosisSafe interfaces
    - _Requirements: 13.1, 13.2, 13.3_
  
  - [ ] 11.2 Add fee withdrawal function
    - Add withdrawFees function for operator
    - _Requirements: 12.2_
  
  - [ ] 11.3 Add cancelAllOrders function
    - Implement nonce increment with event
    - _Requirements: 7.3_
  
  - [ ] 11.4 Write Foundry unit tests for multi-sig validation
    - Test POLY_GNOSIS_SAFE signature validation
    - Test POLY_PROXY signature validation
    - **Validates: Requirements 13.1, 13.2, 13.3**
  
  - [ ] 11.5 Write Foundry fuzz tests for order matching
    - Fuzz test fillOrder with random parameters
    - Fuzz test matchOrders with random order sets
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [ ] 12. Checkpoint - Contract Enhancements
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Frontend Order Signing
  - [ ] 13.1 Create order signing utility
    - Create `packages/frontend/src/lib/trading/orderSigner.ts`
    - Implement EIP-712 domain and types matching CTFExchange
    - Implement createSignedOrder function using wagmi
    - _Requirements: 2.1, 2.2_
  
  - [ ] 13.2 Write property tests for EIP-712 hash consistency
    - **Property 2: EIP-712 Order Hash Determinism**
    - Verify frontend hash matches contract hash
    - **Validates: Requirements 2.1**

- [ ] 14. Frontend Trading Hooks
  - [ ] 14.1 Create useOrders hook for order management
    - Create `packages/frontend/src/lib/hooks/useTrading.ts`
    - Implement submitOrder with signing and API call
    - Implement cancelOrder
    - Add loading and error states
    - _Requirements: 2.1, 2.2, 7.1_
  
  - [ ] 14.2 Create useOrderBook hook for real-time updates
    - Implement SSE subscription to order book stream
    - Maintain local order book state
    - Handle reconnection
    - _Requirements: 9.4, 9.5_
  
  - [ ] 14.3 Create useBalances hook for balance management
    - Implement balance fetching
    - Implement deposit transaction
    - Implement withdrawal with proof
    - Track pending deposits and claimable epochs
    - _Requirements: 1.1, 6.1, 6.2, 6.3_

- [ ] 15. Frontend Trading Components
  - [ ] 15.1 Create OrderForm component
    - Create `packages/frontend/src/components/market/OrderForm.tsx`
    - Implement buy/sell order form with price and quantity inputs
    - Show estimated fees
    - Integrate with useOrders hook
    - _Requirements: 12.3_
  
  - [ ] 15.2 Create OrderBook component
    - Create `packages/frontend/src/components/market/OrderBook.tsx`
    - Display bid/ask levels with depth
    - Show spread
    - Integrate with useOrderBook hook
    - _Requirements: 9.5_
  
  - [ ] 15.3 Create DepositWithdraw component
    - Create `packages/frontend/src/components/market/DepositWithdraw.tsx`
    - Implement deposit flow with USDC approval
    - Implement withdrawal flow with proof fetching
    - Show pending deposits and claimable amounts
    - _Requirements: 1.1, 6.1, 6.3_

- [ ] 16. Checkpoint - Frontend Integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Add SSE Event Types and Broadcasting
  - [ ] 17.1 Define trading SSE event types
    - Update `packages/shared/src/sse-events.ts`
    - Add TradingEvent union type
    - Add order_added, order_removed, order_updated events
    - Add trade, price_update, balance_update events
    - Add epoch_committed event
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [ ] 17.2 Implement SSE broadcasting in backend
    - Add SSE connection management
    - Broadcast events from Matching Engine
    - Broadcast events from Settlement Service
    - _Requirements: 9.1, 9.2, 9.3, 4.7_

- [ ] 18. Fee Calculation Integration
  - [ ] 18.1 Implement fee calculation in Matching Engine
    - Add fee calculation using formula: feeRateBps × min(price, 1-price) × outcomeTokens
    - Include fees in trade records
    - _Requirements: 12.1_
  
  - [ ] 18.2 Write property tests for fee calculation
    - **Property 27: Fee Calculation Formula**
    - Verify fee formula is correctly applied
    - **Validates: Requirements 12.1**
  
  - [ ] 18.3 Add fee display in frontend OrderForm
    - Calculate and display estimated fees before order submission
    - _Requirements: 12.3_

- [ ] 19. Final Integration and Wiring
  - [ ] 19.1 Wire all services together in backend entry point
    - Update `packages/backend/src/index.ts`
    - Initialize Ledger, Indexer, MatchingEngine, OrderService, SettlementService, RiskEngine, ReconciliationService
    - Start Indexer on server startup
    - Configure settlement batch intervals
    - _Requirements: All_
  
  - [ ] 19.2 Add contract addresses and ABIs to shared package
    - Update `packages/shared/src/contracts/`
    - Add CTFExchange ABI and address
    - Add SettlementVault ABI and address
    - _Requirements: All frontend integration_

- [ ] 20. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Run full integration test: deposit → order → match → settle → withdraw

## Notes

- All tasks including property tests are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation follows the existing project structure conventions
