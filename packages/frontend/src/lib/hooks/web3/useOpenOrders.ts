/**
 * useOpenOrders Hook
 *
 * Reads user's active orders from OrderBook contract.
 * Subscribes to OrderFilled and OrderCancelled events for real-time updates.
 *
 * Requirements: 7.4, 10.5
 */

import { useMemo } from 'react';
import { useReadContract, useWatchContractEvent, useAccount } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import {
  orderBookAbi,
  CONTRACT_ADDRESSES,
  type SupportedChainId,
  isSupportedChain,
  basisPointsToPrice,
} from '@thesis/shared';
import { DEFAULT_CHAIN_ID } from '../../wagmi';

/**
 * Token type for display
 */
export type TokenType = 'YES' | 'NO';

/**
 * Order side enum
 */
export type OrderSide = 'BUY' | 'SELL';

/**
 * Open order data for display
 */
export interface OpenOrder {
  /** Order ID */
  orderId: bigint;
  /** Market address (derived from marketId) */
  marketId: `0x${string}`;
  /** Token type (YES or NO) */
  tokenType: TokenType;
  /** Order side (BUY or SELL) */
  side: OrderSide;
  /** Price in decimal format (0.01-0.99) */
  price: number;
  /** Total order quantity */
  quantity: bigint;
  /** Amount already filled */
  filled: bigint;
  /** Remaining quantity to be filled */
  remaining: bigint;
  /** Order timestamp */
  timestamp: Date;
  /** Whether order is active */
  active: boolean;
}

/**
 * Return type for useOpenOrders hook
 */
export interface UseOpenOrdersReturn {
  /** Array of user's open orders */
  orders: OpenOrder[];
  /** Number of active orders */
  activeOrderCount: number;
  /** Whether data is loading */
  isLoading: boolean;
  /** Whether there was an error */
  isError: boolean;
  /** Error object if any */
  error: Error | null;
  /** Refetch orders data */
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
 * Parse contract order to OpenOrder
 */
function parseOrder(contractOrder: any): OpenOrder {
  const side: OrderSide = contractOrder.side === 0 ? 'BUY' : 'SELL';
  const price = basisPointsToPrice(contractOrder.price);
  const remaining = BigInt(contractOrder.quantity) - BigInt(contractOrder.filled);

  // For now, we'll use a placeholder for tokenType
  // In production, you'd need to map tokenId to YES/NO based on market data
  const tokenType: TokenType = 'YES'; // Placeholder

  return {
    orderId: contractOrder.id,
    marketId: contractOrder.marketId,
    tokenType,
    side,
    price,
    quantity: contractOrder.quantity,
    filled: contractOrder.filled,
    remaining,
    timestamp: new Date(Number(contractOrder.timestamp) * 1000),
    active: contractOrder.active,
  };
}

/**
 * Hook for reading user's open orders from the OrderBook contract
 *
 * @param userAddress - User's wallet address
 * @returns User's open orders and loading/error states
 */
export function useOpenOrders(
  userAddress: `0x${string}` | undefined
): UseOpenOrdersReturn {
  const { chainId } = useAccount();
  const addresses = getAddresses(chainId);
  const queryClient = useQueryClient();

  // Read user's orders from OrderBook
  const {
    data: ordersData,
    isLoading,
    isError,
    error,
    refetch,
  } = useReadContract({
    address: addresses.orderBook,
    abi: orderBookAbi,
    functionName: 'getUserOrders',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
      staleTime: 10_000, // 10 seconds
    },
  });

  // Watch OrderFilled events for real-time updates
  useWatchContractEvent({
    address: addresses.orderBook,
    abi: orderBookAbi,
    eventName: 'OrderFilled',
    onLogs: () => {
      // Check if any filled orders belong to this user
      // Note: OrderFilled event doesn't include maker address, so we invalidate all
      queryClient.invalidateQueries({
        queryKey: ['readContract', { address: addresses.orderBook, functionName: 'getUserOrders' }],
      });
    },
    enabled: !!userAddress,
  });

  // Watch OrderCancelled events
  useWatchContractEvent({
    address: addresses.orderBook,
    abi: orderBookAbi,
    eventName: 'OrderCancelled',
    onLogs: () => {
      // Invalidate user orders query
      queryClient.invalidateQueries({
        queryKey: ['readContract', { address: addresses.orderBook, functionName: 'getUserOrders' }],
      });
    },
    enabled: !!userAddress,
  });

  // Watch OrderPlaced events (for new orders)
  useWatchContractEvent({
    address: addresses.orderBook,
    abi: orderBookAbi,
    eventName: 'OrderPlaced',
    onLogs: (logs) => {
      // Check if any new orders belong to this user
      const userOrder = logs.some((log) => log.args.maker === userAddress);
      if (userOrder) {
        queryClient.invalidateQueries({
          queryKey: ['readContract', { address: addresses.orderBook, functionName: 'getUserOrders' }],
        });
      }
    },
    enabled: !!userAddress,
  });

  // Parse and filter orders
  const orders = useMemo((): OpenOrder[] => {
    if (!ordersData) {
      return [];
    }

    const rawOrders = ordersData as any[];
    return rawOrders.map(parseOrder);
  }, [ordersData]);

  // Count active orders
  const activeOrderCount = useMemo(() => {
    return orders.filter((order) => order.active && order.remaining > 0n).length;
  }, [orders]);

  return useMemo(
    () => ({
      orders,
      activeOrderCount,
      isLoading,
      isError,
      error,
      refetch,
    }),
    [orders, activeOrderCount, isLoading, isError, error, refetch]
  );
}

/**
 * Hook for reading open orders for a specific market
 *
 * @param userAddress - User's wallet address
 * @param marketId - Market ID to filter by
 * @returns User's open orders for the specified market
 */
export function useOpenOrdersForMarket(
  userAddress: `0x${string}` | undefined,
  marketId: `0x${string}` | undefined
): UseOpenOrdersReturn {
  const allOrders = useOpenOrders(userAddress);

  // Filter orders for the specified market
  const orders = useMemo(() => {
    if (!marketId) {
      return [];
    }
    return allOrders.orders.filter((order) => order.marketId === marketId);
  }, [allOrders.orders, marketId]);

  const activeOrderCount = useMemo(() => {
    return orders.filter((order) => order.active && order.remaining > 0n).length;
  }, [orders]);

  return useMemo(
    () => ({
      orders,
      activeOrderCount,
      isLoading: allOrders.isLoading,
      isError: allOrders.isError,
      error: allOrders.error,
      refetch: allOrders.refetch,
    }),
    [orders, activeOrderCount, allOrders]
  );
}
