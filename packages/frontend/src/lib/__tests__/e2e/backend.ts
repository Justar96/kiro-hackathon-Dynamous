/**
 * Backend Server Management for E2E Tests
 *
 * Provides utilities for starting, stopping, and managing the backend server
 * during end-to-end testing.
 *
 * Requirements: 6.2
 */

import { spawn, type ChildProcess } from 'child_process';
import type { Address } from 'viem';

// ============================================
// Types
// ============================================

export interface BackendConfig {
  /** Port to run the backend on (default: 3001) */
  port?: number;
  /** Host to bind to (default: localhost) */
  host?: string;
  /** RPC URL for blockchain connection */
  rpcUrl: string;
  /** Chain ID */
  chainId: number;
  /** Contract addresses */
  contracts: {
    exchange: Address;
    vault: Address;
    usdc: Address;
    ctf: Address;
    marketFactory?: Address;
  };
  /** Operator private key for settlement */
  operatorPrivateKey?: string;
}

export interface BackendServer {
  /** The backend process */
  process: ChildProcess | null;
  /** URL to access the backend */
  url: string;
  /** Port the backend is running on */
  port: number;
  /** Start the backend server */
  start: (config: BackendConfig) => Promise<void>;
  /** Stop the backend server */
  stop: () => Promise<void>;
  /** Check if the backend is healthy */
  isHealthy: () => Promise<boolean>;
  /** Wait for the backend to be healthy */
  waitForHealthy: (timeoutMs?: number) => Promise<void>;
}

// ============================================
// Constants
// ============================================

const DEFAULT_PORT = 3001;
const DEFAULT_HOST = 'localhost';
const HEALTH_CHECK_TIMEOUT_MS = 30000;
const HEALTH_CHECK_INTERVAL_MS = 200;

// ============================================
// Implementation
// ============================================

/**
 * Create a backend server instance for E2E testing
 *
 * @returns BackendServer with control methods
 */
export function createBackendServer(): BackendServer {
  let process: ChildProcess | null = null;
  let serverUrl = '';
  let serverPort = DEFAULT_PORT;

  /**
   * Check if the backend is responding to health checks
   */
  const isHealthy = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${serverUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      if (!response.ok) return false;
      const data = await response.json();
      return data.status === 'ok' || data.status === 'degraded';
    } catch {
      return false;
    }
  };

  /**
   * Wait for the backend to be healthy
   */
  const waitForHealthy = async (timeoutMs: number = HEALTH_CHECK_TIMEOUT_MS): Promise<void> => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (await isHealthy()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_INTERVAL_MS));
    }
    throw new Error(`Backend failed to become healthy within ${timeoutMs}ms`);
  };

  /**
   * Start the backend server
   */
  const start = async (config: BackendConfig): Promise<void> => {
    if (process) {
      throw new Error('Backend is already running');
    }

    serverPort = config.port ?? DEFAULT_PORT;
    const host = config.host ?? DEFAULT_HOST;
    serverUrl = `http://${host}:${serverPort}`;

    // Check if backend is already running on this port
    if (await isHealthy()) {
      console.log(`[Backend] Already running on port ${serverPort}`);
      return;
    }

    console.log(`[Backend] Starting on port ${serverPort}...`);

    // Build environment variables
    const env: Record<string, string> = {
      ...process?.env as Record<string, string>,
      PORT: serverPort.toString(),
      HOST: host,
      CHAIN_ID: config.chainId.toString(),
      RPC_URL: config.rpcUrl,
      EXCHANGE_ADDRESS: config.contracts.exchange,
      VAULT_ADDRESS: config.contracts.vault,
      USDC_ADDRESS: config.contracts.usdc,
      CTF_ADDRESS: config.contracts.ctf,
    };

    if (config.contracts.marketFactory) {
      env.MARKET_FACTORY_ADDRESS = config.contracts.marketFactory;
    }

    if (config.operatorPrivateKey) {
      env.OPERATOR_PRIVATE_KEY = config.operatorPrivateKey;
    }

    // Start the backend using bun (use absolute path since PATH may not be inherited)
    const bunPath = '/home/ubuntu/.bun/bin/bun';
    // Use relative path from workspace root since tests run from packages/frontend
    const backendCwd = globalThis.process?.cwd()?.includes('packages/frontend') 
      ? '../../packages/backend' 
      : 'packages/backend';

    process = spawn(bunPath, ['run', 'dev'], {
      cwd: backendCwd,
      env: { ...globalThis.process?.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    // Capture output for debugging
    let stdout = '';
    let stderr = '';

    process.stdout?.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      // Log backend output for debugging
      if (globalThis.process?.env?.E2E_DEBUG) {
        console.log('[Backend stdout]', output.trim());
      }
    });

    process.stderr?.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      // Log backend errors
      if (globalThis.process?.env?.E2E_DEBUG) {
        console.error('[Backend stderr]', output.trim());
      }
    });

    process.on('error', (err) => {
      console.error('[Backend] Process error:', err);
      throw new Error(`Failed to start backend: ${err.message}`);
    });

    process.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error('[Backend] Process exited with code:', code);
        if (stdout) console.error('[Backend] stdout:', stdout.slice(-1000));
        if (stderr) console.error('[Backend] stderr:', stderr.slice(-1000));
      }
      process = null;
    });

    // Wait for backend to be healthy
    try {
      await waitForHealthy();
      console.log(`[Backend] Started successfully on ${serverUrl}`);
    } catch (err) {
      // If health check fails, stop the process and throw
      await stop();
      console.error('[Backend] Failed to start. Last stdout:', stdout.slice(-500));
      console.error('[Backend] Last stderr:', stderr.slice(-500));
      throw err;
    }
  };

  /**
   * Stop the backend server
   */
  const stop = async (): Promise<void> => {
    if (!process) {
      console.log('[Backend] Not running, nothing to stop');
      return;
    }

    console.log('[Backend] Stopping...');

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (process) {
          console.log('[Backend] Force killing...');
          process.kill('SIGKILL');
        }
      }, 5000);

      process!.on('exit', () => {
        clearTimeout(timeout);
        process = null;
        console.log('[Backend] Stopped');
        resolve();
      });

      process!.kill('SIGTERM');
    });
  };

  // Create the server object
  const server: BackendServer = {
    get process() {
      return process;
    },
    get url() {
      return serverUrl;
    },
    get port() {
      return serverPort;
    },
    start,
    stop,
    isHealthy,
    waitForHealthy,
  };

  return server;
}

/**
 * Start the backend server with the given configuration
 * Convenience function for simple use cases
 */
export async function startBackend(config: BackendConfig): Promise<BackendServer> {
  const server = createBackendServer();
  await server.start(config);
  return server;
}

/**
 * Stop a backend server
 */
export async function stopBackend(server: BackendServer): Promise<void> {
  await server.stop();
}

/**
 * Poll the backend health endpoint until healthy or timeout
 */
export async function waitForBackendHealthy(
  url: string,
  timeoutMs: number = HEALTH_CHECK_TIMEOUT_MS
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok' || data.status === 'degraded') {
          return;
        }
      }
    } catch {
      // Continue polling
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_INTERVAL_MS));
  }
  throw new Error(`Backend at ${url} failed to become healthy within ${timeoutMs}ms`);
}
