# Implementation Plan: Production Wiring & E2E Testing

## Overview

This implementation plan converts the production wiring and E2E testing design into discrete coding tasks. The plan follows an incremental approach: first enhancing configuration, then creating deployment scripts, wiring frontend and backend, and finally building the E2E test suite.

## Tasks

- [x] 1. Enhance Configuration Manager
  - [x] 1.1 Update shared config with environment-based loading
    - Update `packages/shared/src/contracts/config.ts`
    - Add `loadConfigFromEnv()` function that reads from environment variables
    - Add `validateConfig()` function that checks for zero addresses
    - Add `getConfigForEnvironment(env: Environment)` function
    - Export typed `NetworkConfig` interface
    - _Requirements: 1.1, 1.4, 5.1, 5.2, 5.3_
  
  - [x] 1.2 Write property tests for configuration validation
    - **Property 1: Configuration Validation - No Zero Addresses**
    - **Property 2: Configuration Loading from Environment**
    - **Property 3: Address Validation Rejects Invalid Addresses**
    - **Validates: Requirements 1.1, 1.4, 5.3**
  
  - [x] 1.3 Update frontend environment configuration
    - Update `packages/frontend/src/lib/wagmi/config.ts`
    - Add config validation on app startup
    - Display configuration error component when addresses missing
    - _Requirements: 1.3, 5.4_
  
  - [x] 1.4 Update backend environment configuration
    - Update `packages/backend/src/index.ts`
    - Add config validation on server startup
    - Log clear warnings when blockchain features disabled
    - _Requirements: 1.2, 4.1_

- [x] 2. Create Contract Deployment Scripts
  - [x] 2.1 Create Foundry deployment script for local development
    - Create `contracts/script/DeployLocal.s.sol`
    - Deploy MockERC20 (USDC), ConditionalTokens, CTFExchange, SettlementVault
    - Output deployed addresses in JSON format
    - _Requirements: 2.1, 2.2_
  
  - [x] 2.2 Add test account funding to deployment script
    - Add `fundTestAccounts()` function
    - Fund 5 test accounts with 10,000 USDC each
    - Fund accounts with native tokens for gas
    - _Requirements: 2.3_
  
  - [x] 2.3 Add deployment verification
    - Add `verifyDeployments()` function
    - Call view functions on each deployed contract
    - Verify contract bytecode is deployed
    - _Requirements: 2.4_
  
  - [x] 2.4 Create deployment helper script
    - Create `contracts/script/deploy-local.sh`
    - Start Anvil, run deployment, output env file
    - Create `.env.local` template with deployed addresses
    - _Requirements: 2.1, 2.2_

- [x] 3. Checkpoint - Configuration and Deployment
  - All configuration and deployment tasks completed.

- [x] 4. Wire Frontend to Real Backend
  - [x] 4.1 Update useOrders hook for real API integration
    - Update `packages/frontend/src/lib/hooks/trading/useOrders.ts`
    - Ensure proper error handling for API failures
    - Add retry logic for transient failures
    - _Requirements: 3.1, 3.6_
  
  - [x] 4.2 Update useOrderBook hook for real-time data
    - Update `packages/frontend/src/lib/hooks/trading/useOrderBook.ts`
    - Verify SSE reconnection logic works correctly
    - Add connection status indicator
    - _Requirements: 3.2_
  
  - [x] 4.3 Update useBalances hook for real blockchain interaction
    - Update `packages/frontend/src/lib/hooks/trading/useBalances.ts`
    - Ensure deposit calls SettlementVault.deposit correctly
    - Ensure withdrawal fetches proof and calls SettlementVault.claim
    - _Requirements: 3.3, 3.4, 3.5_
  
  - [x] 4.4 Add configuration error display component
    - Create `packages/frontend/src/components/common/ConfigError.tsx`
    - Display when contract addresses are not configured
    - Show which addresses are missing
    - _Requirements: 1.3_

- [x] 5. Wire Backend to Real Blockchain
  - [x] 5.1 Create blockchain service for contract interactions
    - Backend already initializes ethers.js provider from RPC_URL in `packages/backend/src/index.ts`
    - Contract instances created for CTFExchange, SettlementVault via services
    - Connection health check available via `/health` endpoint
    - _Requirements: 4.1_
  
  - [x] 5.2 Enhance Indexer for deposit event processing
    - `packages/backend/src/services/indexer.ts` already processes deposit events
    - Credits off-chain balance correctly after confirmations
    - Confirmation tracking (20 blocks) implemented
    - _Requirements: 4.2_
  
  - [ ] 5.3 Write property test for deposit balance conservation
    - **Property 4: Deposit Amount Conservation**
    - **Validates: Requirements 4.2, 7.3**
  
  - [x] 5.4 Enhance Settlement service for on-chain execution
    - `packages/backend/src/services/settlement.ts` implements `settleBatch()` with CTFExchange.matchOrders
    - Retry logic with exponential backoff (max 3 retries) implemented
    - Settlement status tracking per epoch implemented
    - _Requirements: 4.3, 4.4_
  
  - [x] 5.5 Enhance Reconciliation service for on-chain comparison
    - `packages/backend/src/services/reconciliation.ts` compares off-chain ledger with on-chain vault
    - Discrepancy alerting implemented
    - _Requirements: 4.5_

- [x] 6. Checkpoint - Frontend and Backend Wiring
  - Frontend hooks wired to real backend APIs
  - Backend services connected to blockchain contracts

- [x] 7. Create E2E Test Infrastructure
  - [x] 7.1 Create Anvil management utilities
    - Create `packages/frontend/src/lib/__tests__/e2e/anvil.ts`
    - Implement `startAnvil()`, `stopAnvil()`, `resetAnvil()`
    - Add `mineBlocks()`, `advanceTime()`, `setBalance()`
    - _Requirements: 6.1_
  
  - [x] 7.2 Create backend server management for tests
    - Create `packages/frontend/src/lib/__tests__/e2e/backend.ts`
    - Implement `startBackend()`, `stopBackend()`
    - Add health check polling
    - _Requirements: 6.2_
  
  - [x] 7.3 Create test wallet utilities
    - Create `packages/frontend/src/lib/__tests__/e2e/wallets.ts`
    - Create test wallets with known private keys
    - Implement `signTypedData()` for EIP-712 signing
    - _Requirements: 6.3_
  
  - [x] 7.4 Create E2E test setup and teardown
    - Create `packages/frontend/src/lib/__tests__/e2e/setup.ts`
    - Implement `createE2EContext()` that starts Anvil, deploys contracts, starts backend
    - Implement cleanup function
    - _Requirements: 6.1, 6.2, 6.3, 6.5_
  
  - [x] 7.5 Create E2E test helpers
    - Create `packages/frontend/src/lib/__tests__/e2e/helpers.ts`
    - Implement `deposit()`, `submitOrder()`, `triggerSettlement()`, `claimWithdrawal()`
    - Implement `waitForOrderBook()`, `getUsdcBalance()`
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 8. Checkpoint - E2E Infrastructure
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement E2E Tests - Deposit Flow
  - [x] 9.1 Write deposit E2E test
    - Create `packages/frontend/src/lib/__tests__/e2e/deposit.e2e.test.ts`
    - Test USDC approval and deposit to vault
    - Verify deposit event is emitted
    - Verify off-chain balance is credited after indexing
    - _Requirements: 7.1, 7.2_
  
  - [x] 9.2 Write property test for deposit conservation
    - **Property 4: Deposit Amount Conservation**
    - Test with random amounts between 1 and 10,000 USDC
    - **Validates: Requirements 7.3**

- [x] 10. Implement E2E Tests - Order Flow
  - [x] 10.1 Write order submission E2E test
    - Create `packages/frontend/src/lib/__tests__/e2e/order.e2e.test.ts`
    - Test buy order submission with valid signature
    - Test sell order submission with valid signature
    - Verify orders appear in order book
    - _Requirements: 8.1, 8.2_
  
  - [x] 10.2 Write order rejection E2E tests
    - Test order rejection with insufficient balance
    - Test order rejection with invalid signature
    - _Requirements: 8.3, 8.4_
  
  - [x] 10.3 Write property test for signature validation
    - **Property 5: EIP-712 Signature Validation**
    - Generate random valid orders and verify signatures
    - **Validates: Requirements 8.5**

- [x] 11. Implement E2E Tests - Matching Flow
  - [x] 11.1 Write order matching E2E test
    - Create `packages/frontend/src/lib/__tests__/e2e/matching.e2e.test.ts`
    - Test crossing orders execute at maker price
    - Verify both parties' balances updated correctly
    - Test partial fill scenario
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [x] 11.2 Write property test for trade conservation
    - **Property 6: Trade Balance Conservation**
    - Generate random matching orders
    - Verify sum of balance changes equals zero
    - **Validates: Requirements 9.4**

- [x] 12. Implement E2E Tests - Settlement Flow
  - [x] 12.1 Write settlement E2E test
    - Create `packages/frontend/src/lib/__tests__/e2e/settlement.e2e.test.ts`
    - Test settlement batch creation
    - Verify Merkle root computation
    - Verify CTFExchange.matchOrders succeeds
    - Verify epoch marked as committed
    - _Requirements: 10.1, 10.2, 10.3_
  
  - [x] 12.2 Write property test for settlement completeness
    - **Property 7: Settlement Completeness**
    - Generate random batches
    - Verify all trades included in settlement
    - **Validates: Requirements 10.4**

- [x] 13. Implement E2E Tests - Withdrawal Flow
  - [x] 13.1 Write withdrawal E2E test
    - Create `packages/frontend/src/lib/__tests__/e2e/withdrawal.e2e.test.ts`
    - Test Merkle proof generation for positive balance
    - Test claim transaction succeeds
    - Verify USDC balance increases by claimed amount
    - Test double-claim is rejected
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [ ] 14. Checkpoint - Individual E2E Tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Implement Full Lifecycle E2E Test
  - [x] 15.1 Write full lifecycle E2E test
    - Create `packages/frontend/src/lib/__tests__/e2e/lifecycle.e2e.test.ts`
    - Execute complete flow: deposit → order → match → settle → withdraw
    - Verify final USDC balance reflects trading profit/loss
    - Verify test completes within 60 seconds
    - _Requirements: 12.1, 12.2, 12.4_
  
  - [x] 15.2 Write property test for total conservation
    - **Property 8: Total Lifecycle Conservation**
    - Run multiple lifecycle iterations
    - Verify no funds lost or created
    - **Validates: Requirements 12.3**

- [x] 16. Implement Error Handling E2E Tests
  - [x] 16.1 Write error handling E2E tests
    - Create `packages/frontend/src/lib/__tests__/e2e/errors.e2e.test.ts`
    - Test backend handles blockchain disconnection gracefully
    - Test contract revert errors propagate to frontend
    - Test SSE reconnection after connection drop
    - Test gas error handling and retry
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [ ] 17. Add CI/CD Integration
  - [ ] 17.1 Create E2E test npm scripts
    - Update `packages/frontend/package.json`
    - Add `e2e:setup`, `e2e:test`, `e2e:teardown` scripts
    - Add `e2e:ci` script for CI environment
    - _Requirements: 6.4_
  
  - [ ] 17.2 Create GitHub Actions workflow
    - Create `.github/workflows/e2e.yml`
    - Install Foundry, Bun, dependencies
    - Build contracts, run E2E tests
    - _Requirements: 6.4_

- [ ] 18. Update Environment Examples
  - [ ] 18.1 Update backend .env.example
    - Update `packages/backend/.env.example`
    - Add all required contract addresses
    - Add RPC_URL and OPERATOR_PRIVATE_KEY placeholders
    - Document each variable
    - _Requirements: 5.1, 5.2_
  
  - [ ] 18.2 Update frontend .env.example
    - Update `packages/frontend/.env.example`
    - Add VITE_EXCHANGE_ADDRESS, VITE_VAULT_ADDRESS, etc.
    - Add VITE_WALLETCONNECT_PROJECT_ID
    - Document each variable
    - _Requirements: 5.1, 5.2_

- [ ] 19. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Run full E2E test suite: `bun run e2e:test`
  - Verify all property tests pass with 100+ iterations

## Notes

- All tasks including property tests are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (8 properties total)
- E2E tests validate the complete trading lifecycle with real contracts
- The implementation follows the existing project structure conventions
