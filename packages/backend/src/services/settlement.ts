import { ethers } from "ethers";
import type { Trade, SignedOrder } from "../types";
import { MatchType } from "../types";
import { MerkleTree } from "./merkleTree";

/**
 * Settlement batch status
 */
export type BatchStatus = "pending" | "committed" | "settled" | "failed";

/**
 * Settlement batch containing trades and Merkle proofs
 */
export interface SettlementBatch {
  epochId: number;
  trades: Trade[];
  balanceDeltas: Map<string, bigint>;
  merkleRoot: string;
  proofs: Map<string, { amount: bigint; proof: string[] }>;
  timestamp: number;
  status: BatchStatus;
}

/**
 * Withdrawal proof for a user to claim from an epoch
 */
export interface WithdrawalProof {
  epochId: number;
  amount: bigint;
  proof: string[];
}

/**
 * Result of settlement execution
 */
export interface SettlementResult {
  success: boolean;
  txHashes: string[];
  failedTrades: string[];
  error?: string;
}

/**
 * Order store interface for retrieving signed orders by hash
 */
export interface IOrderStore {
  getOrderByHash(orderHash: string): SignedOrder | null;
}

/**
 * Retry configuration for settlement operations
 */
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/**
 * Settlement Service with CTFExchange Integration
 * 
 * Handles batching trades, computing balance deltas, building Merkle trees,
 * and executing settlements on-chain via CTFExchange.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.5
 */
export class SettlementService {
  private provider: ethers.Provider;
  private signer: ethers.Signer;
  private vaultAddress: string;
  private exchangeAddress: string;

  private pendingTrades: Trade[] = [];
  private currentEpoch = 0;
  private settlementHistory: SettlementBatch[] = [];
  
  // Order store for retrieving signed orders
  private orderStore: IOrderStore | null = null;
  
  // Set of cancelled order hashes
  private cancelledOrders = new Set<string>();
  
  // Retry configuration
  private retryConfig: RetryConfig;

  // Vault ABI (minimal)
  private static VAULT_ABI = [
    "function commitEpoch(bytes32 merkleRoot, uint256 totalAmount) external",
    "function currentEpoch() view returns (uint256)",
  ];

  // Exchange ABI for matchOrders
  private static EXCHANGE_ABI = [
    "function matchOrders(tuple(uint256 salt, address maker, address signer, address taker, bytes32 marketId, uint256 tokenId, uint8 side, uint256 makerAmount, uint256 takerAmount, uint256 expiration, uint256 nonce, uint256 feeRateBps, uint8 sigType, bytes signature) takerOrder, tuple(uint256 salt, address maker, address signer, address taker, bytes32 marketId, uint256 tokenId, uint8 side, uint256 makerAmount, uint256 takerAmount, uint256 expiration, uint256 nonce, uint256 feeRateBps, uint8 sigType, bytes signature)[] makerOrders, uint256 takerFillAmount, uint256[] makerFillAmounts) external",
    "function fillOrder(tuple(uint256 salt, address maker, address signer, address taker, bytes32 marketId, uint256 tokenId, uint8 side, uint256 makerAmount, uint256 takerAmount, uint256 expiration, uint256 nonce, uint256 feeRateBps, uint8 sigType, bytes signature) order, uint256 fillAmount) external",
  ];

  constructor(
    rpcUrl: string,
    privateKey: string,
    vaultAddress: string,
    exchangeAddress: string,
    retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
  ) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.signer = new ethers.Wallet(privateKey, this.provider);
    this.vaultAddress = vaultAddress;
    this.exchangeAddress = exchangeAddress;
    this.retryConfig = retryConfig;
  }

  /**
   * Set the order store for retrieving signed orders
   */
  setOrderStore(orderStore: IOrderStore): void {
    this.orderStore = orderStore;
  }

  /**
   * Add trades to pending batch
   * Requirement 3.7: Queue trades for batch settlement
   */
  addTrades(trades: Trade[]): void {
    this.pendingTrades.push(...trades);
  }

  /**
   * Get count of pending trades
   */
  getPendingCount(): number {
    return this.pendingTrades.length;
  }

  /**
   * Mark an order as cancelled
   * Requirement 7.5: Cancelled orders should be excluded from batches
   */
  markOrderCancelled(orderHash: string): void {
    this.cancelledOrders.add(orderHash.toLowerCase());
  }

  /**
   * Check if an order is cancelled
   */
  isOrderCancelled(orderHash: string): boolean {
    return this.cancelledOrders.has(orderHash.toLowerCase());
  }

  /**
   * Filter out trades involving cancelled orders
   * Requirement 7.5: Exclude cancelled orders from settlement batches
   */
  private filterCancelledTrades(trades: Trade[]): Trade[] {
    return trades.filter((trade) => {
      const takerCancelled = this.isOrderCancelled(trade.takerOrderHash);
      const makerCancelled = this.isOrderCancelled(trade.makerOrderHash);
      return !takerCancelled && !makerCancelled;
    });
  }

  /**
   * Create settlement batch from pending trades
   * 
   * Requirement 4.1: Create batches at configurable intervals
   * Requirement 4.2: Compute net balance deltas per user
   * Requirement 4.3: Build Merkle tree from positive balance deltas
   * Requirement 7.5: Filter out cancelled orders before batch creation
   */
  async createBatch(): Promise<SettlementBatch | null> {
    if (this.pendingTrades.length === 0) return null;

    // Take up to 100 trades for this batch
    const rawTrades = this.pendingTrades.splice(0, 100);
    
    // Filter out trades involving cancelled orders
    // Requirement 7.5: Exclude cancelled orders from batches
    const trades = this.filterCancelledTrades(rawTrades);
    
    if (trades.length === 0) return null;

    // Compute balance deltas
    // Requirement 4.2: Compute net balance deltas per user
    const balanceDeltas = this.computeBalanceDeltas(trades);

    // Build Merkle tree from positive balances (amounts owed to users)
    // Requirement 4.3: Build Merkle tree from positive balance deltas
    const entries = Array.from(balanceDeltas.entries())
      .filter(([_, amount]) => amount > 0n)
      .map(([address, amount]) => ({ address, amount }));

    if (entries.length === 0) {
      return null;
    }

    const tree = new MerkleTree(entries);
    const merkleRoot = tree.getRoot();

    // Generate proofs for each user
    // Requirement 4.5: Store proofs for each user to claim
    const proofs = new Map<string, { amount: bigint; proof: string[] }>();
    for (const entry of entries) {
      const { proof } = tree.getProof(entry.address, entry.amount);
      proofs.set(entry.address.toLowerCase(), { amount: entry.amount, proof });
    }

    const batch: SettlementBatch = {
      epochId: ++this.currentEpoch,
      trades,
      balanceDeltas,
      merkleRoot,
      proofs,
      timestamp: Date.now(),
      status: "pending",
    };

    this.settlementHistory.push(batch);
    return batch;
  }

  /**
   * Commit batch to on-chain vault
   * 
   * Requirement 4.4: Call commitEpoch on SettlementVault with Merkle root
   * Requirement 4.6: Retry with exponential backoff on failure
   */
  async commitBatch(batch: SettlementBatch): Promise<string> {
    const vault = new ethers.Contract(
      this.vaultAddress,
      SettlementService.VAULT_ABI,
      this.signer
    );

    const totalAmount = Array.from(batch.balanceDeltas.values())
      .filter((v) => v > 0n)
      .reduce((a, b) => a + b, 0n);

    // Execute with retry logic
    const txHash = await this.executeWithRetry(async () => {
      const tx = await vault.commitEpoch(batch.merkleRoot, totalAmount);
      const receipt = await tx.wait();
      return receipt.hash;
    });

    // Update batch status
    batch.status = "committed";
    
    return txHash;
  }

  /**
   * Execute settlement on CTFExchange
   * 
   * Requirement 5.1: Call matchOrders for COMPLEMENTARY trades
   * Requirement 5.2: Call matchOrders for MINT trades (triggers splitPosition)
   * Requirement 5.3: Call matchOrders for MERGE trades (triggers mergePositions)
   * Requirement 5.4: Provide original signed orders and fill amounts
   * Requirement 5.6: Update settlement status on success
   */
  async executeSettlement(batch: SettlementBatch): Promise<SettlementResult> {
    if (!this.orderStore) {
      return {
        success: false,
        txHashes: [],
        failedTrades: batch.trades.map((t) => t.id),
        error: "Order store not configured",
      };
    }

    const exchange = new ethers.Contract(
      this.exchangeAddress,
      SettlementService.EXCHANGE_ABI,
      this.signer
    );

    const txHashes: string[] = [];
    const failedTrades: string[] = [];

    // Group trades by match type for efficient settlement
    const tradesByType = this.groupTradesByMatchType(batch.trades);

    // Process each match type
    for (const [matchType, trades] of tradesByType) {
      for (const trade of trades) {
        try {
          const txHash = await this.settleTrade(exchange, trade, matchType);
          if (txHash) {
            txHashes.push(txHash);
          }
        } catch (error) {
          console.error(`Failed to settle trade ${trade.id}:`, error);
          failedTrades.push(trade.id);
        }
      }
    }

    // Update batch status
    // Requirement 5.6: Update settlement status on success
    if (failedTrades.length === 0) {
      batch.status = "settled";
    } else if (failedTrades.length === batch.trades.length) {
      batch.status = "failed";
    }

    return {
      success: failedTrades.length === 0,
      txHashes,
      failedTrades,
      error: failedTrades.length > 0 ? `${failedTrades.length} trades failed` : undefined,
    };
  }

  /**
   * Settle a single trade on CTFExchange
   * 
   * Requirement 5.1: COMPLEMENTARY trades use matchOrders
   * Requirement 5.2: MINT trades trigger splitPosition via matchOrders
   * Requirement 5.3: MERGE trades trigger mergePositions via matchOrders
   */
  private async settleTrade(
    exchange: ethers.Contract,
    trade: Trade,
    matchType: MatchType
  ): Promise<string | null> {
    // Get the signed orders from the order store
    const takerOrder = this.orderStore!.getOrderByHash(trade.takerOrderHash);
    const makerOrder = this.orderStore!.getOrderByHash(trade.makerOrderHash);

    if (!takerOrder || !makerOrder) {
      throw new Error(`Orders not found for trade ${trade.id}`);
    }

    // Convert orders to contract format
    const takerOrderStruct = this.orderToStruct(takerOrder);
    const makerOrderStruct = this.orderToStruct(makerOrder);

    // Execute with retry logic
    // Requirement 5.4: Provide original signed orders and fill amounts
    return await this.executeWithRetry(async () => {
      const tx = await exchange.matchOrders(
        takerOrderStruct,
        [makerOrderStruct],
        trade.amount,
        [trade.amount]
      );
      const receipt = await tx.wait();
      return receipt.hash;
    });
  }

  /**
   * Convert SignedOrder to contract struct format
   */
  private orderToStruct(order: SignedOrder): object {
    return {
      salt: order.salt,
      maker: order.maker,
      signer: order.signer,
      taker: order.taker,
      marketId: order.marketId,
      tokenId: order.tokenId,
      side: order.side,
      makerAmount: order.makerAmount,
      takerAmount: order.takerAmount,
      expiration: order.expiration,
      nonce: order.nonce,
      feeRateBps: order.feeRateBps,
      sigType: order.sigType,
      signature: order.signature,
    };
  }

  /**
   * Group trades by match type for efficient settlement
   */
  private groupTradesByMatchType(trades: Trade[]): Map<MatchType, Trade[]> {
    const grouped = new Map<MatchType, Trade[]>();
    
    for (const trade of trades) {
      const existing = grouped.get(trade.matchType) || [];
      existing.push(trade);
      grouped.set(trade.matchType, existing);
    }
    
    return grouped;
  }

  /**
   * Execute an async operation with exponential backoff retry
   * 
   * Requirement 4.6, 5.5: Retry with exponential backoff on failure
   */
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.retryConfig.maxRetries) {
          // Calculate delay with exponential backoff
          const delay = Math.min(
            this.retryConfig.baseDelayMs * Math.pow(2, attempt),
            this.retryConfig.maxDelayMs
          );
          
          console.warn(
            `Settlement attempt ${attempt + 1} failed, retrying in ${delay}ms:`,
            error
          );
          
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Compute net balance changes from trades
   * 
   * Requirement 4.2: Compute net balance deltas per user from all trades
   * 
   * For each trade:
   * - Buyer pays collateral (price * amount), receives tokens
   * - Seller receives collateral, pays tokens
   */
  computeBalanceDeltas(trades: Trade[]): Map<string, bigint> {
    const deltas = new Map<string, bigint>();

    for (const trade of trades) {
      // Calculate collateral cost: price * amount / ONE
      const cost = (trade.price * trade.amount) / 10n ** 18n;

      // Maker (buyer in standard case): pays collateral
      const makerKey = trade.maker.toLowerCase();
      const makerDelta = deltas.get(makerKey) || 0n;
      deltas.set(makerKey, makerDelta - cost);

      // Taker (seller in standard case): receives collateral
      const takerKey = trade.taker.toLowerCase();
      const takerDelta = deltas.get(takerKey) || 0n;
      deltas.set(takerKey, takerDelta + cost);
    }

    return deltas;
  }

  /**
   * Get proof for user to claim from epoch
   * 
   * Requirement 6.2: Return Merkle proof for user's balance in epoch
   */
  getProof(epochId: number, user: string): WithdrawalProof | null {
    const batch = this.settlementHistory.find((b) => b.epochId === epochId);
    if (!batch) return null;

    const proofData = batch.proofs.get(user.toLowerCase());
    if (!proofData) return null;

    return {
      epochId,
      amount: proofData.amount,
      proof: proofData.proof,
    };
  }

  /**
   * Get all unclaimed epochs for user
   * 
   * Requirement 6.1: Check user's claimable balance across all epochs
   */
  getUnclaimedEpochs(user: string): number[] {
    return this.settlementHistory
      .filter((b) => b.proofs.has(user.toLowerCase()))
      .map((b) => b.epochId);
  }

  /**
   * Get settlement batch by epoch ID
   */
  getBatch(epochId: number): SettlementBatch | null {
    return this.settlementHistory.find((b) => b.epochId === epochId) || null;
  }

  /**
   * Get all settlement batches
   */
  getAllBatches(): SettlementBatch[] {
    return [...this.settlementHistory];
  }

  /**
   * Get current epoch number
   */
  getCurrentEpoch(): number {
    return this.currentEpoch;
  }

  /**
   * Clear cancelled orders set (for testing)
   */
  clearCancelledOrders(): void {
    this.cancelledOrders.clear();
  }
}
