import type { SignedOrder, OrderBookEntry, Trade, UserBalance } from "../types";
import { Side } from "../types";

const ONE = 10n ** 18n;

export class MatchingEngine {
  // marketKey (marketId-tokenId) -> sorted order arrays
  private bids = new Map<string, OrderBookEntry[]>();
  private asks = new Map<string, OrderBookEntry[]>();

  // User balances: address -> tokenId -> balance
  private balances = new Map<string, Map<bigint, UserBalance>>();

  // Nonces: address -> current nonce
  private nonces = new Map<string, bigint>();

  // Pending trades for batch settlement
  private pendingTrades: Trade[] = [];

  private tradeCounter = 0;

  // ============ Order Management ============

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

    // Lock balance
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

  cancelOrder(orderId: string, maker: string): boolean {
    // Search in bids
    for (const [key, entries] of this.bids) {
      const idx = entries.findIndex((e) => e.id === orderId);
      if (idx !== -1) {
        const entry = entries[idx];
        if (entry.order.maker.toLowerCase() !== maker.toLowerCase()) {
          return false;
        }
        // Unlock balance
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
      const fillAmount =
        buyEntry.remaining < ask.remaining
          ? buyEntry.remaining
          : ask.remaining;

      const trade = this.createTrade(buyEntry, ask, fillAmount, askPrice);
      trades.push(trade);

      buyEntry.remaining -= fillAmount;
      ask.remaining -= fillAmount;

      // Update balances
      this.executeTrade(buyEntry.order, ask.order, fillAmount, askPrice);
    }

    // Remove fully filled asks
    this.asks.set(
      marketKey,
      asks.filter((a) => a.remaining > 0n)
    );
    return trades;
  }

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
      const fillAmount =
        sellEntry.remaining < bid.remaining
          ? sellEntry.remaining
          : bid.remaining;

      const trade = this.createTrade(bid, sellEntry, fillAmount, bidPrice);
      trades.push(trade);

      sellEntry.remaining -= fillAmount;
      bid.remaining -= fillAmount;

      // Update balances
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

    // Insert maintaining descending price order
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

    // Insert maintaining ascending price order
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

  // ============ Balance Management ============

  deposit(user: string, tokenId: bigint, amount: bigint): void {
    const userBalances = this.balances.get(user.toLowerCase()) || new Map();
    const balance = userBalances.get(tokenId) || { available: 0n, locked: 0n };
    balance.available += amount;
    userBalances.set(tokenId, balance);
    this.balances.set(user.toLowerCase(), userBalances);
  }

  getBalance(user: string, tokenId: bigint): UserBalance {
    const userBalances = this.balances.get(user.toLowerCase());
    if (!userBalances) return { available: 0n, locked: 0n };
    return userBalances.get(tokenId) || { available: 0n, locked: 0n };
  }

  private lockBalance(order: SignedOrder): void {
    const user = order.maker.toLowerCase();
    const userBalances = this.balances.get(user) || new Map();

    // For BUY: lock collateral (tokenId = 0)
    // For SELL: lock outcome tokens
    const tokenId = order.side === Side.BUY ? 0n : order.tokenId;
    const amount = order.makerAmount;

    const balance = userBalances.get(tokenId) || { available: 0n, locked: 0n };
    if (balance.available < amount) {
      throw new Error("Insufficient balance");
    }

    balance.available -= amount;
    balance.locked += amount;
    userBalances.set(tokenId, balance);
    this.balances.set(user, userBalances);
  }

  private unlockBalance(order: SignedOrder, amount: bigint): void {
    const user = order.maker.toLowerCase();
    const userBalances = this.balances.get(user);
    if (!userBalances) return;

    const tokenId = order.side === Side.BUY ? 0n : order.tokenId;
    const balance = userBalances.get(tokenId);
    if (!balance) return;

    balance.locked -= amount;
    balance.available += amount;
  }

  private executeTrade(
    buyOrder: SignedOrder,
    sellOrder: SignedOrder,
    amount: bigint,
    price: bigint
  ): void {
    const buyer = buyOrder.maker.toLowerCase();
    const seller = sellOrder.maker.toLowerCase();
    const tokenId = sellOrder.tokenId;

    // Calculate collateral cost
    const cost = (price * amount) / ONE;

    // Buyer: unlock collateral, receive tokens
    const buyerBalances = this.balances.get(buyer)!;
    const buyerCollateral = buyerBalances.get(0n)!;
    buyerCollateral.locked -= cost;

    const buyerTokens = buyerBalances.get(tokenId) || {
      available: 0n,
      locked: 0n,
    };
    buyerTokens.available += amount;
    buyerBalances.set(tokenId, buyerTokens);

    // Refund excess collateral if trade price < order price
    const orderCost = (this.calculatePrice(buyOrder) * amount) / ONE;
    if (orderCost > cost) {
      buyerCollateral.available += orderCost - cost;
      buyerCollateral.locked -= orderCost - cost;
    }

    // Seller: unlock tokens, receive collateral
    const sellerBalances = this.balances.get(seller)!;
    const sellerTokens = sellerBalances.get(tokenId)!;
    sellerTokens.locked -= amount;

    const sellerCollateral = sellerBalances.get(0n) || {
      available: 0n,
      locked: 0n,
    };
    sellerCollateral.available += cost;
    sellerBalances.set(0n, sellerCollateral);
  }

  // ============ Validation ============

  private validateOrder(order: SignedOrder): { valid: boolean; reason?: string } {
    // Check expiration
    if (order.expiration > 0n && order.expiration < BigInt(Date.now()) / 1000n) {
      return { valid: false, reason: "Order expired" };
    }

    // Check nonce
    const currentNonce = this.nonces.get(order.maker.toLowerCase()) || 0n;
    if (order.nonce !== currentNonce) {
      return { valid: false, reason: "Invalid nonce" };
    }

    // Check balance
    const tokenId = order.side === Side.BUY ? 0n : order.tokenId;
    const balance = this.getBalance(order.maker, tokenId);
    if (balance.available < order.makerAmount) {
      return { valid: false, reason: "Insufficient balance" };
    }

    return { valid: true };
  }

  // ============ Helpers ============

  private calculatePrice(order: SignedOrder): bigint {
    if (order.side === Side.BUY) {
      return order.takerAmount !== 0n
        ? (order.makerAmount * ONE) / order.takerAmount
        : 0n;
    }
    return order.makerAmount !== 0n
      ? (order.takerAmount * ONE) / order.makerAmount
      : 0n;
  }

  private generateOrderId(order: SignedOrder): string {
    return `${order.marketId}-${order.salt.toString(16)}`;
  }

  private createTrade(
    bidEntry: OrderBookEntry,
    askEntry: OrderBookEntry,
    amount: bigint,
    price: bigint
  ): Trade {
    return {
      id: `trade-${++this.tradeCounter}`,
      takerOrderHash: askEntry.id,
      makerOrderHash: bidEntry.id,
      maker: bidEntry.order.maker,
      taker: askEntry.order.maker,
      tokenId: askEntry.order.tokenId,
      amount,
      price,
      timestamp: Date.now(),
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
}
