/**
 * Reconciliation Service
 * 
 * Provides continuous balance verification between off-chain ledger and on-chain
 * SettlementVault. Implements discrepancy detection, threshold alerting, and
 * system pause functionality for critical discrepancies.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { ethers } from "ethers";
import type { Ledger } from "./ledger";

// ============ Types ============

/**
 * Result of a single user's reconciliation check
 */
export interface UserDiscrepancy {
  user: string;
  onChain: bigint;
  offChain: bigint;
  difference: bigint;
}

/**
 * Result of a full reconciliation run
 */
export interface ReconciliationResult {
  timestamp: number;
  onChainTotal: bigint;
  offChainTotal: bigint;
  discrepancy: bigint;
  discrepancyPercent: number;
  healthy: boolean;
  details: UserDiscrepancy[];
}

/**
 * Configuration for the reconciliation service
 */
export interface ReconciliationConfig {
  /** RPC URL for blockchain connection */
  rpcUrl: string;
  /** SettlementVault contract address */
  vaultAddress: string;
  /** Ledger instance for off-chain balance tracking */
  ledger: Ledger;
  /** Token ID for collateral (USDC) - default 0n */
  collateralTokenId?: bigint;
  /** Discrepancy threshold percentage (default 0.01% = 0.0001) */
  discrepancyThreshold?: number;
  /** Interval between reconciliation runs in ms (default 60000 = 1 minute) */
  reconciliationIntervalMs?: number;
  /** Callback when alert is triggered */
  onAlert?: (result: ReconciliationResult) => void;
  /** Callback when system should be paused */
  onCriticalDiscrepancy?: (result: ReconciliationResult) => void;
}

// ============ Constants ============

/** Default discrepancy threshold: 0.01% */
const DEFAULT_DISCREPANCY_THRESHOLD = 0.0001;

/** Default reconciliation interval: 60 seconds */
const DEFAULT_RECONCILIATION_INTERVAL_MS = 60000;

/** Critical discrepancy multiplier (10x threshold triggers pause) */
const CRITICAL_MULTIPLIER = 10;

/** Maximum history entries to keep */
const MAX_HISTORY_ENTRIES = 1000;

// ============ ABI ============

const SETTLEMENT_VAULT_ABI = [
  "function balanceOf(address user) view returns (uint256)",
  "function totalDeposits() view returns (uint256)",
];

// ============ Reconciliation Service ============

/**
 * ReconciliationService provides continuous balance verification between
 * the off-chain ledger and on-chain SettlementVault.
 * 
 * Key features:
 * - Periodic comparison of Ledger vs SettlementVault (Requirement 8.1)
 * - Discrepancy threshold alerting at 0.01% (Requirement 8.2)
 * - System pause on critical discrepancy (Requirement 8.3)
 * - Logging for audit purposes (Requirement 8.4)
 * - Historical discrepancy tracking (Requirement 8.5)
 */
export class ReconciliationService {
  private provider: ethers.Provider;
  private vault: ethers.Contract;
  private ledger: Ledger;
  private collateralTokenId: bigint;
  private discrepancyThreshold: number;
  private reconciliationIntervalMs: number;
  
  // Callbacks
  private onAlert?: (result: ReconciliationResult) => void;
  private onCriticalDiscrepancy?: (result: ReconciliationResult) => void;
  
  // State
  private running: boolean = false;
  private paused: boolean = false;
  private reconciliationInterval: ReturnType<typeof setInterval> | null = null;
  
  // History tracking (Requirement 8.5)
  private history: ReconciliationResult[] = [];
  
  constructor(config: ReconciliationConfig) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.vault = new ethers.Contract(
      config.vaultAddress,
      SETTLEMENT_VAULT_ABI,
      this.provider
    );
    this.ledger = config.ledger;
    this.collateralTokenId = config.collateralTokenId ?? 0n;
    this.discrepancyThreshold = config.discrepancyThreshold ?? DEFAULT_DISCREPANCY_THRESHOLD;
    this.reconciliationIntervalMs = config.reconciliationIntervalMs ?? DEFAULT_RECONCILIATION_INTERVAL_MS;
    this.onAlert = config.onAlert;
    this.onCriticalDiscrepancy = config.onCriticalDiscrepancy;
  }

  // ============ Lifecycle ============

  /**
   * Start periodic reconciliation
   * Requirement 8.1: Periodically compare Off_Chain_Ledger totals with SettlementVault balances
   */
  start(): void {
    if (this.running) return;
    
    this.running = true;
    this.reconciliationInterval = setInterval(
      () => this.runReconciliation(),
      this.reconciliationIntervalMs
    );
    
    // Run immediately on start
    this.runReconciliation();
  }

  /**
   * Stop periodic reconciliation
   */
  stop(): void {
    this.running = false;
    if (this.reconciliationInterval) {
      clearInterval(this.reconciliationInterval);
      this.reconciliationInterval = null;
    }
  }

  /**
   * Check if service is running
   */
  isRunning(): boolean {
    return this.running;
  }

  // ============ Core Reconciliation ============

  /**
   * Run a single reconciliation check
   * Requirement 8.1: Compare Off_Chain_Ledger totals with SettlementVault balances
   * Requirement 8.4: Log comparison results for audit purposes
   */
  async reconcile(): Promise<ReconciliationResult> {
    const timestamp = Date.now();
    const details: UserDiscrepancy[] = [];
    
    try {
      // Get all users with balances from ledger
      const usersWithBalances = this.ledger.getUsersWithBalance(this.collateralTokenId);
      
      // Get off-chain total
      const offChainTotal = this.ledger.getTotalBalance(this.collateralTokenId);
      
      // Get on-chain total from vault
      let onChainTotal: bigint;
      try {
        onChainTotal = await this.vault.totalDeposits();
      } catch {
        // Fallback: sum individual balances if totalDeposits not available
        onChainTotal = 0n;
        for (const [user] of usersWithBalances) {
          try {
            const balance = await this.vault.balanceOf(user);
            onChainTotal += BigInt(balance);
          } catch {
            // Skip users we can't query
          }
        }
      }
      
      // Check individual user balances for detailed discrepancy info
      for (const [user, offChainBalance] of usersWithBalances) {
        try {
          const onChainBalance = BigInt(await this.vault.balanceOf(user));
          const offChainTotalBalance = offChainBalance.available + offChainBalance.locked;
          const difference = offChainTotalBalance - onChainBalance;
          
          if (difference !== 0n) {
            details.push({
              user,
              onChain: onChainBalance,
              offChain: offChainTotalBalance,
              difference,
            });
          }
        } catch {
          // Skip users we can't query
        }
      }
      
      // Calculate discrepancy
      const discrepancy = offChainTotal - onChainTotal;
      const absDiscrepancy = discrepancy < 0n ? -discrepancy : discrepancy;
      
      // Calculate percentage (avoid division by zero)
      let discrepancyPercent = 0;
      if (onChainTotal > 0n) {
        // Convert to number for percentage calculation
        // Use high precision by multiplying first
        discrepancyPercent = Number((absDiscrepancy * 1000000n) / onChainTotal) / 1000000;
      } else if (offChainTotal > 0n) {
        // If on-chain is 0 but off-chain has balance, that's 100% discrepancy
        discrepancyPercent = 1;
      }
      
      // Determine health status
      const healthy = discrepancyPercent <= this.discrepancyThreshold;
      
      const result: ReconciliationResult = {
        timestamp,
        onChainTotal,
        offChainTotal,
        discrepancy,
        discrepancyPercent,
        healthy,
        details,
      };
      
      // Store in history (Requirement 8.5)
      this.addToHistory(result);
      
      // Requirement 8.4: Log comparison results for audit purposes
      this.logResult(result);
      
      return result;
    } catch (error) {
      // Return error result
      const result: ReconciliationResult = {
        timestamp,
        onChainTotal: 0n,
        offChainTotal: 0n,
        discrepancy: 0n,
        discrepancyPercent: 0,
        healthy: false,
        details: [],
      };
      
      this.addToHistory(result);
      console.error("Reconciliation error:", error);
      
      return result;
    }
  }

  /**
   * Internal method to run reconciliation and handle alerts
   */
  private async runReconciliation(): Promise<void> {
    const result = await this.reconcile();
    
    // Check for alerts (Requirement 8.2)
    if (!result.healthy && result.discrepancyPercent > this.discrepancyThreshold) {
      this.triggerAlert(result);
    }
    
    // Check for critical discrepancy (Requirement 8.3)
    const criticalThreshold = this.discrepancyThreshold * CRITICAL_MULTIPLIER;
    if (result.discrepancyPercent > criticalThreshold) {
      this.triggerCriticalDiscrepancy(result);
    }
  }

  // ============ Alert Handling ============

  /**
   * Trigger alert for discrepancy above threshold
   * Requirement 8.2: Trigger alert if discrepancy exceeds threshold (0.01%)
   */
  private triggerAlert(result: ReconciliationResult): void {
    console.warn(
      `[RECONCILIATION ALERT] Discrepancy detected: ${(result.discrepancyPercent * 100).toFixed(4)}% ` +
      `(threshold: ${(this.discrepancyThreshold * 100).toFixed(4)}%)`
    );
    
    if (this.onAlert) {
      this.onAlert(result);
    }
  }

  /**
   * Trigger critical discrepancy and pause system
   * Requirement 8.3: Pause new order acceptance on critical discrepancy
   */
  private triggerCriticalDiscrepancy(result: ReconciliationResult): void {
    console.error(
      `[CRITICAL DISCREPANCY] System pause triggered: ${(result.discrepancyPercent * 100).toFixed(4)}%`
    );
    
    this.paused = true;
    
    if (this.onCriticalDiscrepancy) {
      this.onCriticalDiscrepancy(result);
    }
  }

  /**
   * Log reconciliation result for audit
   * Requirement 8.4: Log comparison results for audit purposes
   */
  private logResult(result: ReconciliationResult): void {
    const status = result.healthy ? "HEALTHY" : "DISCREPANCY";
    console.log(
      `[RECONCILIATION] ${status} - ` +
      `On-chain: ${result.onChainTotal}, Off-chain: ${result.offChainTotal}, ` +
      `Discrepancy: ${result.discrepancy} (${(result.discrepancyPercent * 100).toFixed(4)}%)`
    );
  }

  // ============ History Management ============

  /**
   * Add result to history
   * Requirement 8.5: Track historical discrepancies for trend analysis
   */
  private addToHistory(result: ReconciliationResult): void {
    this.history.push(result);
    
    // Trim history if too large
    if (this.history.length > MAX_HISTORY_ENTRIES) {
      this.history = this.history.slice(-MAX_HISTORY_ENTRIES);
    }
  }

  /**
   * Get historical reconciliation results
   * Requirement 8.5: Track historical discrepancies for trend analysis
   */
  getHistory(limit?: number): ReconciliationResult[] {
    if (limit === undefined || limit >= this.history.length) {
      return [...this.history];
    }
    return this.history.slice(-limit);
  }

  /**
   * Get only discrepancy results from history
   */
  getDiscrepancyHistory(limit?: number): ReconciliationResult[] {
    const discrepancies = this.history.filter(r => !r.healthy);
    if (limit === undefined || limit >= discrepancies.length) {
      return [...discrepancies];
    }
    return discrepancies.slice(-limit);
  }

  // ============ Health Checks ============

  /**
   * Check if system is healthy (no critical discrepancies)
   * Requirement 8.3: System pause on critical discrepancy
   */
  isHealthy(): boolean {
    if (this.paused) return false;
    
    // Check last reconciliation result
    const lastResult = this.history[this.history.length - 1];
    if (!lastResult) return true; // No results yet, assume healthy
    
    return lastResult.healthy;
  }

  /**
   * Check if system is paused due to critical discrepancy
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Resume system after manual resolution
   */
  resume(): void {
    this.paused = false;
    console.log("[RECONCILIATION] System resumed after manual resolution");
  }

  // ============ Configuration ============

  /**
   * Get current discrepancy threshold
   */
  getDiscrepancyThreshold(): number {
    return this.discrepancyThreshold;
  }

  /**
   * Set discrepancy threshold
   */
  setDiscrepancyThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error("Threshold must be between 0 and 1");
    }
    this.discrepancyThreshold = threshold;
  }

  /**
   * Get reconciliation interval in milliseconds
   */
  getReconciliationInterval(): number {
    return this.reconciliationIntervalMs;
  }

  /**
   * Set reconciliation interval
   */
  setReconciliationInterval(intervalMs: number): void {
    if (intervalMs < 1000) {
      throw new Error("Interval must be at least 1000ms");
    }
    this.reconciliationIntervalMs = intervalMs;
    
    // Restart if running
    if (this.running) {
      this.stop();
      this.start();
    }
  }

  // ============ Statistics ============

  /**
   * Get summary statistics
   */
  getStats(): {
    totalChecks: number;
    healthyChecks: number;
    discrepancyChecks: number;
    lastRun: number | null;
    averageDiscrepancyPercent: number;
    maxDiscrepancyPercent: number;
  } {
    const totalChecks = this.history.length;
    const healthyChecks = this.history.filter(r => r.healthy).length;
    const discrepancyChecks = totalChecks - healthyChecks;
    const lastRun = this.history.length > 0 
      ? this.history[this.history.length - 1].timestamp 
      : null;
    
    // Calculate average and max discrepancy
    let totalDiscrepancyPercent = 0;
    let maxDiscrepancyPercent = 0;
    
    for (const result of this.history) {
      totalDiscrepancyPercent += result.discrepancyPercent;
      if (result.discrepancyPercent > maxDiscrepancyPercent) {
        maxDiscrepancyPercent = result.discrepancyPercent;
      }
    }
    
    const averageDiscrepancyPercent = totalChecks > 0 
      ? totalDiscrepancyPercent / totalChecks 
      : 0;
    
    return {
      totalChecks,
      healthyChecks,
      discrepancyChecks,
      lastRun,
      averageDiscrepancyPercent,
      maxDiscrepancyPercent,
    };
  }

  // ============ Testing Utilities ============

  /**
   * Clear history (for testing)
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Set ledger instance (for testing)
   */
  setLedger(ledger: Ledger): void {
    this.ledger = ledger;
  }

  /**
   * Check if discrepancy exceeds threshold
   * Useful for testing alert logic
   */
  checkDiscrepancyThreshold(
    onChainTotal: bigint,
    offChainTotal: bigint
  ): { exceedsThreshold: boolean; discrepancyPercent: number } {
    const discrepancy = offChainTotal - onChainTotal;
    const absDiscrepancy = discrepancy < 0n ? -discrepancy : discrepancy;
    
    let discrepancyPercent = 0;
    if (onChainTotal > 0n) {
      discrepancyPercent = Number((absDiscrepancy * 1000000n) / onChainTotal) / 1000000;
    } else if (offChainTotal > 0n) {
      discrepancyPercent = 1;
    }
    
    return {
      exceedsThreshold: discrepancyPercent > this.discrepancyThreshold,
      discrepancyPercent,
    };
  }
}
