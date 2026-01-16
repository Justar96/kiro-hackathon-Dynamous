/**
 * E2E Test Types
 *
 * Type definitions for E2E testing infrastructure.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.5
 */

import type { Address, Hex } from 'viem';

// Re-export types from other modules for convenience
export type { AnvilConfig, AnvilInstance } from './anvil';
export type { BackendConfig, BackendServer } from './backend';
export type {
  TestWallet,
  TestWalletConfig,
  SignTypedDataParams,
  SendTransactionParams,
  OrderStruct,
} from './wallets';
export type {
  DeployedContracts,
  E2ETestContext,
  E2ESetupConfig,
} from './setup';
export type {
  OrderParams,
  OrderResult,
  OrderBook,
  SettlementBatch,
  WithdrawalProof,
} from './helpers';

// ============================================
// Error Types
// ============================================

/**
 * E2E test error with context
 */
export interface E2EErrorReport {
  /** Name of the test that failed */
  testName: string;
  /** Step where the error occurred */
  step: string;
  /** The error that occurred */
  error: Error;
  /** Additional context for debugging */
  context: E2EErrorContext;
  /** Logs captured during the test */
  logs: string[];
  /** Anvil state snapshot (if available) */
  stateSnapshot?: Hex;
}

export interface E2EErrorContext {
  /** Wallet address involved */
  walletAddress?: Address;
  /** Transaction hash (if applicable) */
  transactionHash?: Hex;
  /** Block number (if applicable) */
  blockNumber?: number;
  /** Contract address (if applicable) */
  contractAddress?: Address;
  /** Function name (if applicable) */
  functionName?: string;
  /** Function arguments (if applicable) */
  args?: unknown[];
}

// ============================================
// Test Scenario Types
// ============================================

/**
 * A test scenario definition
 */
export interface TestScenario {
  /** Scenario name */
  name: string;
  /** Scenario description */
  description: string;
  /** Setup function */
  setup?: (ctx: import('./setup').E2ETestContext) => Promise<void>;
  /** Test steps */
  steps: TestStep[];
  /** Teardown function */
  teardown?: (ctx: import('./setup').E2ETestContext) => Promise<void>;
}

/**
 * A single test step
 */
export interface TestStep {
  /** Step name */
  name: string;
  /** Action to perform */
  action: (ctx: import('./setup').E2ETestContext) => Promise<void>;
  /** Assertion to verify */
  assertion?: (ctx: import('./setup').E2ETestContext) => Promise<void>;
}

// ============================================
// Trading Types
// ============================================

/**
 * Side enum matching backend
 */
export const Side = {
  BUY: 0,
  SELL: 1,
} as const;

export type SideType = (typeof Side)[keyof typeof Side];

/**
 * Match type enum matching backend
 */
export const MatchType = {
  COMPLEMENTARY: 0,
  MINT: 1,
  MERGE: 2,
} as const;

export type MatchTypeValue = (typeof MatchType)[keyof typeof MatchType];

/**
 * Signature type enum
 */
export const SignatureType = {
  EOA: 0,
  POLY_PROXY: 1,
  POLY_GNOSIS_SAFE: 2,
} as const;

export type SignatureTypeValue = (typeof SignatureType)[keyof typeof SignatureType];

// ============================================
// Balance Types
// ============================================

/**
 * Token balance
 */
export interface TokenBalance {
  available: bigint;
  locked: bigint;
  total: bigint;
}

/**
 * User balances response
 */
export interface BalancesResponse {
  address: string;
  balances: Record<string, {
    available: string;
    locked: string;
    total: string;
  }>;
  nonce: string;
}

// ============================================
// Settlement Types
// ============================================

/**
 * Settlement status
 */
export type SettlementStatus =
  | 'pending'
  | 'settling'
  | 'committed'
  | 'failed'
  | 'retrying';

/**
 * Settlement epoch info
 */
export interface SettlementEpoch {
  epochId: number;
  merkleRoot: string;
  tradeCount: number;
  status: SettlementStatus;
  timestamp: number;
}

// ============================================
// Health Check Types
// ============================================

/**
 * Backend health response
 */
export interface HealthResponse {
  status: 'ok' | 'degraded';
  paused: boolean;
  timestamp: number;
  services: {
    ledger: boolean;
    matchingEngine: boolean;
    riskEngine: boolean;
    settlement: boolean;
    reconciliation: boolean;
    indexer: boolean;
  };
}
