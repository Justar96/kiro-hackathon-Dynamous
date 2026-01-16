/**
 * Blockchain Indexer Service
 * 
 * Monitors blockchain events from SettlementVault and CTFExchange contracts.
 * Handles deposit event monitoring, confirmation tracking, chain reorg detection,
 * and nonce synchronization.
 * 
 * Requirements: 1.2, 1.4, 6.6, 7.4, 11.1, 11.4
 */

import { ethers } from "ethers";
import type { Ledger } from "./ledger";

// ============ Types ============

export interface DepositEvent {
  user: string;
  amount: bigint;
  blockNumber: number;
  txHash: string;
  confirmations: number;
  indexed: boolean;
}

export interface WithdrawalEvent {
  user: string;
  epochId: number;
  amount: bigint;
  blockNumber: number;
  txHash: string;
}

export interface OrderCancelledEvent {
  orderHash: string;
  blockNumber: number;
  txHash: string;
}

export interface NonceIncrementedEvent {
  user: string;
  newNonce: bigint;
  blockNumber: number;
  txHash: string;
}

export interface EpochCommittedEvent {
  epochId: number;
  merkleRoot: string;
  totalAmount: bigint;
  blockNumber: number;
  txHash: string;
}

export type IndexerEvent = 
  | "deposit"
  | "withdrawal"
  | "orderCancelled"
  | "nonceIncremented"
  | "epochCommitted"
  | "reorg";

export interface DepositStatus {
  txHash: string;
  user: string;
  amount: bigint;
  blockNumber: number;
  confirmations: number;
  indexed: boolean;
}

export interface IndexerConfig {
  rpcUrl: string;
  settlementVaultAddress: string;
  ctfExchangeAddress: string;
  requiredConfirmations?: number;
  pollIntervalMs?: number;
  ledger?: Ledger;
  collateralTokenId?: bigint;
}

type EventHandler<T = unknown> = (event: T) => void;

// ============ ABIs ============

const SETTLEMENT_VAULT_ABI = [
  "event Deposit(address indexed user, uint256 amount)",
  "event Claimed(address indexed user, uint256 indexed epochId, uint256 amount)",
  "event EpochCommitted(uint256 indexed epochId, bytes32 merkleRoot, uint256 totalAmount)",
];

const CTF_EXCHANGE_ABI = [
  "event OrderCancelled(bytes32 indexed orderHash)",
  "function nonces(address user) view returns (uint256)",
];

// ============ Indexer Service ============

/**
 * BlockchainIndexer monitors blockchain events and syncs state to the off-chain ledger.
 * 
 * Key features:
 * - Deposit event monitoring with 20-block confirmation requirement
 * - Chain reorg detection and handling
 * - Nonce synchronization from CTFExchange
 * - Order cancellation tracking
 */
export class BlockchainIndexer {
  private provider: ethers.Provider;
  private settlementVaultAddress: string;
  private ctfExchangeAddress: string;
  private requiredConfirmations: number;
  private pollIntervalMs: number;
  private ledger?: Ledger;
  private collateralTokenId: bigint;

  // State tracking
  private lastProcessedBlock: number = 0;
  private lastBlockHash: string = "";
  private running: boolean = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  // Pending deposits awaiting confirmations
  private pendingDeposits: Map<string, DepositEvent> = new Map();

  // Event handlers
  private eventHandlers: Map<IndexerEvent, EventHandler[]> = new Map();

  // Contract instances
  private settlementVault: ethers.Contract | null = null;
  private ctfExchange: ethers.Contract | null = null;

  constructor(config: IndexerConfig) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.settlementVaultAddress = config.settlementVaultAddress;
    this.ctfExchangeAddress = config.ctfExchangeAddress;
    this.requiredConfirmations = config.requiredConfirmations ?? 20;
    this.pollIntervalMs = config.pollIntervalMs ?? 2000;
    this.ledger = config.ledger;
    this.collateralTokenId = config.collateralTokenId ?? 0n;

    // Initialize contracts
    this.settlementVault = new ethers.Contract(
      this.settlementVaultAddress,
      SETTLEMENT_VAULT_ABI,
      this.provider
    );
    this.ctfExchange = new ethers.Contract(
      this.ctfExchangeAddress,
      CTF_EXCHANGE_ABI,
      this.provider
    );
  }

  // ============ Lifecycle ============

  /**
   * Start indexing from a specific block
   * Requirement 1.2: Monitor deposit events
   */
  async start(fromBlock?: number): Promise<void> {
    if (this.running) return;

    if (fromBlock !== undefined) {
      this.lastProcessedBlock = fromBlock;
    } else {
      this.lastProcessedBlock = await this.provider.getBlockNumber();
    }

    // Get initial block hash for reorg detection
    const block = await this.provider.getBlock(this.lastProcessedBlock);
    this.lastBlockHash = block?.hash ?? "";

    this.running = true;
    this.pollInterval = setInterval(() => this.poll(), this.pollIntervalMs);
  }

  /**
   * Stop indexing
   */
  stop(): void {
    this.running = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Check if indexer is running
   */
  isRunning(): boolean {
    return this.running;
  }

  // ============ Event Subscription ============

  /**
   * Subscribe to indexer events
   */
  on<T = unknown>(event: IndexerEvent, handler: EventHandler<T>): void {
    const handlers = this.eventHandlers.get(event) ?? [];
    handlers.push(handler as EventHandler);
    this.eventHandlers.set(event, handlers);
  }

  /**
   * Unsubscribe from indexer events
   */
  off<T = unknown>(event: IndexerEvent, handler: EventHandler<T>): void {
    const handlers = this.eventHandlers.get(event) ?? [];
    const index = handlers.indexOf(handler as EventHandler);
    if (index !== -1) {
      handlers.splice(index, 1);
      this.eventHandlers.set(event, handlers);
    }
  }

  private emit<T>(event: IndexerEvent, data: T): void {
    const handlers = this.eventHandlers.get(event) ?? [];
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in ${event} handler:`, error);
      }
    }
  }

  // ============ Polling ============

  private async poll(): Promise<void> {
    if (!this.running) return;

    try {
      const currentBlock = await this.provider.getBlockNumber();
      
      // Check for chain reorg
      await this.checkForReorg();

      // Process new blocks (with confirmation buffer for deposits)
      const safeBlock = currentBlock - this.requiredConfirmations;
      
      if (safeBlock > this.lastProcessedBlock) {
        await this.processBlocks(this.lastProcessedBlock + 1, safeBlock);
        this.lastProcessedBlock = safeBlock;
        
        // Update block hash for reorg detection
        const block = await this.provider.getBlock(safeBlock);
        this.lastBlockHash = block?.hash ?? "";
      }

      // Process pending deposits that now have enough confirmations
      await this.processPendingDeposits(currentBlock);

      // Also scan recent blocks for new deposits (before confirmation threshold)
      if (currentBlock > safeBlock) {
        await this.scanForNewDeposits(safeBlock + 1, currentBlock);
      }
    } catch (error) {
      console.error("Indexer poll error:", error);
    }
  }

  // ============ Block Processing ============

  /**
   * Process blocks for confirmed events
   */
  private async processBlocks(fromBlock: number, toBlock: number): Promise<void> {
    if (!this.settlementVault || !this.ctfExchange) return;

    // Process SettlementVault events
    await this.processSettlementVaultEvents(fromBlock, toBlock);

    // Process CTFExchange events
    await this.processCTFExchangeEvents(fromBlock, toBlock);
  }

  /**
   * Process SettlementVault events (Deposit, Claimed, EpochCommitted)
   */
  private async processSettlementVaultEvents(fromBlock: number, toBlock: number): Promise<void> {
    if (!this.settlementVault) return;

    // Process confirmed deposits
    const depositFilter = this.settlementVault.filters.Deposit();
    const depositLogs = await this.settlementVault.queryFilter(depositFilter, fromBlock, toBlock);

    for (const log of depositLogs) {
      const parsed = this.settlementVault.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      
      if (parsed) {
        const depositEvent: DepositEvent = {
          user: parsed.args[0],
          amount: parsed.args[1],
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          confirmations: this.requiredConfirmations,
          indexed: true,
        };

        // Credit to ledger
        // Requirement 1.2: Credit user's Off_Chain_Ledger balance after sufficient confirmations
        if (this.ledger) {
          this.ledger.credit(depositEvent.user, this.collateralTokenId, depositEvent.amount);
        }

        // Remove from pending if it was there
        this.pendingDeposits.delete(log.transactionHash);

        this.emit("deposit", depositEvent);
      }
    }

    // Process withdrawals (Claimed events)
    const claimedFilter = this.settlementVault.filters.Claimed();
    const claimedLogs = await this.settlementVault.queryFilter(claimedFilter, fromBlock, toBlock);

    for (const log of claimedLogs) {
      const parsed = this.settlementVault.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });

      if (parsed) {
        const withdrawalEvent: WithdrawalEvent = {
          user: parsed.args[0],
          epochId: Number(parsed.args[1]),
          amount: parsed.args[2],
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
        };

        // Requirement 6.6: Update Off_Chain_Ledger to reflect withdrawal
        if (this.ledger) {
          try {
            this.ledger.debit(withdrawalEvent.user, this.collateralTokenId, withdrawalEvent.amount);
          } catch {
            // User may not have balance in ledger if they deposited directly to vault
            console.warn(`Could not debit withdrawal for ${withdrawalEvent.user}`);
          }
        }

        this.emit("withdrawal", withdrawalEvent);
      }
    }

    // Process epoch commits
    const epochFilter = this.settlementVault.filters.EpochCommitted();
    const epochLogs = await this.settlementVault.queryFilter(epochFilter, fromBlock, toBlock);

    for (const log of epochLogs) {
      const parsed = this.settlementVault.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });

      if (parsed) {
        const epochEvent: EpochCommittedEvent = {
          epochId: Number(parsed.args[0]),
          merkleRoot: parsed.args[1],
          totalAmount: parsed.args[2],
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
        };

        this.emit("epochCommitted", epochEvent);
      }
    }
  }

  /**
   * Process CTFExchange events (OrderCancelled)
   * Requirement 7.4: Sync on-chain cancellation to Off_Chain_Ledger
   * Requirement 11.1: Monitor nonce increment events
   */
  private async processCTFExchangeEvents(fromBlock: number, toBlock: number): Promise<void> {
    if (!this.ctfExchange) return;

    // Process order cancellations
    const cancelFilter = this.ctfExchange.filters.OrderCancelled();
    const cancelLogs = await this.ctfExchange.queryFilter(cancelFilter, fromBlock, toBlock);

    for (const log of cancelLogs) {
      const parsed = this.ctfExchange.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });

      if (parsed) {
        const cancelEvent: OrderCancelledEvent = {
          orderHash: parsed.args[0],
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
        };

        this.emit("orderCancelled", cancelEvent);
      }
    }

    // Note: CTFExchange.incrementNonce() doesn't emit an event currently.
    // Nonce synchronization is handled via:
    // 1. syncNonce() called during order validation
    // 2. syncNoncesForUsers() for batch synchronization
    // Task 11.3 will add cancelAllOrders with AllOrdersCancelled event
  }

  // ============ Batch Nonce Synchronization ============

  /**
   * Sync nonces for multiple users
   * Requirement 11.1: Sync on-chain nonce to Ledger
   * Requirement 11.4: Use higher (on-chain) nonce as authoritative
   */
  async syncNoncesForUsers(users: string[]): Promise<Map<string, bigint>> {
    const results = new Map<string, bigint>();

    for (const user of users) {
      try {
        const nonce = await this.syncNonce(user);
        results.set(user.toLowerCase(), nonce);
      } catch (error) {
        console.error(`Failed to sync nonce for ${user}:`, error);
      }
    }

    return results;
  }

  /**
   * Check if user's nonce is stale (off-chain < on-chain)
   * Requirement 11.4: Detect nonce out of sync
   */
  async isNonceStale(user: string): Promise<boolean> {
    if (!this.ledger) return false;

    const offChainNonce = this.ledger.getNonce(user);
    const onChainNonce = await this.getOnChainNonce(user);

    return offChainNonce < onChainNonce;
  }

  /**
   * Get both off-chain and on-chain nonce for a user
   * Requirement 11.3: Return both nonce values
   */
  async getNonceStatus(user: string): Promise<{ offChain: bigint; onChain: bigint; inSync: boolean }> {
    const onChainNonce = await this.getOnChainNonce(user);
    const offChainNonce = this.ledger?.getNonce(user) ?? 0n;

    return {
      offChain: offChainNonce,
      onChain: onChainNonce,
      inSync: offChainNonce >= onChainNonce,
    };
  }

  // ============ Deposit Tracking ============

  /**
   * Scan for new deposits that haven't reached confirmation threshold yet
   */
  private async scanForNewDeposits(fromBlock: number, toBlock: number): Promise<void> {
    if (!this.settlementVault) return;

    const depositFilter = this.settlementVault.filters.Deposit();
    const depositLogs = await this.settlementVault.queryFilter(depositFilter, fromBlock, toBlock);

    const currentBlock = await this.provider.getBlockNumber();

    for (const log of depositLogs) {
      // Skip if already tracked
      if (this.pendingDeposits.has(log.transactionHash)) continue;

      const parsed = this.settlementVault.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });

      if (parsed) {
        const confirmations = currentBlock - log.blockNumber;
        
        const depositEvent: DepositEvent = {
          user: parsed.args[0],
          amount: parsed.args[1],
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          confirmations,
          indexed: false,
        };

        this.pendingDeposits.set(log.transactionHash, depositEvent);
      }
    }
  }

  /**
   * Process pending deposits that now have enough confirmations
   * Requirement 1.2: Wait for 20 block confirmations before crediting
   */
  private async processPendingDeposits(currentBlock: number): Promise<void> {
    for (const [txHash, deposit] of this.pendingDeposits) {
      const confirmations = currentBlock - deposit.blockNumber;
      deposit.confirmations = confirmations;

      if (confirmations >= this.requiredConfirmations && !deposit.indexed) {
        // Credit to ledger
        if (this.ledger) {
          this.ledger.credit(deposit.user, this.collateralTokenId, deposit.amount);
        }

        deposit.indexed = true;
        this.emit("deposit", deposit);
        
        // Remove from pending
        this.pendingDeposits.delete(txHash);
      }
    }
  }

  // ============ Chain Reorg Detection ============

  /**
   * Detect and handle chain reorganizations
   * Requirement 1.4: Revert Off_Chain_Ledger credit on reorg
   */
  private async checkForReorg(): Promise<void> {
    if (!this.lastBlockHash || this.lastProcessedBlock === 0) return;

    try {
      const block = await this.provider.getBlock(this.lastProcessedBlock);
      
      if (!block) {
        // Block no longer exists - reorg detected
        await this.handleReorg();
        return;
      }

      if (block.hash !== this.lastBlockHash) {
        // Block hash changed - reorg detected
        await this.handleReorg();
      }
    } catch (error) {
      console.error("Error checking for reorg:", error);
    }
  }

  /**
   * Handle chain reorganization
   * Requirement 1.4: Re-process from new chain state
   */
  private async handleReorg(): Promise<void> {
    console.warn("Chain reorganization detected!");

    // Find the common ancestor block
    let checkBlock = this.lastProcessedBlock;
    let foundCommonAncestor = false;

    while (checkBlock > 0 && !foundCommonAncestor) {
      checkBlock--;
      const block = await this.provider.getBlock(checkBlock);
      if (block) {
        foundCommonAncestor = true;
        this.lastProcessedBlock = checkBlock;
        this.lastBlockHash = block.hash ?? "";
      }
    }

    // Clear pending deposits that may have been affected
    const affectedDeposits: DepositEvent[] = [];
    for (const [txHash, deposit] of this.pendingDeposits) {
      if (deposit.blockNumber > this.lastProcessedBlock) {
        affectedDeposits.push(deposit);
        this.pendingDeposits.delete(txHash);
      }
    }

    // Emit reorg event with affected data
    this.emit("reorg", {
      newBlock: this.lastProcessedBlock,
      affectedDeposits,
    });

    // Note: In a production system, you would need to:
    // 1. Track all indexed deposits with their block numbers
    // 2. Revert any credits that were made from blocks after the reorg point
    // 3. Re-index from the common ancestor
    // This is a simplified implementation that clears pending deposits
  }

  // ============ Nonce Synchronization ============

  /**
   * Sync on-chain nonce to ledger
   * Requirement 11.1, 11.4: Use higher (on-chain) nonce as authoritative
   */
  async syncNonce(user: string): Promise<bigint> {
    if (!this.ctfExchange) {
      throw new Error("CTFExchange contract not initialized");
    }

    const onChainNonce = await this.ctfExchange.nonces(user);
    const nonce = BigInt(onChainNonce);

    if (this.ledger) {
      // Requirement 11.4: Use higher nonce as authoritative
      this.ledger.setNonce(user, nonce);
    }

    return nonce;
  }

  /**
   * Get on-chain nonce for a user
   */
  async getOnChainNonce(user: string): Promise<bigint> {
    if (!this.ctfExchange) {
      throw new Error("CTFExchange contract not initialized");
    }

    const nonce = await this.ctfExchange.nonces(user);
    return BigInt(nonce);
  }

  // ============ Query Methods ============

  /**
   * Get current indexed block
   */
  getCurrentBlock(): number {
    return this.lastProcessedBlock;
  }

  /**
   * Get deposit status by transaction hash
   * Requirement 1.5: Return on-chain deposit amount and off-chain credited amount
   */
  getDepositStatus(txHash: string): DepositStatus | null {
    const pending = this.pendingDeposits.get(txHash);
    if (pending) {
      return {
        txHash: pending.txHash,
        user: pending.user,
        amount: pending.amount,
        blockNumber: pending.blockNumber,
        confirmations: pending.confirmations,
        indexed: pending.indexed,
      };
    }
    return null;
  }

  /**
   * Get all pending deposits
   */
  getPendingDeposits(): DepositStatus[] {
    return Array.from(this.pendingDeposits.values()).map((d) => ({
      txHash: d.txHash,
      user: d.user,
      amount: d.amount,
      blockNumber: d.blockNumber,
      confirmations: d.confirmations,
      indexed: d.indexed,
    }));
  }

  /**
   * Get pending deposits for a specific user
   */
  getUserPendingDeposits(user: string): DepositStatus[] {
    const normalizedUser = user.toLowerCase();
    return this.getPendingDeposits().filter(
      (d) => d.user.toLowerCase() === normalizedUser
    );
  }

  /**
   * Get required confirmations
   */
  getRequiredConfirmations(): number {
    return this.requiredConfirmations;
  }

  /**
   * Set the ledger instance (for late binding)
   */
  setLedger(ledger: Ledger): void {
    this.ledger = ledger;
  }

  /**
   * Clear all state (for testing)
   */
  clear(): void {
    this.pendingDeposits.clear();
    this.lastProcessedBlock = 0;
    this.lastBlockHash = "";
  }
}
