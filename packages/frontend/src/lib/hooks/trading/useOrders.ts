/**
 * useOrders Hook
 *
 * Hook for order management including submission, cancellation, and status tracking.
 * Integrates with the OrderSigner for EIP-712 signing and the backend API.
 *
 * Requirements: 2.1, 2.2, 3.1, 3.6, 7.1
 */

import { useState, useCallback, useMemo, useRef } from 'react';
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

/** Maximum retry attempts for transient failures */
const MAX_RETRY_ATTEMPTS = 3;

/** Base delay for exponential backoff (ms) */
const RETRY_BASE_DELAY = 1000;

/** Jitter factor for retry delays (0-1) */
const RETRY_JITTER = 0.2;

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

/**
 * Calculate delay for retry with exponential backoff and jitter
 */
function calculateRetryDelay(attempt: number): number {
  const exponentialDelay = RETRY_BASE_DELAY * Math.pow(2, attempt);
  const jitter = exponentialDelay * RETRY_JITTER * (Math.random() * 2 - 1);
  return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
}

/**
 * Check if an error is retryable (transient failure)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.isRetryable;
  }
  // Network errors are retryable
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('fetch') ||
      message.includes('connection')
    );
  }
  return false;
}

/**
 * Execute a function with retry logic for transient failures
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = MAX_RETRY_ATTEMPTS,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry non-retryable errors
      if (!isRetryableError(error)) {
        throw error;
      }
      
      // Don't retry on last attempt
      if (attempt === maxAttempts - 1) {
        throw error;
      }
      
      // Notify about retry
      onRetry?.(attempt + 1, lastError);
      
      // Wait before retrying
      const delay = calculateRetryDelay(attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Retry failed');
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
  
  // Track retry attempts for logging
  const retryCountRef = useRef(0);

  // Create order signer
  const orderSigner = useMemo(() => {
    const effectiveChainId = chainId || DEFAULT_CHAIN_ID;
    return new OrderSigner(effectiveChainId, getExchangeAddress());
  }, [chainId]);

  // Query for user's orders with retry logic
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
      return withRetry(
        () => fetchApi<UserOrdersResponse>(`/api/orders/user/${address}`),
        MAX_RETRY_ATTEMPTS,
        (attempt) => {
          console.warn(`[useOrders] Retrying orders fetch, attempt ${attempt}`);
        }
      );
    },
    enabled: !!address && isConnected,
    staleTime: 10_000, // 10 seconds
    retry: (failureCount, error) => {
      // Let TanStack Query handle retries for retryable errors
      if (isRetryableError(error)) {
        return failureCount < MAX_RETRY_ATTEMPTS;
      }
      return false;
    },
    retryDelay: (attemptIndex) => calculateRetryDelay(attemptIndex),
  });

  // Query for user's nonce with retry logic
  const { data: balancesData } = useQuery({
    queryKey: queryKeys.trading.balances(address),
    queryFn: async () => {
      if (!address) return null;
      return withRetry(
        () => fetchApi<BalancesResponse>(`/api/balances/${address}`),
        MAX_RETRY_ATTEMPTS
      );
    },
    enabled: !!address && isConnected,
    staleTime: 5_000, // 5 seconds
    retry: (failureCount, error) => {
      if (isRetryableError(error)) {
        return failureCount < MAX_RETRY_ATTEMPTS;
      }
      return false;
    },
    retryDelay: (attemptIndex) => calculateRetryDelay(attemptIndex),
  });

  // Submit order mutation with retry logic for transient failures
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

      // Sign the order using wagmi (not retryable - user interaction)
      const signature = await signTypedDataAsync({
        domain: signParams.domain,
        types: signParams.types,
        primaryType: signParams.primaryType,
        message: signParams.message,
      });

      // Create signed order
      const signedOrder = orderSigner.attachSignature(unsignedOrder, signature);

      // Serialize and submit to API with retry logic
      const serialized = serializeOrder(signedOrder);
      
      return withRetry(
        () => mutateApi<OrderResult>('/api/orders', 'POST', serialized),
        MAX_RETRY_ATTEMPTS,
        (attempt, error) => {
          console.warn(`[useOrders] Retrying order submission, attempt ${attempt}:`, error.message);
          retryCountRef.current = attempt;
        }
      );
    },
    onSuccess: () => {
      setSubmitError(null);
      retryCountRef.current = 0;
      // Invalidate orders and balances queries
      queryClient.invalidateQueries({ queryKey: queryKeys.trading.userOrders(address) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trading.balances(address) });
    },
    onError: (error: Error) => {
      setSubmitError(error);
      retryCountRef.current = 0;
      
      // Log detailed error for debugging
      if (error instanceof ApiError) {
        console.error('[useOrders] Order submission failed:', {
          code: error.code,
          status: error.status,
          message: error.message,
          details: error.details,
        });
      }
    },
  });

  // Cancel order mutation with retry logic
  const cancelMutation = useMutation({
    mutationFn: async (orderId: string): Promise<boolean> => {
      if (!address) {
        throw new ApiError('Wallet not connected', 'UNAUTHORIZED', 401);
      }

      await withRetry(
        () => mutateApi<{ success: boolean }>(
          `/api/orders/${orderId}`,
          'DELETE',
          undefined,
          undefined,
          { signal: undefined }
        ),
        MAX_RETRY_ATTEMPTS,
        (attempt, error) => {
          console.warn(`[useOrders] Retrying order cancellation, attempt ${attempt}:`, error.message);
        }
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
      
      // Log detailed error for debugging
      if (error instanceof ApiError) {
        console.error('[useOrders] Order cancellation failed:', {
          code: error.code,
          status: error.status,
          message: error.message,
        });
      }
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

  // Wrapped cancel function with header and retry logic
  const cancelOrder = useCallback(
    async (orderId: string): Promise<boolean> => {
      if (!address) {
        throw new ApiError('Wallet not connected', 'UNAUTHORIZED', 401);
      }

      const performCancel = async (): Promise<boolean> => {
        const response = await fetch(`/api/orders/${orderId}`, {
          method: 'DELETE',
          headers: {
            'X-Maker-Address': address,
          },
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const error = new ApiError(
            errorBody.error || 'Failed to cancel order',
            response.status >= 500 ? 'SERVER_ERROR' : 'UNKNOWN',
            response.status
          );
          throw error;
        }

        return true;
      };

      const result = await withRetry(
        performCancel,
        MAX_RETRY_ATTEMPTS,
        (attempt, error) => {
          console.warn(`[useOrders] Retrying order cancellation via fetch, attempt ${attempt}:`, error.message);
        }
      );

      // Invalidate queries on success
      queryClient.invalidateQueries({ queryKey: queryKeys.trading.userOrders(address) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trading.balances(address) });

      return result;
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
