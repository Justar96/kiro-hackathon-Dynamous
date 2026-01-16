# Requirements Document

## Introduction

This feature focuses on polishing the hybrid CLOB trading implementation by removing all mock data and stub implementations, wiring the frontend to real backend API endpoints, connecting backend services to real blockchain contracts, and adding comprehensive E2E tests that exercise the full trading lifecycle with real wallet integration.

The hybrid CLOB trading spec has been fully implemented (all 20 tasks completed). This spec ensures production readiness by validating the complete flow: deposit → order → match → settle → withdraw.

## Glossary

- **E2E_Test_Suite**: The end-to-end testing framework that exercises the full trading lifecycle with real wallet signing and blockchain interactions
- **Anvil**: A local Ethereum development node from Foundry used for testing blockchain interactions
- **Contract_Deployer**: A script that deploys all required contracts (CTFExchange, SettlementVault, ConditionalTokens, MockERC20) to a local or test network
- **Frontend_Wiring**: The integration layer connecting React components and hooks to real backend API endpoints
- **Backend_Wiring**: The integration layer connecting Hono services to real blockchain contracts via ethers.js
- **Config_Manager**: The centralized configuration system for contract addresses and network settings
- **Test_Wallet**: A wallet account used in E2E tests with pre-funded balances for testing
- **Trading_Lifecycle**: The complete flow from deposit through order placement, matching, settlement, and withdrawal

## Requirements

### Requirement 1: Mock Data Removal

**User Story:** As a developer, I want all mock data and stub implementations removed from the codebase, so that the system operates with real data and logic.

#### Acceptance Criteria

1. WHEN the codebase is audited, THE Config_Manager SHALL contain no hardcoded zero addresses (0x0000...0000) for production contract addresses
2. WHEN the backend starts without RPC_URL configured, THE Backend_Wiring SHALL log a clear warning and disable blockchain-dependent features gracefully
3. WHEN the frontend loads without VITE_EXCHANGE_ADDRESS configured, THE Frontend_Wiring SHALL display a configuration error to the user
4. THE Config_Manager SHALL load contract addresses from environment variables for all networks (local, testnet, mainnet)

### Requirement 2: Contract Deployment Scripts

**User Story:** As a developer, I want deployment scripts for local development, so that I can test the full system with real contracts.

#### Acceptance Criteria

1. WHEN running the deployment script, THE Contract_Deployer SHALL deploy CTFExchange, SettlementVault, ConditionalTokens, and MockERC20 contracts to the target network
2. WHEN deployment completes, THE Contract_Deployer SHALL output all deployed contract addresses in a format suitable for environment configuration
3. WHEN deploying to Anvil, THE Contract_Deployer SHALL fund test accounts with USDC and native tokens
4. THE Contract_Deployer SHALL verify contract deployments by calling view functions on each deployed contract

### Requirement 3: Frontend-Backend Wiring

**User Story:** As a user, I want the frontend to communicate with real backend endpoints, so that my trading actions are processed correctly.

#### Acceptance Criteria

1. WHEN a user submits an order via OrderForm, THE Frontend_Wiring SHALL send the signed order to POST /api/orders and display the result
2. WHEN a user views the order book, THE Frontend_Wiring SHALL fetch real-time data from GET /api/orderbook/:marketId/:tokenId
3. WHEN a user connects their wallet, THE Frontend_Wiring SHALL fetch their balances from GET /api/balances/:addr
4. WHEN a user initiates a deposit, THE Frontend_Wiring SHALL call the SettlementVault.deposit function via wagmi
5. WHEN a user claims a withdrawal, THE Frontend_Wiring SHALL fetch the Merkle proof from GET /api/settlement/proof/:epochId/:addr and call SettlementVault.claim
6. WHEN the backend returns an error, THE Frontend_Wiring SHALL display a user-friendly error message

### Requirement 4: Backend-Contract Wiring

**User Story:** As a system operator, I want the backend to interact with real blockchain contracts, so that trades are settled on-chain.

#### Acceptance Criteria

1. WHEN the backend starts with valid RPC_URL and contract addresses, THE Backend_Wiring SHALL initialize ethers.js providers and contract instances
2. WHEN the Indexer detects a deposit event, THE Backend_Wiring SHALL credit the user's off-chain balance after required confirmations
3. WHEN the Settlement service creates a batch, THE Backend_Wiring SHALL call CTFExchange.matchOrders for each trade
4. WHEN a settlement transaction fails, THE Backend_Wiring SHALL retry with exponential backoff up to 3 times
5. WHEN the Reconciliation service runs, THE Backend_Wiring SHALL compare off-chain ledger totals with on-chain SettlementVault balances

### Requirement 5: Environment Configuration

**User Story:** As a developer, I want a clear configuration system, so that I can easily switch between local, testnet, and mainnet environments.

#### Acceptance Criteria

1. THE Config_Manager SHALL support three environments: local (Anvil), testnet (Polygon Amoy), and mainnet (Polygon)
2. WHEN environment variables are missing, THE Config_Manager SHALL provide sensible defaults for local development
3. THE Config_Manager SHALL validate all required addresses are valid Ethereum addresses on startup
4. THE Config_Manager SHALL export a typed configuration object for use in both frontend and backend

### Requirement 6: E2E Test Infrastructure

**User Story:** As a developer, I want E2E test infrastructure, so that I can validate the complete trading lifecycle.

#### Acceptance Criteria

1. WHEN running E2E tests, THE E2E_Test_Suite SHALL start an Anvil node with deployed contracts
2. WHEN running E2E tests, THE E2E_Test_Suite SHALL start the backend server connected to the Anvil node
3. THE E2E_Test_Suite SHALL provide test wallets with pre-funded USDC balances
4. THE E2E_Test_Suite SHALL support running tests in CI/CD environments
5. WHEN a test fails, THE E2E_Test_Suite SHALL provide detailed logs including transaction hashes and error messages

### Requirement 7: Deposit Flow E2E Test

**User Story:** As a developer, I want to test the deposit flow end-to-end, so that I can verify users can fund their trading accounts.

#### Acceptance Criteria

1. WHEN a Test_Wallet approves and deposits USDC to SettlementVault, THE E2E_Test_Suite SHALL verify the on-chain deposit event is emitted
2. WHEN the Indexer processes the deposit, THE E2E_Test_Suite SHALL verify the off-chain balance is credited
3. FOR ALL deposit amounts between 1 USDC and 10,000 USDC, THE E2E_Test_Suite SHALL verify the deposited amount equals the credited balance

### Requirement 8: Order Submission E2E Test

**User Story:** As a developer, I want to test order submission end-to-end, so that I can verify users can place orders.

#### Acceptance Criteria

1. WHEN a Test_Wallet signs and submits a buy order, THE E2E_Test_Suite SHALL verify the order appears in the order book
2. WHEN a Test_Wallet signs and submits a sell order, THE E2E_Test_Suite SHALL verify the order appears in the order book
3. WHEN an order is submitted with insufficient balance, THE E2E_Test_Suite SHALL verify the order is rejected with appropriate error
4. WHEN an order is submitted with invalid signature, THE E2E_Test_Suite SHALL verify the order is rejected with appropriate error
5. FOR ALL valid order parameters, THE E2E_Test_Suite SHALL verify the EIP-712 signature is validated correctly

### Requirement 9: Order Matching E2E Test

**User Story:** As a developer, I want to test order matching end-to-end, so that I can verify trades execute correctly.

#### Acceptance Criteria

1. WHEN two crossing orders are submitted (buy at 60¢, sell at 55¢), THE E2E_Test_Suite SHALL verify a trade is executed at the maker price
2. WHEN a trade executes, THE E2E_Test_Suite SHALL verify both parties' balances are updated correctly
3. WHEN a partial fill occurs, THE E2E_Test_Suite SHALL verify the remaining order quantity is correct
4. FOR ALL matching order pairs, THE E2E_Test_Suite SHALL verify the sum of balance changes equals zero (conservation)

### Requirement 10: Settlement E2E Test

**User Story:** As a developer, I want to test settlement end-to-end, so that I can verify trades are settled on-chain.

#### Acceptance Criteria

1. WHEN a settlement batch is created, THE E2E_Test_Suite SHALL verify the Merkle root is computed correctly
2. WHEN settlement transactions are submitted, THE E2E_Test_Suite SHALL verify CTFExchange.matchOrders succeeds
3. WHEN settlement completes, THE E2E_Test_Suite SHALL verify the epoch is marked as committed
4. FOR ALL trades in a batch, THE E2E_Test_Suite SHALL verify each trade is included in the settlement

### Requirement 11: Withdrawal E2E Test

**User Story:** As a developer, I want to test withdrawal end-to-end, so that I can verify users can claim their funds.

#### Acceptance Criteria

1. WHEN a user has a positive balance in a committed epoch, THE E2E_Test_Suite SHALL verify a valid Merkle proof is generated
2. WHEN a user claims with a valid proof, THE E2E_Test_Suite SHALL verify the SettlementVault.claim transaction succeeds
3. WHEN a user claims, THE E2E_Test_Suite SHALL verify their USDC balance increases by the claimed amount
4. WHEN a user attempts to claim twice, THE E2E_Test_Suite SHALL verify the second claim is rejected

### Requirement 12: Full Lifecycle E2E Test

**User Story:** As a developer, I want to test the complete trading lifecycle, so that I can verify the entire system works together.

#### Acceptance Criteria

1. THE E2E_Test_Suite SHALL execute the complete flow: deposit → order → match → settle → withdraw
2. WHEN the full lifecycle completes, THE E2E_Test_Suite SHALL verify the user's final USDC balance reflects their trading profit/loss
3. FOR ALL lifecycle executions, THE E2E_Test_Suite SHALL verify no funds are lost or created (total conservation)
4. THE E2E_Test_Suite SHALL complete the full lifecycle test within 60 seconds on a local Anvil node

### Requirement 13: Error Handling E2E Tests

**User Story:** As a developer, I want to test error scenarios, so that I can verify the system handles failures gracefully.

#### Acceptance Criteria

1. WHEN the backend loses connection to the blockchain, THE E2E_Test_Suite SHALL verify appropriate error responses are returned
2. WHEN a contract call reverts, THE E2E_Test_Suite SHALL verify the error is propagated to the frontend with a user-friendly message
3. WHEN the SSE connection drops, THE E2E_Test_Suite SHALL verify the frontend reconnects automatically
4. WHEN a transaction runs out of gas, THE E2E_Test_Suite SHALL verify the error is logged and the operation can be retried

