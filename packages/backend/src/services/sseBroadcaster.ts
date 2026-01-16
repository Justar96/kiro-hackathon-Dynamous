/**
 * SSE Broadcaster Service
 * 
 * Manages SSE connections and broadcasts trading events to subscribed clients.
 * 
 * Requirements: 9.1, 9.2, 9.3, 4.7
 */

import type { Trade, OrderBookEntry as BackendOrderBookEntry, SignedOrder } from "../types";
import { Side, MatchType, SignatureType } from "../types";

/**
 * Callback type for SSE event delivery
 */
export type SSECallback = (event: string, data: unknown) => void | Promise<void>;

/**
 * Subscription types for different event channels
 */
export type SubscriptionType = "orderbook" | "balance" | "settlement";

// ============================================================================
// SSE Event Data Types (matching @thesis/shared)
// ============================================================================

/**
 * Signed order structure for SSE events (serialized for JSON)
 */
export interface SSESignedOrder {
  salt: string;
  maker: string;
  signer: string;
  taker: string;
  marketId: string;
  tokenId: string;
  side: number;
  makerAmount: string;
  takerAmount: string;
  expiration: string;
  nonce: string;
  feeRateBps: string;
  sigType: number;
  signature: string;
}

/**
 * Order book entry for SSE events
 */
export interface SSEOrderBookEntry {
  id: string;
  order: SSESignedOrder;
  remaining: string;
  timestamp: number;
}

/**
 * Trade record for SSE events
 */
export interface SSETradeRecord {
  id: string;
  takerOrderHash: string;
  makerOrderHash: string;
  maker: string;
  taker: string;
  tokenId: string;
  amount: string;
  price: string;
  matchType: number;
  timestamp: number;
}

/**
 * User balance for SSE events
 */
export interface SSEUserBalance {
  available: string;
  locked: string;
}

/**
 * Price level for SSE events
 */
export interface SSEPriceLevel {
  price: string;
  quantity: string;
  orderCount: number;
}

// ============================================================================
// SSE Event Interfaces
// ============================================================================

export interface OrderAddedEventData {
  entry: SSEOrderBookEntry;
  marketId: string;
}

export interface OrderRemovedEventData {
  orderId: string;
  marketId: string;
  tokenId: string;
}

export interface OrderUpdatedEventData {
  orderId: string;
  marketId: string;
  tokenId: string;
  filled: string;
  remaining: string;
}

export interface TradeEventData {
  trade: SSETradeRecord;
  marketId: string;
}

export interface PriceUpdateEventData {
  marketId: string;
  tokenId: string;
  price: string;
  bestBid: SSEPriceLevel | null;
  bestAsk: SSEPriceLevel | null;
}

export interface BalanceUpdateEventData {
  user: string;
  tokenId: string;
  balance: SSEUserBalance;
}

export interface EpochCommittedEventData {
  epochId: number;
  merkleRoot: string;
  totalAmount: string;
  tradeCount: number;
  txHash: string;
}

// Event wrapper interfaces
export interface OrderAddedEvent {
  event: "order_added";
  timestamp: string;
  data: OrderAddedEventData;
}

export interface OrderRemovedEvent {
  event: "order_removed";
  timestamp: string;
  data: OrderRemovedEventData;
}

export interface OrderUpdatedEvent {
  event: "order_updated";
  timestamp: string;
  data: OrderUpdatedEventData;
}

export interface TradeEvent {
  event: "trade";
  timestamp: string;
  data: TradeEventData;
}

export interface PriceUpdateEvent {
  event: "price_update";
  timestamp: string;
  data: PriceUpdateEventData;
}

export interface BalanceUpdateEvent {
  event: "balance_update";
  timestamp: string;
  userId: string;
  data: BalanceUpdateEventData;
}

export interface EpochCommittedEvent {
  event: "epoch_committed";
  timestamp: string;
  data: EpochCommittedEventData;
}

export type TradingEvent =
  | OrderAddedEvent
  | OrderRemovedEvent
  | OrderUpdatedEvent
  | TradeEvent
  | PriceUpdateEvent
  | BalanceUpdateEvent
  | EpochCommittedEvent;

/**
 * SSE Broadcaster for trading events
 * 
 * Manages client subscriptions and broadcasts events to appropriate channels.
 */
export class SSEBroadcaster {
  // Market-specific subscribers (marketId-tokenId -> callbacks)
  private orderbookSubscribers = new Map<string, Set<SSECallback>>();
  
  // User-specific subscribers (address -> callbacks)
  private balanceSubscribers = new Map<string, Set<SSECallback>>();
  
  // Global settlement subscribers
  private settlementSubscribers = new Set<SSECallback>();

  // ============ Subscription Management ============

  /**
   * Subscribe to order book updates for a specific market
   * 
   * Requirement 9.4: Send current order book state on subscription
   */
  subscribeOrderbook(marketId: string, tokenId: bigint, callback: SSECallback): () => void {
    const key = this.getMarketKey(marketId, tokenId);
    
    if (!this.orderbookSubscribers.has(key)) {
      this.orderbookSubscribers.set(key, new Set());
    }
    
    this.orderbookSubscribers.get(key)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.orderbookSubscribers.get(key)?.delete(callback);
      if (this.orderbookSubscribers.get(key)?.size === 0) {
        this.orderbookSubscribers.delete(key);
      }
    };
  }

  /**
   * Subscribe to balance updates for a specific user
   */
  subscribeBalance(userAddress: string, callback: SSECallback): () => void {
    const key = userAddress.toLowerCase();
    
    if (!this.balanceSubscribers.has(key)) {
      this.balanceSubscribers.set(key, new Set());
    }
    
    this.balanceSubscribers.get(key)!.add(callback);
    
    return () => {
      this.balanceSubscribers.get(key)?.delete(callback);
      if (this.balanceSubscribers.get(key)?.size === 0) {
        this.balanceSubscribers.delete(key);
      }
    };
  }

  /**
   * Subscribe to settlement/epoch events
   */
  subscribeSettlement(callback: SSECallback): () => void {
    this.settlementSubscribers.add(callback);
    
    return () => {
      this.settlementSubscribers.delete(callback);
    };
  }

  // ============ Event Broadcasting ============

  /**
   * Broadcast order added event
   * 
   * Requirement 9.1: Broadcast SSE event when order is added to book
   */
  broadcastOrderAdded(
    marketId: string,
    entry: BackendOrderBookEntry
  ): void {
    const event: OrderAddedEvent = {
      event: "order_added",
      timestamp: new Date().toISOString(),
      data: {
        entry: this.convertOrderBookEntry(entry),
        marketId,
      },
    };

    this.broadcastToMarket(marketId, entry.order.tokenId, event);
  }

  /**
   * Broadcast order removed event
   * 
   * Requirement 9.2: Broadcast SSE event when order is cancelled
   */
  broadcastOrderRemoved(
    marketId: string,
    tokenId: bigint,
    orderId: string
  ): void {
    const event: OrderRemovedEvent = {
      event: "order_removed",
      timestamp: new Date().toISOString(),
      data: {
        orderId,
        marketId,
        tokenId: tokenId.toString(),
      },
    };

    this.broadcastToMarket(marketId, tokenId, event);
  }

  /**
   * Broadcast order updated event (partial fill)
   * 
   * Requirement 9.2: Broadcast SSE event when order is updated
   */
  broadcastOrderUpdated(
    marketId: string,
    tokenId: bigint,
    orderId: string,
    filled: bigint,
    remaining: bigint
  ): void {
    const event: OrderUpdatedEvent = {
      event: "order_updated",
      timestamp: new Date().toISOString(),
      data: {
        orderId,
        marketId,
        tokenId: tokenId.toString(),
        filled: filled.toString(),
        remaining: remaining.toString(),
      },
    };

    this.broadcastToMarket(marketId, tokenId, event);
  }

  /**
   * Broadcast trade event
   * 
   * Requirement 9.3: Broadcast SSE event with trade details
   */
  broadcastTrade(marketId: string, trade: Trade): void {
    const event: TradeEvent = {
      event: "trade",
      timestamp: new Date().toISOString(),
      data: {
        trade: this.convertTrade(trade),
        marketId,
      },
    };

    this.broadcastToMarket(marketId, trade.tokenId, event);
    
    // Also broadcast to both parties' balance subscribers
    this.broadcastToUser(trade.maker, event);
    this.broadcastToUser(trade.taker, event);
  }

  /**
   * Broadcast price update event
   * 
   * Requirement 9.3: Broadcast price updates
   */
  broadcastPriceUpdate(
    marketId: string,
    tokenId: bigint,
    price: bigint,
    bestBid: { price: bigint; quantity: bigint } | null,
    bestAsk: { price: bigint; quantity: bigint } | null
  ): void {
    const event: PriceUpdateEvent = {
      event: "price_update",
      timestamp: new Date().toISOString(),
      data: {
        marketId,
        tokenId: tokenId.toString(),
        price: price.toString(),
        bestBid: bestBid ? this.convertPriceLevel(bestBid) : null,
        bestAsk: bestAsk ? this.convertPriceLevel(bestAsk) : null,
      },
    };

    this.broadcastToMarket(marketId, tokenId, event);
  }

  /**
   * Broadcast balance update event
   */
  broadcastBalanceUpdate(
    user: string,
    tokenId: bigint,
    balance: { available: bigint; locked: bigint }
  ): void {
    const event: BalanceUpdateEvent = {
      event: "balance_update",
      timestamp: new Date().toISOString(),
      userId: user,
      data: {
        user,
        tokenId: tokenId.toString(),
        balance: {
          available: balance.available.toString(),
          locked: balance.locked.toString(),
        },
      },
    };

    this.broadcastToUser(user, event);
  }

  /**
   * Broadcast epoch committed event
   * 
   * Requirement 4.7: Emit settlement event for frontend updates
   */
  broadcastEpochCommitted(
    epochId: number,
    merkleRoot: string,
    totalAmount: bigint,
    tradeCount: number,
    txHash: string
  ): void {
    const event: EpochCommittedEvent = {
      event: "epoch_committed",
      timestamp: new Date().toISOString(),
      data: {
        epochId,
        merkleRoot,
        totalAmount: totalAmount.toString(),
        tradeCount,
        txHash,
      },
    };

    this.broadcastToSettlement(event);
  }

  // ============ Internal Broadcasting ============

  /**
   * Broadcast event to all subscribers of a specific market
   */
  private broadcastToMarket(
    marketId: string,
    tokenId: bigint,
    event: TradingEvent
  ): void {
    const key = this.getMarketKey(marketId, tokenId);
    const subscribers = this.orderbookSubscribers.get(key);
    
    if (subscribers) {
      for (const callback of subscribers) {
        this.safeCallback(callback, event.event, event);
      }
    }
  }

  /**
   * Broadcast event to a specific user's subscribers
   */
  private broadcastToUser(user: string, event: TradingEvent): void {
    const key = user.toLowerCase();
    const subscribers = this.balanceSubscribers.get(key);
    
    if (subscribers) {
      for (const callback of subscribers) {
        this.safeCallback(callback, event.event, event);
      }
    }
  }

  /**
   * Broadcast event to all settlement subscribers
   */
  private broadcastToSettlement(event: TradingEvent): void {
    for (const callback of this.settlementSubscribers) {
      this.safeCallback(callback, event.event, event);
    }
  }

  /**
   * Safely execute a callback, catching any errors
   */
  private safeCallback(
    callback: SSECallback,
    event: string,
    data: unknown
  ): void {
    try {
      const result = callback(event, data);
      if (result instanceof Promise) {
        result.catch((error) => {
          console.error("SSE callback error:", error);
        });
      }
    } catch (error) {
      console.error("SSE callback error:", error);
    }
  }

  // ============ Helpers ============

  /**
   * Get market key for subscription map
   */
  private getMarketKey(marketId: string, tokenId: bigint): string {
    return `${marketId}-${tokenId}`;
  }

  /**
   * Convert backend OrderBookEntry to SSE type
   */
  private convertOrderBookEntry(entry: BackendOrderBookEntry): SSEOrderBookEntry {
    return {
      id: entry.id,
      order: this.convertSignedOrder(entry.order),
      remaining: entry.remaining.toString(),
      timestamp: entry.timestamp,
    };
  }

  /**
   * Convert backend SignedOrder to SSE type
   */
  private convertSignedOrder(order: SignedOrder): SSESignedOrder {
    return {
      salt: order.salt.toString(),
      maker: order.maker,
      signer: order.signer,
      taker: order.taker,
      marketId: order.marketId,
      tokenId: order.tokenId.toString(),
      side: order.side,
      makerAmount: order.makerAmount.toString(),
      takerAmount: order.takerAmount.toString(),
      expiration: order.expiration.toString(),
      nonce: order.nonce.toString(),
      feeRateBps: order.feeRateBps.toString(),
      sigType: order.sigType,
      signature: order.signature,
    };
  }

  /**
   * Convert backend Trade to SSE TradeRecord
   */
  private convertTrade(trade: Trade): SSETradeRecord {
    return {
      id: trade.id,
      takerOrderHash: trade.takerOrderHash,
      makerOrderHash: trade.makerOrderHash,
      maker: trade.maker,
      taker: trade.taker,
      tokenId: trade.tokenId.toString(),
      amount: trade.amount.toString(),
      price: trade.price.toString(),
      matchType: trade.matchType,
      timestamp: trade.timestamp,
    };
  }

  /**
   * Convert price level to SSE type
   */
  private convertPriceLevel(level: { price: bigint; quantity: bigint }): SSEPriceLevel {
    return {
      price: level.price.toString(),
      quantity: level.quantity.toString(),
      orderCount: 1,
    };
  }

  // ============ Stats ============

  /**
   * Get subscriber counts for monitoring
   */
  getStats(): {
    orderbookSubscribers: number;
    balanceSubscribers: number;
    settlementSubscribers: number;
    totalConnections: number;
  } {
    let orderbookCount = 0;
    for (const subscribers of this.orderbookSubscribers.values()) {
      orderbookCount += subscribers.size;
    }

    let balanceCount = 0;
    for (const subscribers of this.balanceSubscribers.values()) {
      balanceCount += subscribers.size;
    }

    return {
      orderbookSubscribers: orderbookCount,
      balanceSubscribers: balanceCount,
      settlementSubscribers: this.settlementSubscribers.size,
      totalConnections: orderbookCount + balanceCount + this.settlementSubscribers.size,
    };
  }
}

// Export singleton instance
export const sseBroadcaster = new SSEBroadcaster();
