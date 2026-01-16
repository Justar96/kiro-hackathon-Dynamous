/**
 * useOrders Hook
 *
 * Hook for order management including submission, cancellation, and status tracking.
 * Integrates with the OrderSigner for EIP-712 signing and the backend API.
 *
 * Requirements: 2.1, 2.2, 7.1
 */

import { useState, useCallback, useMemo } from 'react';
import { useAccount, useSignTypedData, useChainId } from 'wagmi';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Address, type Hex } from 'viem';
import { fetchApi, mutateApi, ApiError, queryKeys } from '../../api';
import {
  OrderSigner,
  type OrderParams,
  serializeOrder,
  Side,
  SignatureType,
} from '../../trading/orderSigner';
import { DEFAULT_CHAIN_ID } from '../../wagmi';

// ============================================
// Types
// ============================================

/**
 * Order submission parameters (user-facing)
 */
export interface SubmitOrderParams {
  marketId: Hex;
  tokenId: bigint;
  side: Side;
  /** Price in basis points (e.g., 5000 = $0.50) */
  price: bigint;
  /** Quantity of outcome tokens */
  quantity: bigint;
  /** Optional expiration timestamp (defaults to 24h) */
  expiration?: bigint;
  /** Optional fee rate in basis points */
  feeRateBps?: bigint;
}

/**
 * Order result from API
 */
export interface OrderResult {
  orderId: string;
  status: 'accepted' | 'rejected';
  trades: Array<{
    id: string;
    amount: string;
    price: string;
    matchType: number;
  }>;
  error?: string;
  errorCode?: string;
}

/**
 * Order entry from API
 */
export interface OrderEntry {
  id: string;
  marketId: string;
  tokenId: string;
  side: Side;
  price: string;
  quantity: string;
  remaining: string;
  timestamp: number;
}

/**
 * User orders response from API
 */
interface UserOrdersResponse {
  orders: OrderEntry[];
}

/**
 * User nonce response from API
 */
interface BalancesResponse {
  address: string;
  balances: Record<string, { available: string; locked: string; total: string }>;
  nonce: string;
}

/**
 * Hook return type
 */
export interface UseOrdersReturn {
  /** User's open orders */
  orders: OrderEntry[];
  /** Whether orders are loading */
  isLoading: boolean;
  /** Whether there was an error loading orders */
  isError: boolean;
  /** Error object if any */
  error: Error | null;
  /** Submit a new order */
  submitOrder: (params: SubmitOrderParams) => Promise<OrderResult>;
  /** Cancel an order by ID */
  cancelOrder: (orderId: string) => Promise<boolean>;
  /** Whether an order is being submitted */
  isSubmitting: boolean;
  /** Whether an order is being cancelled */
  isCancelling: boolean;
  /** Submission error */
  submitError: Error | null;
  /** Cancellation error */
  cancelError: Error | null;
  /** Refetch orders */
  refetch: () => void;
}

// ============================================
// Constants
// ============================================

const USDC_DECIMALS = 6;
const TOKEN_DECIMALS = 18;
const BPS_DIVISOR = 10000n;

// ============================================
// Helper Functions
// ============================================

/**
 * Convert price in basis points to maker/taker amounts
 * For BUY: makerAmount = price * quantity (USDC), takerAmount = quantity (tokens)
 * For SELL: makerAmount = quantity (tokens), takerAmount = price * quantity (USDC)
 */
function calculateAmounts(
  side: Side,
  price: bigint,
  quantity: bigint
): { makerAmount: bigint; takerAmount: bigint } {
  // Price is in basis points (0-10000 representing 0-1)
  // Convert to USDC amount: price * quantity / BPS_DIVISOR
  // Adjust for decimal differences: USDC has 6 decimals, tokens have 18
  const usdcAmount = (price * quantity) / BPS_DIVISOR / (10n ** BigInt(TOKEN_DECIMALS - USDC_DECIMALS));

  if (side === Side.BUY) {
    // BUY: paying USDC (makerAmount) for tokens (takerAmount)
    return {
      makerAmount: usdcAmount,
      takerAmount: quantity,
    };
  } else {
    // SELL: selling tokens (makerAmount) for USDC (takerAmount)
    return {
      makerAmount: quantity,
      takerAmount: usdcAmount,
    };
  }
}

/**
 * Get exchange address from environment or use default
 */
function getExchangeAddress(): Address {
  const envAddress = import.meta.env.VITE_EXCHANGE_ADDRESS;
  if (envAddress && envAddress !== '0x0000000000000000000000000000000000000000') {
    return envAddress as Address;
  }
  // Default placeholder - should be configured in production
  return '0x0000000000000000000000000000000000000000' as Address;
}

// ============================================
// Hook Implementation
// ============================================

/**
 * Hook for order management
 *
 * @param marketId - Optional market ID to filter orders
 * @returns Order management functions and state
 */
export function useOrders(marketId?: Hex): UseOrdersReturn {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const queryClient = useQueryClient();
  const { signTypedDataAsync } = useSignTypedData();

  // Local state for errors
  const [submitError, setSubmitError] = useState<Error | null>(null);
  const [cancelError, setCancelError] = useState<Error | null>(null);

  // Create order signer
  const orderSigner = useMemo(() => {
    const effectiveChainId = chainId || DEFAULT_CHAIN_ID;
    return new OrderSigner(effectiveChainId, getExchangeAddress());
  }, [chainId]);

  // Query for user's orders
  const {
    data: ordersData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.trading.userOrders(address),
    queryFn: async () => {
      if (!address) return { orders: [] };
      const response = await fetchApi<UserOrdersResponse>(`/api/orders/user/${address}`);
      return response;
    },
    enabled: !!address && isConnected,
    staleTime: 10_000, // 10 seconds
  });

  // Query for user's nonce
  const { data: balancesData } = useQuery({
    queryKey: queryKeys.trading.balances(address),
    queryFn: async () => {
      if (!address) return null;
      const response = await fetchApi<BalancesResponse>(`/api/balances/${address}`);
      return response;
    },
    enabled: !!address && isConnected,
    staleTime: 5_000, // 5 seconds
  });

  // Submit order mutation
  const submitMutation = useMutation({
    mutationFn: async (params: SubmitOrderParams): Promise<OrderResult> => {
      if (!address) {
        throw new ApiError('Wallet not connected', 'UNAUTHORIZED', 401);
      }

      // Get current nonce
      const nonce = balancesData?.nonce ? BigInt(balancesData.nonce) : 0n;

      // Calculate maker/taker amounts from price and quantity
      const { makerAmount, takerAmount } = calculateAmounts(
        params.side,
        params.price,
        params.quantity
      );

      // Create order params
      const orderParams: OrderParams = {
        marketId: params.marketId,
        tokenId: params.tokenId,
        side: params.side,
        makerAmount,
        takerAmount,
        expiration: params.expiration,
        feeRateBps: params.feeRateBps,
      };

      // Create unsigned order
      const unsignedOrder = orderSigner.createOrder(
        address,
        nonce,
        orderParams,
        SignatureType.EOA
      );

      // Get sign typed data params
      const signParams = orderSigner.getSignTypedDataParams(unsignedOrder);

      // Sign the order using wagmi
      const signature = await signTypedDataAsync({
        domain: signParams.domain,
        types: signParams.types,
        primaryType: signParams.primaryType,
        message: signParams.message,
      });

      // Create signed order
      const signedOrder = orderSigner.attachSignature(unsignedOrder, signature);

      // Serialize and submit to API
      const serialized = serializeOrder(signedOrder);
      const result = await mutateApi<OrderResult>(
        '/api/orders',
        'POST',
        serialized
      );

      return result;
    },
    onSuccess: () => {
      setSubmitError(null);
      // Invalidate orders and balances queries
      queryClient.invalidateQueries({ queryKey: queryKeys.trading.userOrders(address) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trading.balances(address) });
    },
    onError: (error: Error) => {
      setSubmitError(error);
    },
  });

  // Cancel order mutation
  const cancelMutation = useMutation({
    mutationFn: async (orderId: string): Promise<boolean> => {
      if (!address) {
        throw new ApiError('Wallet not connected', 'UNAUTHORIZED', 401);
      }

      await mutateApi<{ success: boolean }>(
        `/api/orders/${orderId}`,
        'DELETE',
        undefined,
        undefined,
        { signal: undefined }
      );

      return true;
    },
    onSuccess: () => {
      setCancelError(null);
      // Invalidate orders and balances queries
      queryClient.invalidateQueries({ queryKey: queryKeys.trading.userOrders(address) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trading.balances(address) });
    },
    onError: (error: Error) => {
      setCancelError(error);
    },
  });

  // Filter orders by market if specified
  const orders = useMemo(() => {
    const allOrders = ordersData?.orders || [];
    if (!marketId) return allOrders;
    return allOrders.filter((order) => order.marketId === marketId);
  }, [ordersData?.orders, marketId]);

  // Wrapped submit function
  const submitOrder = useCallback(
    async (params: SubmitOrderParams): Promise<OrderResult> => {
      return submitMutation.mutateAsync(params);
    },
    [submitMutation]
  );

  // Wrapped cancel function with header
  const cancelOrder = useCallback(
    async (orderId: string): Promise<boolean> => {
      if (!address) {
        throw new ApiError('Wallet not connected', 'UNAUTHORIZED', 401);
      }

      // Need to pass maker address in header
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: {
          'X-Maker-Address': address,
        },
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new ApiError(
          errorBody.error || 'Failed to cancel order',
          'UNKNOWN',
          response.status
        );
      }

      // Invalidate queries on success
      queryClient.invalidateQueries({ queryKey: queryKeys.trading.userOrders(address) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trading.balances(address) });

      return true;
    },
    [address, queryClient]
  );

  return useMemo(
    () => ({
      orders,
      isLoading,
      isError,
      error,
      submitOrder,
      cancelOrder,
      isSubmitting: submitMutation.isPending,
      isCancelling: cancelMutation.isPending,
      submitError,
      cancelError,
      refetch,
    }),
    [
      orders,
      isLoading,
      isError,
      error,
      submitOrder,
      cancelOrder,
      submitMutation.isPending,
      cancelMutation.isPending,
      submitError,
      cancelError,
      refetch,
    ]
  );
}
