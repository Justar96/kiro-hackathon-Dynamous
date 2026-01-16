/**
 * E2E Test Setup and Teardown
 *
 * Provides the main setup function that orchestrates starting Anvil,
 * deploying contracts, and starting the backend for E2E tests.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.5
 */

import { spawn } from 'child_process';
import { createPublicClient, http, type Address, type Hex, parseUnits } from 'viem';
import { foundry } from 'viem/chains';
import { createAnvilInstance, type AnvilInstance } from './anvil';
import { createBackendServer, type BackendServer } from './backend';
import { createTestWallets, ANVIL_ACCOUNTS, type TestWallet } from './wallets';

// ============================================
// Types
// ============================================

export interface DeployedContracts {
  usdc: Address;
  conditionalTokens: Address;
  ctfExchange: Address;
  settlementVault: Address;
  marketFactory: Address;
}

export interface E2ETestContext {
  /** Anvil node instance */
  anvil: AnvilInstance;
  /** Backend server instance */
  backend: BackendServer;
  /** Test wallets with funded balances */
  wallets: {
    deployer: TestWallet;
    alice: TestWallet;
    bob: TestWallet;
    charlie: TestWallet;
    operator: TestWallet;
  };
  /** Deployed contract addresses */
  contracts: DeployedContracts;
  /** Chain ID */
  chainId: number;
  /** RPC URL */
  rpcUrl: string;
  /** Backend URL */
  backendUrl: string;
  /** Cleanup function */
  cleanup: () => Promise<void>;
  /** Captured logs for debugging */
  logs: string[];
}

export interface E2ESetupConfig {
  /** Port for Anvil (default: 8545) */
  anvilPort?: number;
  /** Port for backend (default: 3001) */
  backendPort?: number;
  /** Whether to skip starting Anvil (use existing) */
  skipAnvil?: boolean;
  /** Whether to skip starting backend (use existing) */
  skipBackend?: boolean;
  /** Whether to skip contract deployment (use existing) */
  skipDeploy?: boolean;
  /** Existing contract addresses (if skipDeploy is true) */
  existingContracts?: DeployedContracts;
  /** Enable debug logging */
  debug?: boolean;
}

// ============================================
// Constants
// ============================================

const DEFAULT_ANVIL_PORT = 8545;
const DEFAULT_BACKEND_PORT = 3001;
const CHAIN_ID = 31337;

// Operator private key (Anvil account 0)
const OPERATOR_PRIVATE_KEY = ANVIL_ACCOUNTS.deployer.privateKey;

// ============================================
// Contract Deployment
// ============================================

/**
 * Deploy contracts using Foundry script
 */
async function deployContracts(rpcUrl: string, debug: boolean = false): Promise<DeployedContracts> {
  return new Promise((resolve, reject) => {
    console.log('[E2E Setup] Deploying contracts...');

    // Use absolute path to forge since PATH may not be inherited correctly
    const forgePath = '/home/ubuntu/.foundry/bin/forge';
    // Use absolute path to contracts directory since tests run from packages/frontend
    const contractsDir = process.cwd().includes('packages/frontend') 
      ? '../../contracts' 
      : 'contracts';

    const deployProcess = spawn(
      forgePath,
      [
        'script',
        'script/DeployLocal.s.sol:DeployLocal',
        '--rpc-url', rpcUrl,
        '--broadcast',
        '--private-key', OPERATOR_PRIVATE_KEY,
      ],
      {
        cwd: contractsDir,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let stdout = '';
    let stderr = '';

    deployProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      if (debug) {
        console.log('[Deploy stdout]', output.trim());
      }
    });

    deployProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      if (debug) {
        console.error('[Deploy stderr]', output.trim());
      }
    });

    deployProcess.on('error', (err) => {
      reject(new Error(`Failed to run deployment script: ${err.message}`));
    });

    deployProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error('[E2E Setup] Deployment failed');
        console.error('stdout:', stdout);
        console.error('stderr:', stderr);
        reject(new Error(`Deployment script exited with code ${code}`));
        return;
      }

      // Parse addresses from output
      const contracts = parseDeploymentOutput(stdout);
      if (!contracts) {
        reject(new Error('Failed to parse deployment output'));
        return;
      }

      console.log('[E2E Setup] Contracts deployed successfully');
      resolve(contracts);
    });
  });
}

/**
 * Parse contract addresses from deployment script output
 */
function parseDeploymentOutput(output: string): DeployedContracts | null {
  const extractAddress = (pattern: string): Address | null => {
    const regex = new RegExp(`${pattern}=?(0x[a-fA-F0-9]{40})`, 'i');
    const match = output.match(regex);
    return match ? (match[1] as Address) : null;
  };

  // Try different patterns used in the deployment script
  const usdc = extractAddress('USDC_ADDRESS') || extractAddress('MockERC20 \\(USDC\\):');
  const conditionalTokens = extractAddress('CTF_ADDRESS') || extractAddress('ConditionalTokens:');
  const ctfExchange = extractAddress('EXCHANGE_ADDRESS') || extractAddress('CTFExchange:');
  const settlementVault = extractAddress('VAULT_ADDRESS') || extractAddress('SettlementVault:');
  const marketFactory = extractAddress('MARKET_FACTORY_ADDRESS') || extractAddress('MarketFactory:');

  if (!usdc || !conditionalTokens || !ctfExchange || !settlementVault || !marketFactory) {
    console.error('[E2E Setup] Failed to extract all addresses from deployment output');
    console.error('Extracted:', { usdc, conditionalTokens, ctfExchange, settlementVault, marketFactory });
    return null;
  }

  return {
    usdc,
    conditionalTokens,
    ctfExchange,
    settlementVault,
    marketFactory,
  };
}

// ============================================
// Main Setup Function
// ============================================

/**
 * Create an E2E test context with all infrastructure running
 *
 * This function:
 * 1. Starts an Anvil node (or uses existing)
 * 2. Deploys all contracts (or uses existing)
 * 3. Starts the backend server (or uses existing)
 * 4. Creates test wallets with funded balances
 *
 * @param config - Setup configuration options
 * @returns E2ETestContext with all infrastructure ready
 */
export async function createE2EContext(config: E2ESetupConfig = {}): Promise<E2ETestContext> {
  const {
    anvilPort = DEFAULT_ANVIL_PORT,
    backendPort = DEFAULT_BACKEND_PORT,
    skipAnvil = false,
    skipBackend = false,
    skipDeploy = false,
    existingContracts,
    debug = false,
  } = config;

  const logs: string[] = [];
  const log = (message: string) => {
    logs.push(`[${new Date().toISOString()}] ${message}`);
    if (debug) {
      console.log(message);
    }
  };

  log('[E2E Setup] Starting E2E test context...');

  // 1. Start Anvil
  const anvil = createAnvilInstance({ port: anvilPort, chainId: CHAIN_ID });
  const rpcUrl = anvil.rpcUrl;

  if (!skipAnvil) {
    log('[E2E Setup] Starting Anvil...');
    await anvil.start();
    log(`[E2E Setup] Anvil started on ${rpcUrl}`);
  } else {
    log('[E2E Setup] Skipping Anvil start (using existing)');
    // Verify Anvil is running
    if (!(await anvil.isRunning())) {
      throw new Error(`Anvil is not running on port ${anvilPort}`);
    }
  }

  // 2. Deploy contracts
  let contracts: DeployedContracts;
  if (skipDeploy && existingContracts) {
    log('[E2E Setup] Using existing contracts');
    contracts = existingContracts;
  } else {
    log('[E2E Setup] Deploying contracts...');
    contracts = await deployContracts(rpcUrl, debug);
    log('[E2E Setup] Contracts deployed');
  }

  // 3. Create test wallets
  log('[E2E Setup] Creating test wallets...');
  const wallets = createTestWallets({ rpcUrl, chainId: CHAIN_ID });
  log('[E2E Setup] Test wallets created');

  // 4. Start backend
  const backend = createBackendServer();
  const backendUrl = `http://localhost:${backendPort}`;

  if (!skipBackend) {
    log('[E2E Setup] Starting backend...');
    await backend.start({
      port: backendPort,
      rpcUrl,
      chainId: CHAIN_ID,
      contracts: {
        exchange: contracts.ctfExchange,
        vault: contracts.settlementVault,
        usdc: contracts.usdc,
        ctf: contracts.conditionalTokens,
        marketFactory: contracts.marketFactory,
      },
      operatorPrivateKey: OPERATOR_PRIVATE_KEY,
    });
    log(`[E2E Setup] Backend started on ${backendUrl}`);
  } else {
    log('[E2E Setup] Skipping backend start (using existing)');
    // Verify backend is running
    if (!(await backend.isHealthy())) {
      throw new Error(`Backend is not running on port ${backendPort}`);
    }
  }

  // 5. Create cleanup function
  const cleanup = async () => {
    log('[E2E Setup] Cleaning up...');

    if (!skipBackend) {
      await backend.stop();
    }

    if (!skipAnvil) {
      await anvil.stop();
    }

    log('[E2E Setup] Cleanup complete');
  };

  log('[E2E Setup] E2E test context ready');

  return {
    anvil,
    backend,
    wallets,
    contracts,
    chainId: CHAIN_ID,
    rpcUrl,
    backendUrl,
    cleanup,
    logs,
  };
}

/**
 * Cleanup an E2E test context
 */
export async function cleanupE2EContext(context: E2ETestContext): Promise<void> {
  await context.cleanup();
}

// ============================================
// Test Lifecycle Helpers
// ============================================

/**
 * Reset the E2E context to initial state
 * Useful between tests to ensure clean state
 */
export async function resetE2EContext(context: E2ETestContext): Promise<void> {
  console.log('[E2E Setup] Resetting context...');
  await context.anvil.reset();
  console.log('[E2E Setup] Context reset complete');
}

/**
 * Take a snapshot of the current state
 * Returns a snapshot ID that can be used to revert later
 */
export async function snapshotE2EContext(context: E2ETestContext): Promise<Hex> {
  return context.anvil.snapshot();
}

/**
 * Revert to a previous snapshot
 */
export async function revertE2EContext(context: E2ETestContext, snapshotId: Hex): Promise<void> {
  await context.anvil.revert(snapshotId);
}

// ============================================
// Vitest Integration
// ============================================

/**
 * Global E2E context for use in tests
 * Set by beforeAll, cleared by afterAll
 */
let globalE2EContext: E2ETestContext | null = null;

/**
 * Get the global E2E context
 * Throws if not initialized
 */
export function getE2EContext(): E2ETestContext {
  if (!globalE2EContext) {
    throw new Error('E2E context not initialized. Call setupE2ETests() in beforeAll.');
  }
  return globalE2EContext;
}

/**
 * Setup E2E tests - call in beforeAll
 */
export async function setupE2ETests(config?: E2ESetupConfig): Promise<E2ETestContext> {
  globalE2EContext = await createE2EContext(config);
  return globalE2EContext;
}

/**
 * Teardown E2E tests - call in afterAll
 */
export async function teardownE2ETests(): Promise<void> {
  if (globalE2EContext) {
    await globalE2EContext.cleanup();
    globalE2EContext = null;
  }
}

/**
 * Reset E2E state between tests - call in beforeEach
 */
export async function resetE2EState(): Promise<void> {
  if (globalE2EContext) {
    await resetE2EContext(globalE2EContext);
  }
}
