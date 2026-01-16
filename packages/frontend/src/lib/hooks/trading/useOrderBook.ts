/**
 * useOrderBook Hook
 *
 * Hook for real-time order book updates via SSE subscription.
 * Maintains local order book state and handles reconnection.
 *
 * Requirements: 9.4, 9.5
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { type Hex } from 'viem';
import { fetchApi } from '../../api';

// ============================================
// Types
// ============================================

/**
 * Price level in the order book
 */
export interface PriceLevel {
  /** Price in string format (for precision) */
  price: string;
  /** Total quantity at this price level */
  quantity: string;
  /** Number of orders at this level (optional) */
  orderCount?: number;
}

/**
 * Order book entry from API
 */
export interface OrderBookEntry {
  id: string;
  price: string;
  quantity: string;
  maker?: string;
}

/**
 * Order book state
 */
export interface OrderBookState {
  /** Bid levels (buy orders) sorted by price descending */
  bids: PriceLevel[];
  /** Ask levels (sell orders) sorted by price ascending */
  asks: PriceLevel[];
  /** Timestamp of last update */
  timestamp: number;
}

/**
 * SSE event types for order book updates
 */
type OrderBookEventType = 
  | 'snapshot'
  | 'order_added'
  | 'order_removed'
  | 'order_updated'
  | 'trade'
  | 'ping';

/**
 * SSE snapshot event data
 */
interface SnapshotEventData {
  marketId: string;
  tokenId: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

/**
 * Connection status
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Hook options
 */
export interface UseOrderBookOptions {
  /** Depth of order book to fetch (default: 20) */
  depth?: number;
  /** Enable SSE subscription (default: true) */
  enableSSE?: boolean;
  /** Reconnection delay in ms (default: 3000) */
  reconnectDelay?: number;
  /** Max reconnection attempts (default: 5) */
  maxReconnectAttempts?: number;
}

/**
 * Hook return type
 */
export interface UseOrderBookReturn {
  /** Bid levels (buy orders) */
  bids: PriceLevel[];
  /** Ask levels (sell orders) */
  asks: PriceLevel[];
  /** Spread between best bid and ask */
  spread: string | null;
  /** Best bid price */
  bestBid: string | null;
  /** Best ask price */
  bestAsk: string | null;
  /** Whether connected to SSE stream */
  isConnected: boolean;
  /** Connection status */
  connectionStatus: ConnectionStatus;
  /** Whether initial data is loading */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
  /** Manually reconnect */
  reconnect: () => void;
  /** Disconnect from SSE */
  disconnect: () => void;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Aggregate order book entries into price levels
 */
function aggregateToPriceLevels(entries: OrderBookEntry[]): PriceLevel[] {
  const levelMap = new Map<string, { quantity: bigint; count: number }>();

  for (const entry of entries) {
    const existing = levelMap.get(entry.price);
    if (existing) {
      existing.quantity += BigInt(entry.quantity);
      existing.count += 1;
    } else {
      levelMap.set(entry.price, {
        quantity: BigInt(entry.quantity),
        count: 1,
      });
    }
  }

  return Array.from(levelMap.entries()).map(([price, data]) => ({
    price,
    quantity: data.quantity.toString(),
    orderCount: data.count,
  }));
}

/**
 * Sort bids by price descending
 */
function sortBids(levels: PriceLevel[]): PriceLevel[] {
  return [...levels].sort((a, b) => {
    const priceA = BigInt(a.price);
    const priceB = BigInt(b.price);
    if (priceB > priceA) return 1;
    if (priceB < priceA) return -1;
    return 0;
  });
}

/**
 * Sort asks by price ascending
 */
function sortAsks(levels: PriceLevel[]): PriceLevel[] {
  return [...levels].sort((a, b) => {
    const priceA = BigInt(a.price);
    const priceB = BigInt(b.price);
    if (priceA > priceB) return 1;
    if (priceA < priceB) return -1;
    return 0;
  });
}

/**
 * Calculate spread between best bid and ask
 */
function calculateSpread(bestBid: string | null, bestAsk: string | null): string | null {
  if (!bestBid || !bestAsk) return null;
  const bid = BigInt(bestBid);
  const ask = BigInt(bestAsk);
  if (ask <= bid) return '0';
  return (ask - bid).toString();
}

// ============================================
// Hook Implementation
// ============================================

/**
 * Hook for real-time order book updates
 *
 * @param marketId - Market ID
 * @param tokenId - Token ID
 * @param options - Configuration options
 * @returns Order book state and connection info
 */
export function useOrderBook(
  marketId: Hex | undefined,
  tokenId: bigint | undefined,
  options: UseOrderBookOptions = {}
): UseOrderBookReturn {
  const {
    depth = 20,
    enableSSE = true,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5,
  } = options;

  // State
  const [orderBook, setOrderBook] = useState<OrderBookState>({
    bids: [],
    asks: [],
    timestamp: 0,
  });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Refs for SSE management
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);

  // Fetch initial order book data
  const fetchOrderBook = useCallback(async () => {
    if (!marketId || tokenId === undefined) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetchApi<{
        marketId: string;
        tokenId: string;
        bids: OrderBookEntry[];
        asks: OrderBookEntry[];
        timestamp: number;
      }>(`/api/orderbook/${marketId}/${tokenId}?depth=${depth}`);

      if (!isUnmountedRef.current) {
        const bids = sortBids(aggregateToPriceLevels(response.bids));
        const asks = sortAsks(aggregateToPriceLevels(response.asks));

        setOrderBook({
          bids,
          asks,
          timestamp: response.timestamp,
        });
      }
    } catch (err) {
      if (!isUnmountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to fetch order book'));
      }
    } finally {
      if (!isUnmountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [marketId, tokenId, depth]);

  // Handle SSE events
  const handleSSEEvent = useCallback((event: MessageEvent, eventType: OrderBookEventType) => {
    if (isUnmountedRef.current) return;

    try {
      const data = event.data ? JSON.parse(event.data) : null;

      switch (eventType) {
        case 'snapshot': {
          const snapshot = data as SnapshotEventData;
          const bids = sortBids(aggregateToPriceLevels(snapshot.bids));
          const asks = sortAsks(aggregateToPriceLevels(snapshot.asks));
          setOrderBook({
            bids,
            asks,
            timestamp: Date.now(),
          });
          setIsLoading(false);
          break;
        }

        case 'order_added': {
          // For simplicity, refetch on order changes
          // In production, you'd update the local state incrementally
          fetchOrderBook();
          break;
        }

        case 'order_removed': {
          fetchOrderBook();
          break;
        }

        case 'order_updated': {
          fetchOrderBook();
          break;
        }

        case 'trade': {
          // Trades may affect order book, refetch
          fetchOrderBook();
          break;
        }

        case 'ping':
          // Keep-alive, no action needed
          break;
      }
    } catch (err) {
      console.error('Error handling SSE event:', err);
    }
  }, [fetchOrderBook]);

  // Connect to SSE stream
  const connect = useCallback(() => {
    if (!marketId || tokenId === undefined || !enableSSE) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setConnectionStatus('connecting');

    const url = `/api/orderbook/${marketId}/${tokenId}/stream`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      if (!isUnmountedRef.current) {
        setConnectionStatus('connected');
        setError(null);
        reconnectAttemptsRef.current = 0;
      }
    };

    eventSource.onerror = () => {
      if (!isUnmountedRef.current) {
        setConnectionStatus('error');
        eventSource.close();

        // Attempt reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!isUnmountedRef.current) {
              connect();
            }
          }, reconnectDelay * reconnectAttemptsRef.current);
        } else {
          setError(new Error('Failed to connect to order book stream'));
        }
      }
    };

    // Register event handlers
    const eventTypes: OrderBookEventType[] = [
      'snapshot',
      'order_added',
      'order_removed',
      'order_updated',
      'trade',
      'ping',
    ];

    for (const eventType of eventTypes) {
      eventSource.addEventListener(eventType, (event) => {
        handleSSEEvent(event as MessageEvent, eventType);
      });
    }
  }, [marketId, tokenId, enableSSE, maxReconnectAttempts, reconnectDelay, handleSSEEvent]);

  // Disconnect from SSE stream
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setConnectionStatus('disconnected');
  }, []);

  // Reconnect manually
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    disconnect();
    connect();
  }, [disconnect, connect]);

  // Effect: Connect on mount, disconnect on unmount
  useEffect(() => {
    isUnmountedRef.current = false;

    if (marketId && tokenId !== undefined) {
      // Fetch initial data
      fetchOrderBook();

      // Connect to SSE if enabled
      if (enableSSE) {
        connect();
      }
    }

    return () => {
      isUnmountedRef.current = true;
      disconnect();
    };
  }, [marketId, tokenId, enableSSE, fetchOrderBook, connect, disconnect]);

  // Computed values
  const bestBid = useMemo(() => {
    return orderBook.bids.length > 0 ? orderBook.bids[0].price : null;
  }, [orderBook.bids]);

  const bestAsk = useMemo(() => {
    return orderBook.asks.length > 0 ? orderBook.asks[0].price : null;
  }, [orderBook.asks]);

  const spread = useMemo(() => {
    return calculateSpread(bestBid, bestAsk);
  }, [bestBid, bestAsk]);

  return useMemo(
    () => ({
      bids: orderBook.bids,
      asks: orderBook.asks,
      spread,
      bestBid,
      bestAsk,
      isConnected: connectionStatus === 'connected',
      connectionStatus,
      isLoading,
      error,
      reconnect,
      disconnect,
    }),
    [
      orderBook.bids,
      orderBook.asks,
      spread,
      bestBid,
      bestAsk,
      connectionStatus,
      isLoading,
      error,
      reconnect,
      disconnect,
    ]
  );
}
