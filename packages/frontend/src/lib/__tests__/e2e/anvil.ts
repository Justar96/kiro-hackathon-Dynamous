/**
 * Anvil Management Utilities for E2E Tests
 *
 * Provides utilities for starting, stopping, and controlling a local Anvil node
 * for end-to-end testing of the trading system.
 *
 * Requirements: 6.1
 */

import { spawn, type ChildProcess } from 'child_process';
import { createPublicClient, http, type Address, type Hex, parseEther } from 'viem';
import { foundry } from 'viem/chains';

// ============================================
// Types
// ============================================

export interface AnvilConfig {
  /** Port to run Anvil on (default: 8545) */
  port?: number;
  /** Block time in seconds (default: 1) */
  blockTime?: number;
  /** Number of accounts to create (default: 10) */
  accounts?: number;
  /** Initial balance for each account in ETH (default: 10000) */
  balance?: number;
  /** Chain ID (default: 31337) */
  chainId?: number;
}

export interface AnvilInstance {
  /** The Anvil process */
  process: ChildProcess;
  /** RPC URL for connecting to Anvil */
  rpcUrl: string;
  /** Chain ID */
  chainId: number;
  /** Port Anvil is running on */
  port: number;
  /** Start the Anvil node */
  start: () => Promise<void>;
  /** Stop the Anvil node */
  stop: () => Promise<void>;
  /** Reset the Anvil state to initial snapshot */
  reset: () => Promise<void>;
  /** Mine a specific number of blocks */
  mineBlocks: (count: number) => Promise<void>;
  /** Advance time by a number of seconds */
  advanceTime: (seconds: number) => Promise<void>;
  /** Set the balance of an address */
  setBalance: (address: Address, balance: bigint) => Promise<void>;
  /** Take a snapshot of the current state */
  snapshot: () => Promise<Hex>;
  /** Revert to a specific snapshot */
  revert: (snapshotId: Hex) => Promise<void>;
  /** Check if Anvil is running */
  isRunning: () => Promise<boolean>;
}

// ============================================
// Constants
// ============================================

const DEFAULT_CONFIG: Required<AnvilConfig> = {
  port: 8545,
  blockTime: 1,
  accounts: 10,
  balance: 10000,
  chainId: 31337,
};

const STARTUP_TIMEOUT_MS = 30000;
const STARTUP_POLL_INTERVAL_MS = 100;

// ============================================
// Implementation
// ============================================

/**
 * Create an Anvil instance for E2E testing
 *
 * @param config - Configuration options for Anvil
 * @returns AnvilInstance with control methods
 */
export function createAnvilInstance(config: AnvilConfig = {}): AnvilInstance {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const rpcUrl = `http://127.0.0.1:${mergedConfig.port}`;

  let process: ChildProcess | null = null;
  let initialSnapshotId: Hex | null = null;

  const client = createPublicClient({
    chain: { ...foundry, id: mergedConfig.chainId },
    transport: http(rpcUrl),
  });

  /**
   * Check if Anvil is responding to RPC calls
   */
  const isRunning = async (): Promise<boolean> => {
    try {
      await client.getBlockNumber();
      return true;
    } catch {
      return false;
    }
  };

  /**
   * Wait for Anvil to be ready
   */
  const waitForReady = async (): Promise<void> => {
    const startTime = Date.now();
    while (Date.now() - startTime < STARTUP_TIMEOUT_MS) {
      if (await isRunning()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, STARTUP_POLL_INTERVAL_MS));
    }
    throw new Error(`Anvil failed to start within ${STARTUP_TIMEOUT_MS}ms`);
  };

  /**
   * Start the Anvil node
   */
  const start = async (): Promise<void> => {
    if (process) {
      throw new Error('Anvil is already running');
    }

    // Check if Anvil is already running on this port
    if (await isRunning()) {
      console.log(`[Anvil] Already running on port ${mergedConfig.port}`);
      // Take initial snapshot for reset
      initialSnapshotId = await snapshot();
      return;
    }

    const args = [
      '--port', mergedConfig.port.toString(),
      '--accounts', mergedConfig.accounts.toString(),
      '--balance', mergedConfig.balance.toString(),
      '--chain-id', mergedConfig.chainId.toString(),
    ];

    if (mergedConfig.blockTime > 0) {
      args.push('--block-time', mergedConfig.blockTime.toString());
    }

    console.log(`[Anvil] Starting on port ${mergedConfig.port}...`);

    process = spawn('anvil', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    // Capture output for debugging
    let stdout = '';
    let stderr = '';

    process.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('error', (err) => {
      console.error('[Anvil] Process error:', err);
      throw new Error(`Failed to start Anvil: ${err.message}`);
    });

    process.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error('[Anvil] Process exited with code:', code);
        console.error('[Anvil] stdout:', stdout);
        console.error('[Anvil] stderr:', stderr);
      }
      process = null;
    });

    // Wait for Anvil to be ready
    await waitForReady();
    console.log(`[Anvil] Started successfully on port ${mergedConfig.port}`);

    // Take initial snapshot for reset
    initialSnapshotId = await snapshot();
  };

  /**
   * Stop the Anvil node
   */
  const stop = async (): Promise<void> => {
    if (!process) {
      console.log('[Anvil] Not running, nothing to stop');
      return;
    }

    console.log('[Anvil] Stopping...');

    return new Promise((resolve) => {
      process!.on('exit', () => {
        process = null;
        console.log('[Anvil] Stopped');
        resolve();
      });

      process!.kill('SIGTERM');

      // Force kill after timeout
      setTimeout(() => {
        if (process) {
          process.kill('SIGKILL');
        }
      }, 5000);
    });
  };

  /**
   * Reset Anvil state to initial snapshot
   */
  const reset = async (): Promise<void> => {
    if (!initialSnapshotId) {
      throw new Error('No initial snapshot available');
    }
    await revert(initialSnapshotId);
    // Take a new snapshot since revert consumes the snapshot
    initialSnapshotId = await snapshot();
  };

  /**
   * Mine a specific number of blocks
   */
  const mineBlocks = async (count: number): Promise<void> => {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'anvil_mine',
        params: [count],
        id: 1,
      }),
    });

    const result = await response.json();
    if (result.error) {
      throw new Error(`Failed to mine blocks: ${result.error.message}`);
    }
  };

  /**
   * Advance time by a number of seconds
   */
  const advanceTime = async (seconds: number): Promise<void> => {
    // Increase time
    const increaseResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'evm_increaseTime',
        params: [seconds],
        id: 1,
      }),
    });

    const increaseResult = await increaseResponse.json();
    if (increaseResult.error) {
      throw new Error(`Failed to increase time: ${increaseResult.error.message}`);
    }

    // Mine a block to apply the time change
    await mineBlocks(1);
  };

  /**
   * Set the balance of an address
   */
  const setBalance = async (address: Address, balance: bigint): Promise<void> => {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'anvil_setBalance',
        params: [address, `0x${balance.toString(16)}`],
        id: 1,
      }),
    });

    const result = await response.json();
    if (result.error) {
      throw new Error(`Failed to set balance: ${result.error.message}`);
    }
  };

  /**
   * Take a snapshot of the current state
   */
  const snapshot = async (): Promise<Hex> => {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'evm_snapshot',
        params: [],
        id: 1,
      }),
    });

    const result = await response.json();
    if (result.error) {
      throw new Error(`Failed to take snapshot: ${result.error.message}`);
    }

    return result.result as Hex;
  };

  /**
   * Revert to a specific snapshot
   */
  const revert = async (snapshotId: Hex): Promise<void> => {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'evm_revert',
        params: [snapshotId],
        id: 1,
      }),
    });

    const result = await response.json();
    if (result.error) {
      throw new Error(`Failed to revert snapshot: ${result.error.message}`);
    }
  };

  // Create the instance object
  const instance: AnvilInstance = {
    get process() {
      return process!;
    },
    rpcUrl,
    chainId: mergedConfig.chainId,
    port: mergedConfig.port,
    start,
    stop,
    reset,
    mineBlocks,
    advanceTime,
    setBalance,
    snapshot,
    revert,
    isRunning,
  };

  return instance;
}

/**
 * Start Anvil with default configuration
 * Convenience function for simple use cases
 */
export async function startAnvil(config?: AnvilConfig): Promise<AnvilInstance> {
  const instance = createAnvilInstance(config);
  await instance.start();
  return instance;
}

/**
 * Stop an Anvil instance
 */
export async function stopAnvil(instance: AnvilInstance): Promise<void> {
  await instance.stop();
}

/**
 * Reset an Anvil instance to its initial state
 */
export async function resetAnvil(instance: AnvilInstance): Promise<void> {
  await instance.reset();
}

/**
 * Mine blocks on an Anvil instance
 */
export async function mineBlocks(instance: AnvilInstance, count: number): Promise<void> {
  await instance.mineBlocks(count);
}

/**
 * Advance time on an Anvil instance
 */
export async function advanceTime(instance: AnvilInstance, seconds: number): Promise<void> {
  await instance.advanceTime(seconds);
}

/**
 * Set balance for an address on an Anvil instance
 */
export async function setBalance(
  instance: AnvilInstance,
  address: Address,
  balance: bigint
): Promise<void> {
  await instance.setBalance(address, balance);
}
