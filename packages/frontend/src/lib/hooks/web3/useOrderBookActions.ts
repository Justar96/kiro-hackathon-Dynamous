/**
 * useOrderBookActions Hook
 *
 * Provides write operations for OrderBook contract interactions.
 * Handles token/collateral approval flows, order placement, and cancellation.
 *
 * Requirements: 3.1, 3.2, 3.6, 10.2
 */

import { useCallback, useState, useMemo } from 'react';
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import {
  orderBookAbi,
  conditionalTokensAbi,
  erc20Abi,
  CONTRACT_ADDRESSES,
  type SupportedChainId,
  isSupportedChain,
} from '@thesis/shared';
import { DEFAULT_CHAIN_ID } from '../../wagmi';
import type { TransactionReceipt } from 'viem';

/**
 * Transaction state for tracking operation progress
 */
export type TransactionState =
  | { status: 'idle' }
  | { status: 'pending_signature' }
  | { status: 'pending_confirmation'; hash: `0x${string}` }
  | { status: 'confirmed'; hash: `0x${string}`; receipt: TransactionReceipt }
  | { status: 'failed'; error: Error };

/**
 * Order side enum (0 = BUY, 1 = SELL in contract)
 */
export enum OrderSide {
  BUY = 0,
  SELL = 1,
}

/**
 * Order book actions interface
 */
export interface OrderBookActions {
  /**
   * Place a buy order for outcome tokens
   * Automatically handles USDC approval if needed
   *
   * @param marketId - Market ID (questionId)
   * @param tokenId - Token ID (YES or NO token)
   * @param price - Price in basis points (100-9900 = $0.01-$0.99)
   * @param quantity - Quantity of tokens to buy
   * @returns Transaction hash
   */
  placeBuyOrder: (
    marketId: `0x${string}`,
    tokenId: bigint,
    price: bigint,
    quantity: bigint
  ) => Promise<`0x${string}`>;

  /**
   * Place a sell order for outcome tokens
   * Automatically handles token approval if needed
   *
   * @param marketId - Market ID (questionId)
   * @param tokenId - Token ID (YES or NO token)
   * @param price - Price in basis points (100-9900 = $0.01-$0.99)
   * @param quantity - Quantity of tokens to sell
   * @returns Transaction hash
   */
  placeSellOrder: (
    marketId: `0x${string}`,
    tokenId: bigint,
    price: bigint,
    quantity: bigint
  ) => Promise<`0x${string}`>;

  /**
   * Cancel an existing order
   *
   * @param orderId - Order ID to cancel
   * @returns Transaction hash
   */
  cancelOrder: (orderId: bigint) => Promise<`0x${string}`>;

  /**
   * Current transaction state
   */
  transactionState: TransactionState;

  /**
   * Reset transaction state to idle
   */
  resetState: () => void;

  /**
   * Whether any operation is in progress
   */
  isLoading: boolean;
}

/**
 * Get contract addresses for the current chain
 */
function getAddresses(chainId: number | undefined): {
  orderBook: `0x${string}`;
  conditionalTokens: `0x${string}`;
  usdc: `0x${string}`;
} {
  const effectiveChainId = chainId && isSupportedChain(chainId) ? chainId : DEFAULT_CHAIN_ID;
  return {
    orderBook: CONTRACT_ADDRESSES[effectiveChainId as SupportedChainId].orderBook,
    conditionalTokens: CONTRACT_ADDRESSES[effectiveChainId as SupportedChainId].conditionalTokens,
    usdc: CONTRACT_ADDRESSES[effectiveChainId as SupportedChainId].usdc,
  };
}

/**
 * Hook for OrderBook contract write operations
 *
 * @returns Order book action functions and transaction state
 */
export function useOrderBookActions(): OrderBookActions {
  const { address: userAddress, chainId } = useAccount();
  const addresses = getAddresses(chainId);
  const queryClient = useQueryClient();

  const [transactionState, setTransactionState] = useState<TransactionState>({ status: 'idle' });

  // Contract write hooks
  const { writeContractAsync: writeOrderBook } = useWriteContract();
  const { writeContractAsync: writeUsdc } = useWriteContract();
  const { writeContractAsync: writeConditionalTokens } = useWriteContract();

  // Transaction receipt hook
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>();
  const { data: receipt } = useWaitForTransactionReceipt({
    hash: currentTxHash,
  });

  /**
   * Check USDC allowance for the order book contract
   */
  const { data: usdcAllowance, refetch: refetchUsdcAllowance } = useReadContract({
    address: addresses.usdc,
    abi: erc20Abi,
    functionName: 'allowance',
    args: userAddress ? [userAddress, addresses.orderBook] : undefined,
    query: {
      enabled: !!userAddress,
    },
  });

  /**
   * Check token approval for the order book contract
   */
  const { data: isTokenApproved, refetch: refetchTokenApproval } = useReadContract({
    address: addresses.conditionalTokens,
    abi: conditionalTokensAbi,
    functionName: 'isApprovedForAll',
    args: userAddress ? [userAddress, addresses.orderBook] : undefined,
    query: {
      enabled: !!userAddress,
    },
  });

  /**
   * Approve USDC spending if needed
   */
  const approveUsdc = useCallback(
    async (amount: bigint): Promise<void> => {
      if (!userAddress) {
        throw new Error('User address not available');
      }

      // Check if approval is needed
      const currentAllowance = usdcAllowance ?? 0n;
      if (currentAllowance >= amount) {
        return; // Already approved
      }

      setTransactionState({ status: 'pending_signature' });

      try {
        const hash = await writeUsdc({
          address: addresses.usdc,
          abi: erc20Abi,
          functionName: 'approve',
          args: [addresses.orderBook, amount],
        });

        setTransactionState({ status: 'pending_confirmation', hash });
        setCurrentTxHash(hash);

        // Wait for confirmation
      } catch (error) {
        const err = error instanceof Error ? error : new Error('USDC approval failed');
        setTransactionState({ status: 'failed', error: err });
        throw err;
      }
    },
    [userAddress, usdcAllowance, writeUsdc, addresses]
  );

  /**
   * Approve token transfers if needed
   */
  const approveTokens = useCallback(async (): Promise<void> => {
    if (!userAddress) {
      throw new Error('User address not available');
    }

    // Check if approval is needed
    if (isTokenApproved) {
      return; // Already approved
    }

    setTransactionState({ status: 'pending_signature' });

    try {
      const hash = await writeConditionalTokens({
        address: addresses.conditionalTokens,
        abi: conditionalTokensAbi,
        functionName: 'setApprovalForAll',
        args: [addresses.orderBook, true],
      });

      setTransactionState({ status: 'pending_confirmation', hash });
      setCurrentTxHash(hash);

      // Wait for confirmation
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Token approval failed');
      setTransactionState({ status: 'failed', error: err });
      throw err;
    }
  }, [userAddress, isTokenApproved, writeConditionalTokens, addresses]);

  /**
   * Place a buy order
   */
  const placeBuyOrder = useCallback(
    async (
      marketId: `0x${string}`,
      tokenId: bigint,
      price: bigint,
      quantity: bigint
    ): Promise<`0x${string}`> => {
      if (!userAddress) {
        throw new Error('User address not available');
      }

      if (price < 100n || price > 9900n) {
        throw new Error('Price must be between 100 and 9900 basis points ($0.01-$0.99)');
      }

      if (quantity <= 0n) {
        throw new Error('Quantity must be greater than 0');
      }

      try {
        // Calculate required collateral: (price * quantity) / 10000
        const requiredCollateral = (price * quantity) / 10000n;

        // Step 1: Approve USDC if needed
        await approveUsdc(requiredCollateral);
        await refetchUsdcAllowance();

        // Step 2: Place buy order
        setTransactionState({ status: 'pending_signature' });

        const hash = await writeOrderBook({
          address: addresses.orderBook,
          abi: orderBookAbi,
          functionName: 'placeOrder',
          args: [marketId, tokenId, OrderSide.BUY, price, quantity],
        });

        setTransactionState({ status: 'pending_confirmation', hash });
        setCurrentTxHash(hash);

        // Invalidate relevant queries
        queryClient.invalidateQueries({
          queryKey: ['readContract', { address: addresses.orderBook }],
        });
        queryClient.invalidateQueries({
          queryKey: ['readContract', { address: addresses.usdc }],
        });

        return hash;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Place buy order failed');
        setTransactionState({ status: 'failed', error: err });
        throw err;
      }
    },
    [
      userAddress,
      approveUsdc,
      refetchUsdcAllowance,
      writeOrderBook,
      addresses,
      queryClient,
    ]
  );

  /**
   * Place a sell order
   */
  const placeSellOrder = useCallback(
    async (
      marketId: `0x${string}`,
      tokenId: bigint,
      price: bigint,
      quantity: bigint
    ): Promise<`0x${string}`> => {
      if (!userAddress) {
        throw new Error('User address not available');
      }

      if (price < 100n || price > 9900n) {
        throw new Error('Price must be between 100 and 9900 basis points ($0.01-$0.99)');
      }

      if (quantity <= 0n) {
        throw new Error('Quantity must be greater than 0');
      }

      try {
        // Step 1: Approve tokens if needed
        await approveTokens();
        await refetchTokenApproval();

        // Step 2: Place sell order
        setTransactionState({ status: 'pending_signature' });

        const hash = await writeOrderBook({
          address: addresses.orderBook,
          abi: orderBookAbi,
          functionName: 'placeOrder',
          args: [marketId, tokenId, OrderSide.SELL, price, quantity],
        });

        setTransactionState({ status: 'pending_confirmation', hash });
        setCurrentTxHash(hash);

        // Invalidate relevant queries
        queryClient.invalidateQueries({
          queryKey: ['readContract', { address: addresses.orderBook }],
        });
        queryClient.invalidateQueries({
          queryKey: ['readContract', { address: addresses.conditionalTokens }],
        });

        return hash;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Place sell order failed');
        setTransactionState({ status: 'failed', error: err });
        throw err;
      }
    },
    [
      userAddress,
      approveTokens,
      refetchTokenApproval,
      writeOrderBook,
      addresses,
      queryClient,
    ]
  );

  /**
   * Cancel an order
   */
  const cancelOrder = useCallback(
    async (orderId: bigint): Promise<`0x${string}`> => {
      if (!userAddress) {
        throw new Error('User address not available');
      }

      if (orderId < 0n) {
        throw new Error('Invalid order ID');
      }

      try {
        setTransactionState({ status: 'pending_signature' });

        const hash = await writeOrderBook({
          address: addresses.orderBook,
          abi: orderBookAbi,
          functionName: 'cancelOrder',
          args: [orderId],
        });

        setTransactionState({ status: 'pending_confirmation', hash });
        setCurrentTxHash(hash);

        // Invalidate relevant queries
        queryClient.invalidateQueries({
          queryKey: ['readContract', { address: addresses.orderBook }],
        });
        queryClient.invalidateQueries({
          queryKey: ['readContract', { address: addresses.usdc }],
        });
        queryClient.invalidateQueries({
          queryKey: ['readContract', { address: addresses.conditionalTokens }],
        });

        return hash;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Cancel order failed');
        setTransactionState({ status: 'failed', error: err });
        throw err;
      }
    },
    [userAddress, writeOrderBook, addresses, queryClient]
  );

  /**
   * Reset transaction state
   */
  const resetState = useCallback(() => {
    setTransactionState({ status: 'idle' });
    setCurrentTxHash(undefined);
  }, []);

  // Update state when receipt is received
  useMemo(() => {
    if (receipt && transactionState.status === 'pending_confirmation') {
      setTransactionState({
        status: 'confirmed',
        hash: receipt.transactionHash,
        receipt,
      });
    }
  }, [receipt, transactionState.status]);

  const isLoading =
    transactionState.status === 'pending_signature' ||
    transactionState.status === 'pending_confirmation';

  return useMemo(
    () => ({
      placeBuyOrder,
      placeSellOrder,
      cancelOrder,
      transactionState,
      resetState,
      isLoading,
    }),
    [placeBuyOrder, placeSellOrder, cancelOrder, transactionState, resetState, isLoading]
  );
}
