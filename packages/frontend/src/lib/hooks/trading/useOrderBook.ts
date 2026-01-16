/**
 * useOrderBook Hook
 *
 * Hook for real-time order book updates via SSE subscription.
 * Maintains local order book state and handles reconnection.
 *
 * Requirements: 3.2, 9.4, 9.5
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { type Hex } from 'viem';
import { fetchApi, ApiError } from '../../api';

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
  /** Number of reconnection attempts */
  reconnectAttempts: number;
  /** Last successful update timestamp */
  lastUpdateTime: number | null;
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
  const [lastUpdateTime, setLastUpdateTime] = useState<number | null>(null);

  // Refs for SSE management
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Heartbeat timeout (30 seconds without any event triggers reconnect)
  const HEARTBEAT_TIMEOUT = 30000;

  // Reset heartbeat timer
  const resetHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }
    
    if (!isUnmountedRef.current && connectionStatus === 'connected') {
      heartbeatTimeoutRef.current = setTimeout(() => {
        console.warn('[useOrderBook] Heartbeat timeout, reconnecting...');
        if (!isUnmountedRef.current && eventSourceRef.current) {
          eventSourceRef.current.close();
          setConnectionStatus('error');
          // Trigger reconnection
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current += 1;
            reconnectTimeoutRef.current = setTimeout(() => {
              if (!isUnmountedRef.current) {
                connect();
              }
            }, reconnectDelay);
          }
        }
      }, HEARTBEAT_TIMEOUT);
    }
  }, [connectionStatus, maxReconnectAttempts, reconnectDelay]);

  // Fetch initial order book data with error handling
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
        setLastUpdateTime(Date.now());
      }
    } catch (err) {
      if (!isUnmountedRef.current) {
        const apiError = err instanceof ApiError 
          ? err 
          : new ApiError(
              err instanceof Error ? err.message : 'Failed to fetch order book',
              'UNKNOWN',
              0
            );
        setError(apiError);
        console.error('[useOrderBook] Failed to fetch order book:', apiError.message);
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

    // Reset heartbeat on any event
    resetHeartbeat();

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
          setLastUpdateTime(Date.now());
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
          // Keep-alive, no action needed but heartbeat is reset
          break;
      }
    } catch (err) {
      console.error('[useOrderBook] Error handling SSE event:', err);
    }
  }, [fetchOrderBook, resetHeartbeat]);

  // Connect to SSE stream with improved reconnection logic
  const connect = useCallback(() => {
    if (!marketId || tokenId === undefined || !enableSSE) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Clear any pending reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnectionStatus('connecting');
    setError(null);

    const url = `/api/orderbook/${marketId}/${tokenId}/stream`;
    
    try {
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (!isUnmountedRef.current) {
          setConnectionStatus('connected');
          setError(null);
          reconnectAttemptsRef.current = 0;
          resetHeartbeat();
          console.log('[useOrderBook] SSE connected');
        }
      };

      eventSource.onerror = (e) => {
        if (!isUnmountedRef.current) {
          console.warn('[useOrderBook] SSE error, attempting reconnection...', e);
          setConnectionStatus('error');
          eventSource.close();

          // Clear heartbeat on error
          if (heartbeatTimeoutRef.current) {
            clearTimeout(heartbeatTimeoutRef.current);
          }

          // Attempt reconnection with exponential backoff
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current += 1;
            const delay = reconnectDelay * Math.pow(1.5, reconnectAttemptsRef.current - 1);
            const jitteredDelay = delay + (Math.random() * 1000); // Add jitter
            
            console.log(`[useOrderBook] Reconnecting in ${Math.round(jitteredDelay)}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              if (!isUnmountedRef.current) {
                connect();
              }
            }, jitteredDelay);
          } else {
            setError(new ApiError(
              'Failed to connect to order book stream after multiple attempts',
              'NETWORK_ERROR',
              0
            ));
            console.error('[useOrderBook] Max reconnection attempts reached');
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
    } catch (err) {
      console.error('[useOrderBook] Failed to create EventSource:', err);
      setConnectionStatus('error');
      setError(err instanceof Error ? err : new Error('Failed to connect'));
    }
  }, [marketId, tokenId, enableSSE, maxReconnectAttempts, reconnectDelay, handleSSEEvent, resetHeartbeat]);

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
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
    setConnectionStatus('disconnected');
  }, []);

  // Reconnect manually
  const reconnect = useCallback(() => {
    console.log('[useOrderBook] Manual reconnect triggered');
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
      reconnectAttempts: reconnectAttemptsRef.current,
      lastUpdateTime,
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
      lastUpdateTime,
    ]
  );
}
