import type { SignedOrder, OrderBookEntry, Trade, UserBalance } from "../types";
import { Side, MatchType } from "../types";
import { Ledger, LedgerError, LedgerErrorCode } from "./ledger";

const ONE = 10n ** 18n;
const BPS_DIVISOR = 10000n;

/**
 * Matching Engine for the hybrid CLOB trading system.
 * 
 * Handles order matching using price-time priority and integrates with
 * the Ledger service for balance management.
 * 
 * Requirements: 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
export class MatchingEngine {
  // marketKey (marketId-tokenId) -> sorted order arrays
  private bids = new Map<string, OrderBookEntry[]>();
  private asks = new Map<string, OrderBookEntry[]>();

  // Ledger service for balance management
  private ledger: Ledger;

  // Pending trades for batch settlement
  private pendingTrades: Trade[] = [];

  private tradeCounter = 0;

  /**
   * Create a new MatchingEngine instance.
   * 
   * @param ledger - Optional Ledger service instance. If not provided, creates an internal one.
   */
  constructor(ledger?: Ledger) {
    this.ledger = ledger ?? new Ledger();
  }

  // ============ Order Management ============

  /**
   * Add an order to the order book and attempt to match it.
   * 
   * Requirement 2.7: Lock required balance when order passes validation
   * Requirement 3.1: Match using price-time priority
   */
  addOrder(order: SignedOrder): { trades: Trade[]; orderId: string } {
    // Validate order
    const validation = this.validateOrder(order);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const marketKey = `${order.marketId}-${order.tokenId}`;
    const orderId = this.generateOrderId(order);
    const entry: OrderBookEntry = {
      id: orderId,
      order,
      remaining: order.makerAmount,
      timestamp: Date.now(),
    };

    // Lock balance using Ledger service
    // Requirement 2.7: Lock required balance
    this.lockBalance(order);

    // Try to match
    const trades =
      order.side === Side.BUY
        ? this.matchBuyOrder(entry, marketKey)
        : this.matchSellOrder(entry, marketKey);

    // Add remaining to book if not fully filled
    if (entry.remaining > 0n) {
      if (order.side === Side.BUY) {
        this.insertBid(marketKey, entry);
      } else {
        this.insertAsk(marketKey, entry);
      }
    }

    this.pendingTrades.push(...trades);
    return { trades, orderId };
  }

  /**
   * Cancel an order and unlock the maker's balance.
   * 
   * Requirement 7.1: Remove order and unlock user's balance
   */
  cancelOrder(orderId: string, maker: string): boolean {
    // Search in bids
    for (const [key, entries] of this.bids) {
      const idx = entries.findIndex((e) => e.id === orderId);
      if (idx !== -1) {
        const entry = entries[idx];
        if (entry.order.maker.toLowerCase() !== maker.toLowerCase()) {
          return false;
        }
        // Unlock balance using Ledger service
        this.unlockBalance(entry.order, entry.remaining);
        entries.splice(idx, 1);
        return true;
      }
    }

    // Search in asks
    for (const [key, entries] of this.asks) {
      const idx = entries.findIndex((e) => e.id === orderId);
      if (idx !== -1) {
        const entry = entries[idx];
        if (entry.order.maker.toLowerCase() !== maker.toLowerCase()) {
          return false;
        }
        this.unlockBalance(entry.order, entry.remaining);
        entries.splice(idx, 1);
        return true;
      }
    }

    return false;
  }

  // ============ Matching Logic ============

  /**
   * Match a buy order against the ask side of the order book.
   * 
   * Requirement 3.1: Price-time priority matching
   * Requirement 3.2: Execute at maker's (ask) price
   */
  private matchBuyOrder(buyEntry: OrderBookEntry, marketKey: string): Trade[] {
    const trades: Trade[] = [];
    const asks = this.asks.get(marketKey) || [];

    for (const ask of asks) {
      if (buyEntry.remaining === 0n) break;

      const buyPrice = this.calculatePrice(buyEntry.order);
      const askPrice = this.calculatePrice(ask.order);

      // Check if prices cross (buy price >= ask price)
      if (buyPrice < askPrice) break;

      // Execute trade at maker's (ask) price
      // Requirement 3.2: Trade executes at maker's price
      const fillAmount =
        buyEntry.remaining < ask.remaining
          ? buyEntry.remaining
          : ask.remaining;

      const trade = this.createTrade(buyEntry, ask, fillAmount, askPrice);
      trades.push(trade);

      buyEntry.remaining -= fillAmount;
      ask.remaining -= fillAmount;

      // Update balances using Ledger service
      // Requirement 3.6: Update both parties' balances immediately
      this.executeTrade(buyEntry.order, ask.order, fillAmount, askPrice);
    }

    // Remove fully filled asks
    this.asks.set(
      marketKey,
      asks.filter((a) => a.remaining > 0n)
    );
    return trades;
  }

  /**
   * Match a sell order against the bid side of the order book.
   * 
   * Requirement 3.1: Price-time priority matching
   * Requirement 3.3: Execute at maker's (bid) price
   */
  private matchSellOrder(
    sellEntry: OrderBookEntry,
    marketKey: string
  ): Trade[] {
    const trades: Trade[] = [];
    const bids = this.bids.get(marketKey) || [];

    for (const bid of bids) {
      if (sellEntry.remaining === 0n) break;

      const sellPrice = this.calculatePrice(sellEntry.order);
      const bidPrice = this.calculatePrice(bid.order);

      // Check if prices cross (bid price >= sell price)
      if (bidPrice < sellPrice) break;

      // Execute trade at maker's (bid) price
      // Requirement 3.3: Trade executes at maker's price
      const fillAmount =
        sellEntry.remaining < bid.remaining
          ? sellEntry.remaining
          : bid.remaining;

      const trade = this.createTrade(bid, sellEntry, fillAmount, bidPrice);
      trades.push(trade);

      sellEntry.remaining -= fillAmount;
      bid.remaining -= fillAmount;

      // Update balances using Ledger service
      // Requirement 3.6: Update both parties' balances immediately
      this.executeTrade(bid.order, sellEntry.order, fillAmount, bidPrice);
    }

    // Remove fully filled bids
    this.bids.set(
      marketKey,
      bids.filter((b) => b.remaining > 0n)
    );
    return trades;
  }

  // ============ Order Book Insertion ============

  private insertBid(marketKey: string, entry: OrderBookEntry): void {
    const bids = this.bids.get(marketKey) || [];
    const price = this.calculatePrice(entry.order);

    // Insert maintaining descending price order (best bid first)
    // For equal prices, earlier timestamp has priority (price-time priority)
    let insertIdx = bids.length;
    for (let i = 0; i < bids.length; i++) {
      const existingPrice = this.calculatePrice(bids[i].order);
      if (
        price > existingPrice ||
        (price === existingPrice && entry.timestamp < bids[i].timestamp)
      ) {
        insertIdx = i;
        break;
      }
    }

    bids.splice(insertIdx, 0, entry);
    this.bids.set(marketKey, bids);
  }

  private insertAsk(marketKey: string, entry: OrderBookEntry): void {
    const asks = this.asks.get(marketKey) || [];
    const price = this.calculatePrice(entry.order);

    // Insert maintaining ascending price order (best ask first)
    // For equal prices, earlier timestamp has priority (price-time priority)
    let insertIdx = asks.length;
    for (let i = 0; i < asks.length; i++) {
      const existingPrice = this.calculatePrice(asks[i].order);
      if (
        price < existingPrice ||
        (price === existingPrice && entry.timestamp < asks[i].timestamp)
      ) {
        insertIdx = i;
        break;
      }
    }

    asks.splice(insertIdx, 0, entry);
    this.asks.set(marketKey, asks);
  }

  // ============ Balance Management (via Ledger) ============

  /**
   * Deposit funds to a user's balance.
   * Delegates to Ledger service.
   */
  deposit(user: string, tokenId: bigint, amount: bigint): void {
    this.ledger.credit(user, tokenId, amount);
  }

  /**
   * Get a user's balance for a specific token.
   * Delegates to Ledger service.
   */
  getBalance(user: string, tokenId: bigint): UserBalance {
    return this.ledger.getBalance(user, tokenId);
  }

  /**
   * Lock balance for an order.
   * 
   * Requirement 2.7: Lock required balance when order passes validation
   */
  private lockBalance(order: SignedOrder): void {
    // For BUY: lock collateral (tokenId = 0)
    // For SELL: lock outcome tokens
    const tokenId = order.side === Side.BUY ? 0n : order.tokenId;
    const amount = order.makerAmount;

    try {
      this.ledger.lock(order.maker, tokenId, amount);
    } catch (error) {
      if (error instanceof LedgerError && error.code === LedgerErrorCode.INSUFFICIENT_BALANCE) {
        throw new Error("Insufficient balance");
      }
      throw error;
    }
  }

  /**
   * Unlock balance when an order is cancelled or partially filled.
   * 
   * Requirement 7.1: Unlock user's balance on cancellation
   */
  private unlockBalance(order: SignedOrder, amount: bigint): void {
    const tokenId = order.side === Side.BUY ? 0n : order.tokenId;
    
    try {
      this.ledger.unlock(order.maker, tokenId, amount);
    } catch (error) {
      // Log but don't throw - unlock failures shouldn't break the flow
      console.error("Failed to unlock balance:", error);
    }
  }

  /**
   * Execute a trade by updating both parties' balances.
   * 
   * Requirement 3.6: Update both parties' balances immediately
   * 
   * For a BUY vs SELL trade:
   * - Buyer: pays collateral (from locked), receives tokens
   * - Seller: pays tokens (from locked), receives collateral
   */
  private executeTrade(
    buyOrder: SignedOrder,
    sellOrder: SignedOrder,
    amount: bigint,
    price: bigint
  ): void {
    const buyer = buyOrder.maker;
    const seller = sellOrder.maker;
    const tokenId = sellOrder.tokenId;

    // Calculate collateral cost
    const cost = (price * amount) / ONE;

    // Buyer: transfer collateral from locked to seller
    // First unlock the cost from buyer's locked collateral
    this.ledger.unlock(buyer, 0n, cost);
    // Then transfer to seller
    this.ledger.transfer(buyer, seller, 0n, cost, false);

    // Refund excess collateral if trade price < order price
    const orderCost = (this.calculatePrice(buyOrder) * amount) / ONE;
    if (orderCost > cost) {
      const refund = orderCost - cost;
      this.ledger.unlock(buyer, 0n, refund);
    }

    // Seller: transfer tokens from locked to buyer
    this.ledger.transfer(seller, buyer, tokenId, amount, true);

    // Credit buyer with tokens (they receive tokens)
    // Note: The transfer above moves from seller's locked to buyer's available
  }

  // ============ Validation ============

  private validateOrder(order: SignedOrder): { valid: boolean; reason?: string } {
    // Check expiration
    if (order.expiration > 0n && order.expiration < BigInt(Date.now()) / 1000n) {
      return { valid: false, reason: "Order expired" };
    }

    // Check nonce using Ledger service
    const currentNonce = this.ledger.getNonce(order.maker);
    if (order.nonce !== currentNonce) {
      return { valid: false, reason: "Invalid nonce" };
    }

    // Check balance using Ledger service
    // Requirement 2.5: Verify balance sufficiency
    const tokenId = order.side === Side.BUY ? 0n : order.tokenId;
    if (!this.ledger.hasSufficientBalance(order.maker, tokenId, order.makerAmount)) {
      return { valid: false, reason: "Insufficient balance" };
    }

    return { valid: true };
  }

  // ============ Helpers ============

  /**
   * Calculate the price of an order in normalized units (ONE = 10^18).
   * For BUY orders: price = makerAmount / takerAmount (collateral per token)
   * For SELL orders: price = takerAmount / makerAmount (collateral per token)
   */
  calculatePrice(order: SignedOrder): bigint {
    if (order.side === Side.BUY) {
      return order.takerAmount !== 0n
        ? (order.makerAmount * ONE) / order.takerAmount
        : 0n;
    }
    return order.makerAmount !== 0n
      ? (order.takerAmount * ONE) / order.makerAmount
      : 0n;
  }

  /**
   * Detect match type based on order sides and prices.
   * 
   * - COMPLEMENTARY: BUY vs SELL (standard match)
   * - MINT: Two BUY orders with prices summing >= 1.0
   * - MERGE: Two SELL orders with prices summing <= 1.0
   * 
   * Requirements: 3.4, 3.5
   */
  detectMatchType(order1: SignedOrder, order2: SignedOrder): MatchType {
    const price1 = this.calculatePrice(order1);
    const price2 = this.calculatePrice(order2);

    // COMPLEMENTARY: BUY vs SELL
    if (order1.side !== order2.side) {
      return MatchType.COMPLEMENTARY;
    }

    // MINT: Two BUY orders with prices summing >= 1.0
    // Requirement 3.4: Detect MINT when two BUY orders have prices summing >= 1.0
    if (order1.side === Side.BUY && order2.side === Side.BUY) {
      if (price1 + price2 >= ONE) {
        return MatchType.MINT;
      }
    }

    // MERGE: Two SELL orders with prices summing <= 1.0
    // Requirement 3.5: Detect MERGE when two SELL orders have prices summing <= 1.0
    if (order1.side === Side.SELL && order2.side === Side.SELL) {
      if (price1 + price2 <= ONE) {
        return MatchType.MERGE;
      }
    }

    // Default to COMPLEMENTARY if no special case matches
    return MatchType.COMPLEMENTARY;
  }

  /**
   * Check if two BUY orders can be matched as a MINT trade.
   * MINT occurs when the sum of buy prices >= 1.0 (full collateral coverage).
   * 
   * Requirement 3.4
   */
  canMint(buyOrder1: SignedOrder, buyOrder2: SignedOrder): boolean {
    if (buyOrder1.side !== Side.BUY || buyOrder2.side !== Side.BUY) {
      return false;
    }
    const price1 = this.calculatePrice(buyOrder1);
    const price2 = this.calculatePrice(buyOrder2);
    return price1 + price2 >= ONE;
  }

  /**
   * Check if two SELL orders can be matched as a MERGE trade.
   * MERGE occurs when the sum of sell prices <= 1.0 (can redeem for collateral).
   * 
   * Requirement 3.5
   */
  canMerge(sellOrder1: SignedOrder, sellOrder2: SignedOrder): boolean {
    if (sellOrder1.side !== Side.SELL || sellOrder2.side !== Side.SELL) {
      return false;
    }
    const price1 = this.calculatePrice(sellOrder1);
    const price2 = this.calculatePrice(sellOrder2);
    return price1 + price2 <= ONE;
  }

  private generateOrderId(order: SignedOrder): string {
    return `${order.marketId}-${order.salt.toString(16)}`;
  }

  /**
   * Calculate the fee for a trade.
   * 
   * Formula: fee = feeRateBps × min(price, 1-price) × outcomeTokens / BPS_DIVISOR
   * 
   * The fee is calculated using the minimum of price and (1-price) to ensure
   * symmetric fee treatment for both sides of the market.
   * 
   * Requirement 12.1: Fee calculation formula
   * 
   * @param price - Trade price in normalized units (ONE = 10^18)
   * @param amount - Number of outcome tokens traded
   * @param feeRateBps - Fee rate in basis points
   * @returns Fee amount in collateral units
   */
  calculateFee(price: bigint, amount: bigint, feeRateBps: bigint): bigint {
    if (feeRateBps === 0n) {
      return 0n;
    }

    // Calculate min(price, 1-price)
    const complementPrice = ONE - price;
    const minPrice = price < complementPrice ? price : complementPrice;

    // fee = feeRateBps × minPrice × amount / (BPS_DIVISOR × ONE)
    // We divide by ONE because minPrice is in normalized units
    const fee = (feeRateBps * minPrice * amount) / (BPS_DIVISOR * ONE);

    return fee;
  }

  private createTrade(
    bidEntry: OrderBookEntry,
    askEntry: OrderBookEntry,
    amount: bigint,
    price: bigint
  ): Trade {
    const matchType = this.detectMatchType(bidEntry.order, askEntry.order);
    
    // Use the taker's fee rate (the order that crosses the spread)
    // In a BUY vs SELL match, the taker is the one who submitted the crossing order
    const feeRateBps = askEntry.order.feeRateBps;
    const fee = this.calculateFee(price, amount, feeRateBps);
    
    return {
      id: `trade-${++this.tradeCounter}`,
      takerOrderHash: askEntry.id,
      makerOrderHash: bidEntry.id,
      maker: bidEntry.order.maker,
      taker: askEntry.order.maker,
      tokenId: askEntry.order.tokenId,
      amount,
      price,
      matchType,
      timestamp: Date.now(),
      fee,
      feeRateBps,
    };
  }

  // ============ Settlement ============

  getPendingTrades(): Trade[] {
    return [...this.pendingTrades];
  }

  clearPendingTrades(): Trade[] {
    const trades = this.pendingTrades;
    this.pendingTrades = [];
    return trades;
  }

  // ============ View Functions ============

  getOrderBook(
    marketId: string,
    tokenId: bigint,
    depth: number = 10
  ): { bids: OrderBookEntry[]; asks: OrderBookEntry[] } {
    const marketKey = `${marketId}-${tokenId}`;
    const bids = (this.bids.get(marketKey) || []).slice(0, depth);
    const asks = (this.asks.get(marketKey) || []).slice(0, depth);
    return { bids, asks };
  }

  getBestBid(marketId: string, tokenId: bigint): { price: bigint; quantity: bigint } | null {
    const marketKey = `${marketId}-${tokenId}`;
    const bids = this.bids.get(marketKey) || [];
    if (bids.length === 0) return null;
    return {
      price: this.calculatePrice(bids[0].order),
      quantity: bids[0].remaining,
    };
  }

  getBestAsk(marketId: string, tokenId: bigint): { price: bigint; quantity: bigint } | null {
    const marketKey = `${marketId}-${tokenId}`;
    const asks = this.asks.get(marketKey) || [];
    if (asks.length === 0) return null;
    return {
      price: this.calculatePrice(asks[0].order),
      quantity: asks[0].remaining,
    };
  }

  getOrder(orderId: string): OrderBookEntry | null {
    for (const entries of this.bids.values()) {
      const entry = entries.find((e) => e.id === orderId);
      if (entry) return entry;
    }
    for (const entries of this.asks.values()) {
      const entry = entries.find((e) => e.id === orderId);
      if (entry) return entry;
    }
    return null;
  }

  /**
   * Get the underlying Ledger service.
   * Useful for testing and direct balance operations.
   */
  getLedger(): Ledger {
    return this.ledger;
  }
}
