/**
 * useOrderBook Hook
 *
 * Provides order book state reading from the OrderBook contract.
 * Reads bids and asks with depth, calculates mid-price and spread.
 * Subscribes to Trade events for real-time price updates.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.5, 10.5
 */

import { useMemo } from 'react';
import { useReadContract, useWatchContractEvent } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import {
  orderBookAbi,
  CONTRACT_ADDRESSES,
  type SupportedChainId,
  isSupportedChain,
} from '@thesis/shared';
import { DEFAULT_CHAIN_ID } from '../../wagmi';
import { useAccount } from 'wagmi';

/**
 * Order side enum
 */
export type OrderSide = 'BUY' | 'SELL';

/**
 * Order data structure from contract
 */
export interface Order {
  id: bigint;
  maker: `0x${string}`;
  marketId: `0x${string}`;
  tokenId: bigint;
  side: OrderSide;
  price: bigint; // In basis points (1-9999)
  quantity: bigint;
  filled: bigint;
  timestamp: Date;
  active: boolean;
}

/**
 * Order book level aggregating orders at the same price
 */
export interface OrderBookLevel {
  /** Price in decimal format (0.01 - 0.99) */
  price: number;
  /** Total quantity at this price level */
  quantity: bigint;
  /** Number of orders at this price level */
  orderCount: number;
}

/**
 * Order book state
 */
export interface OrderBookState {
  /** Bid levels (buy orders) sorted by price descending */
  bids: OrderBookLevel[];
  /** Ask levels (sell orders) sorted by price ascending */
  asks: OrderBookLevel[];
  /** Mid-price calculated as (best_bid + best_ask) / 2, null if no orders */
  midPrice: number | null;
  /** Spread calculated as (best_ask - best_bid), null if no orders on both sides */
  spread: number | null;
  /** Last trade price, null if no trades yet */
  lastTradePrice: number | null;
}

/**
 * Options for useOrderBook hook
 */
export interface UseOrderBookOptions {
  /** Order book depth (number of price levels to fetch) */
  depth?: number;
  /** Whether to enable real-time updates via event watching */
  watchEvents?: boolean;
  /** Custom stale time in milliseconds (default: 5 seconds for dynamic data) */
  staleTime?: number;
}

/**
 * Return type for useOrderBook hook
 */
export interface UseOrderBookReturn {
  /** Order book state data */
  data: OrderBookState | undefined;
  /** Whether data is loading */
  isLoading: boolean;
  /** Whether there was an error */
  isError: boolean;
  /** Error object if any */
  error: Error | null;
  /** Refetch order book data */
  refetch: () => void;
}

/**
 * Get contract addresses for the current chain
 */
function getAddresses(chainId: number | undefined): {
  orderBook: `0x${string}`;
} {
  const effectiveChainId = chainId && isSupportedChain(chainId) ? chainId : DEFAULT_CHAIN_ID;
  return {
    orderBook: CONTRACT_ADDRESSES[effectiveChainId as SupportedChainId].orderBook,
  };
}

/**
 * Convert basis points to decimal price (0.01 - 0.99)
 */
function basisPointsToPrice(bp: bigint): number {
  return Number(bp) / 10000;
}

/**
 * Parse contract order to typed Order
 */
function parseOrder(contractOrder: any): Order {
  return {
    id: contractOrder.id,
    maker: contractOrder.maker,
    marketId: contractOrder.marketId,
    tokenId: contractOrder.tokenId,
    side: contractOrder.side === 0 ? 'BUY' : 'SELL',
    price: contractOrder.price,
    quantity: contractOrder.quantity,
    filled: contractOrder.filled,
    timestamp: new Date(Number(contractOrder.timestamp) * 1000),
    active: contractOrder.active,
  };
}

/**
 * Aggregate orders into price levels
 */
function aggregateOrders(orders: Order[]): OrderBookLevel[] {
  const levelMap = new Map<number, { quantity: bigint; count: number }>();

  for (const order of orders) {
    if (!order.active) continue;

    const price = basisPointsToPrice(order.price);
    const remainingQty = order.quantity - order.filled;

    if (remainingQty <= 0n) continue;

    const existing = levelMap.get(price);
    if (existing) {
      levelMap.set(price, {
        quantity: existing.quantity + remainingQty,
        count: existing.count + 1,
      });
    } else {
      levelMap.set(price, {
        quantity: remainingQty,
        count: 1,
      });
    }
  }

  return Array.from(levelMap.entries())
    .map(([price, { quantity, count }]) => ({
      price,
      quantity,
      orderCount: count,
    }))
    .sort((a, b) => b.price - a.price); // Sort descending by default
}

/**
 * Calculate mid-price from best bid and ask
 * Property 9: Mid-Price Calculation
 */
function calculateMidPrice(
  bestBidPrice: number | null,
  bestAskPrice: number | null
): number | null {
  if (bestBidPrice === null || bestAskPrice === null) {
    return null;
  }
  return (bestBidPrice + bestAskPrice) / 2;
}

/**
 * Calculate spread from best bid and ask
 */
function calculateSpread(
  bestBidPrice: number | null,
  bestAskPrice: number | null
): number | null {
  if (bestBidPrice === null || bestAskPrice === null) {
    return null;
  }
  return bestAskPrice - bestBidPrice;
}

/**
 * Hook for reading order book state from the OrderBook contract
 *
 * @param marketId - Market ID (questionId from Market contract)
 * @param tokenId - Token ID (YES or NO token)
 * @param options - Configuration options
 * @returns Order book state data and loading/error states
 */
export function useOrderBook(
  marketId: `0x${string}` | undefined,
  tokenId: bigint | undefined,
  options: UseOrderBookOptions = {}
): UseOrderBookReturn {
  const { depth = 10, watchEvents = true, staleTime = 5_000 } = options; // 5 seconds default

  const { chainId } = useAccount();
  const addresses = getAddresses(chainId);
  const queryClient = useQueryClient();

  // Read order book data
  const {
    data: orderBookData,
    isLoading,
    isError,
    error,
    refetch,
  } = useReadContract({
    address: addresses.orderBook,
    abi: orderBookAbi,
    functionName: 'getOrderBook',
    args: marketId && tokenId !== undefined ? [marketId, tokenId, BigInt(depth)] : undefined,
    query: {
      enabled: !!marketId && tokenId !== undefined,
      staleTime,
    },
  });

  // Read best bid (currently unused - best bid/ask extracted from order book data)
  // const { data: bestBidData } = useReadContract({
  //   address: addresses.orderBook,
  //   abi: orderBookAbi,
  //   functionName: 'getBestBid',
  //   args: marketId && tokenId !== undefined ? [marketId, tokenId] : undefined,
  //   query: {
  //     enabled: !!marketId && tokenId !== undefined,
  //     staleTime,
  //   },
  // });

  // Read best ask (currently unused - best bid/ask extracted from order book data)
  // const { data: bestAskData } = useReadContract({
  //   address: addresses.orderBook,
  //   abi: orderBookAbi,
  //   functionName: 'getBestAsk',
  //   args: marketId && tokenId !== undefined ? [marketId, tokenId] : undefined,
  //   query: {
  //     enabled: !!marketId && tokenId !== undefined,
  //     staleTime,
  //   },
  // });

  // Watch Trade events for real-time price updates
  useWatchContractEvent({
    address: addresses.orderBook,
    abi: orderBookAbi,
    eventName: 'Trade',
    onLogs: (logs) => {
      // Filter for relevant market and token
      const relevantTrade = logs.some(
        (log) =>
          log.args.marketId === marketId &&
          log.args.tokenId === tokenId
      );

      if (relevantTrade) {
        // Invalidate queries to trigger refetch
        queryClient.invalidateQueries({
          queryKey: ['readContract', { address: addresses.orderBook }],
        });
      }
    },
    enabled: watchEvents && !!marketId && tokenId !== undefined,
  });

  // Watch OrderPlaced events
  useWatchContractEvent({
    address: addresses.orderBook,
    abi: orderBookAbi,
    eventName: 'OrderPlaced',
    onLogs: (logs) => {
      const relevantOrder = logs.some(
        (log) =>
          log.args.marketId === marketId &&
          log.args.tokenId === tokenId
      );

      if (relevantOrder) {
        queryClient.invalidateQueries({
          queryKey: ['readContract', { address: addresses.orderBook }],
        });
      }
    },
    enabled: watchEvents && !!marketId && tokenId !== undefined,
  });

  // Watch OrderFilled events
  useWatchContractEvent({
    address: addresses.orderBook,
    abi: orderBookAbi,
    eventName: 'OrderFilled',
    onLogs: () => {
      // OrderFilled doesn't include marketId, so invalidate all
      queryClient.invalidateQueries({
        queryKey: ['readContract', { address: addresses.orderBook }],
      });
    },
    enabled: watchEvents && !!marketId && tokenId !== undefined,
  });

  // Watch OrderCancelled events
  useWatchContractEvent({
    address: addresses.orderBook,
    abi: orderBookAbi,
    eventName: 'OrderCancelled',
    onLogs: () => {
      queryClient.invalidateQueries({
        queryKey: ['readContract', { address: addresses.orderBook }],
      });
    },
    enabled: watchEvents && !!marketId && tokenId !== undefined,
  });

  // Process order book data
  const data = useMemo((): OrderBookState | undefined => {
    if (!orderBookData) {
      return undefined;
    }

    const [rawBids, rawAsks] = orderBookData as [any[], any[]];

    // Parse orders
    const bids = rawBids.map(parseOrder);
    const asks = rawAsks.map(parseOrder);

    // Aggregate into price levels
    const bidLevels = aggregateOrders(bids);
    const askLevels = aggregateOrders(asks).sort((a, b) => a.price - b.price); // Sort ascending for asks

    // Extract best prices
    const bestBidPrice = bidLevels.length > 0 ? bidLevels[0].price : null;
    const bestAskPrice = askLevels.length > 0 ? askLevels[0].price : null;

    // Calculate mid-price and spread
    const midPrice = calculateMidPrice(bestBidPrice, bestAskPrice);
    const spread = calculateSpread(bestBidPrice, bestAskPrice);

    // For lastTradePrice, we would need to track it separately
    // For now, return null (would be populated from Trade event history)
    const lastTradePrice = null;

    return {
      bids: bidLevels,
      asks: askLevels,
      midPrice,
      spread,
      lastTradePrice,
    };
  }, [orderBookData]);

  return useMemo(
    () => ({
      data,
      isLoading,
      isError,
      error,
      refetch,
    }),
    [data, isLoading, isError, error, refetch]
  );
}
