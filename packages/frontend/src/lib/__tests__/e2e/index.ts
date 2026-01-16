/**
 * E2E Test Infrastructure
 *
 * Main entry point for E2E testing utilities.
 * Exports all utilities for starting Anvil, backend, and running E2E tests.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.5
 */

// Anvil management
export {
  createAnvilInstance,
  startAnvil,
  stopAnvil,
  resetAnvil,
  mineBlocks as anvilMineBlocks,
  advanceTime as anvilAdvanceTime,
  setBalance as anvilSetBalance,
  type AnvilConfig,
  type AnvilInstance,
} from './anvil';

// Backend management
export {
  createBackendServer,
  startBackend,
  stopBackend,
  waitForBackendHealthy,
  type BackendConfig,
  type BackendServer,
} from './backend';

// Test wallets
export {
  createTestWallet,
  createTestWallets,
  ANVIL_ACCOUNTS,
  signOrder,
  createOrder,
  generateSalt,
  getOrderDomain,
  ORDER_TYPES,
  type TestWallet,
  type TestWalletConfig,
  type SignTypedDataParams,
  type SendTransactionParams,
  type OrderStruct,
} from './wallets';

// E2E setup
export {
  createE2EContext,
  cleanupE2EContext,
  resetE2EContext,
  snapshotE2EContext,
  revertE2EContext,
  getE2EContext,
  setupE2ETests,
  teardownE2ETests,
  resetE2EState,
  type DeployedContracts,
  type E2ETestContext,
  type E2ESetupConfig,
} from './setup';

// Test helpers
export {
  // Deposit helpers
  approveUsdc,
  deposit,
  depositAndWaitForCredit,
  // Order helpers
  submitOrder,
  cancelOrder,
  // Order book helpers
  getOrderBook,
  waitForOrderBook,
  waitForBid,
  waitForAsk,
  // Settlement helpers
  triggerSettlement,
  getSettlementEpochs,
  getWithdrawalProof,
  // Withdrawal helpers
  claimWithdrawal,
  // Balance helpers
  getUsdcBalance,
  getVaultBalance,
  getOffChainBalance,
  // Mining helpers
  mineBlocks,
  advanceTime,
  // Utility helpers
  parseUsdc,
  formatUsdc,
  generateMarketId,
  waitFor,
  type OrderParams,
  type OrderResult,
  type OrderBook,
  type SettlementBatch,
  type WithdrawalProof,
} from './helpers';

// Types
export {
  Side,
  MatchType,
  SignatureType,
  type SideType,
  type MatchTypeValue,
  type SignatureTypeValue,
  type TokenBalance,
  type BalancesResponse,
  type SettlementStatus,
  type SettlementEpoch,
  type HealthResponse,
  type E2EErrorReport,
  type E2EErrorContext,
  type TestScenario,
  type TestStep,
} from './types';
