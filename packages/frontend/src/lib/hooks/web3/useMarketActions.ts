/**
 * useMarketActions Hook
 *
 * Provides write operations for Market contract interactions.
 * Handles USDC approval flows, token minting/redemption, and settlement.
 *
 * Requirements: 10.2, 10.3, 6.4, 6.6
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
  marketAbi,
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
 * Market actions interface
 */
export interface MarketActions {
  /**
   * Mint outcome tokens by depositing USDC collateral
   * Automatically handles USDC approval if needed
   *
   * @param amount - Amount of USDC to deposit (in raw units, 6 decimals)
   * @returns Transaction hash
   */
  mintTokens: (amount: bigint) => Promise<`0x${string}`>;

  /**
   * Redeem equal amounts of YES and NO tokens back to USDC
   *
   * @param amount - Amount of token pairs to redeem
   * @returns Transaction hash
   */
  redeemTokens: (amount: bigint) => Promise<`0x${string}`>;

  /**
   * Redeem winning tokens after market resolution
   *
   * @returns Transaction hash
   */
  redeemWinnings: () => Promise<`0x${string}`>;

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
  usdc: `0x${string}`;
  conditionalTokens: `0x${string}`;
} {
  const effectiveChainId = chainId && isSupportedChain(chainId) ? chainId : DEFAULT_CHAIN_ID;
  return CONTRACT_ADDRESSES[effectiveChainId as SupportedChainId];
}

/**
 * Hook for Market contract write operations
 *
 * @param marketAddress - Address of the Market contract
 * @returns Market action functions and transaction state
 */
export function useMarketActions(marketAddress: `0x${string}` | undefined): MarketActions {
  const { address: userAddress, chainId } = useAccount();
  const addresses = getAddresses(chainId);
  const queryClient = useQueryClient();

  const [transactionState, setTransactionState] = useState<TransactionState>({ status: 'idle' });

  // Contract write hooks
  const { writeContractAsync: writeMarket } = useWriteContract();
  const { writeContractAsync: writeUsdc } = useWriteContract();

  // Transaction receipt hook
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>();
  const { data: receipt } = useWaitForTransactionReceipt({
    hash: currentTxHash,
  });

  /**
   * Check USDC allowance for the market contract
   */
  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: addresses.usdc,
    abi: erc20Abi,
    functionName: 'allowance',
    args: userAddress && marketAddress ? [userAddress, marketAddress] : undefined,
    query: {
      enabled: !!userAddress && !!marketAddress,
    },
  });

  /**
   * Approve USDC spending if needed
   */
  const approveUsdc = useCallback(
    async (amount: bigint): Promise<void> => {
      if (!marketAddress || !userAddress) {
        throw new Error('Market address or user address not available');
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
          args: [marketAddress, amount],
        });

        setTransactionState({ status: 'pending_confirmation', hash });
        setCurrentTxHash(hash);

        // Wait for confirmation
        // The receipt will be picked up by useWaitForTransactionReceipt
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Approval failed');
        setTransactionState({ status: 'failed', error: err });
        throw err;
      }
    },
    [marketAddress, userAddress, usdcAllowance, writeUsdc, addresses.usdc]
  );

  /**
   * Mint outcome tokens by depositing USDC
   */
  const mintTokens = useCallback(
    async (amount: bigint): Promise<`0x${string}`> => {
      if (!marketAddress || !userAddress) {
        throw new Error('Market address or user address not available');
      }

      if (amount <= 0n) {
        throw new Error('Amount must be greater than 0');
      }

      try {
        // Step 1: Approve USDC if needed
        await approveUsdc(amount);
        await refetchAllowance();

        // Step 2: Mint tokens
        setTransactionState({ status: 'pending_signature' });

        const hash = await writeMarket({
          address: marketAddress,
          abi: marketAbi,
          functionName: 'mintTokens',
          args: [amount],
        });

        setTransactionState({ status: 'pending_confirmation', hash });
        setCurrentTxHash(hash);

        // Invalidate relevant queries
        queryClient.invalidateQueries({
          queryKey: ['readContract', { address: marketAddress }],
        });
        queryClient.invalidateQueries({
          queryKey: ['readContract', { address: addresses.usdc }],
        });
        queryClient.invalidateQueries({
          queryKey: ['readContract', { address: addresses.conditionalTokens }],
        });

        return hash;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Mint tokens failed');
        setTransactionState({ status: 'failed', error: err });
        throw err;
      }
    },
    [
      marketAddress,
      userAddress,
      approveUsdc,
      refetchAllowance,
      writeMarket,
      queryClient,
      addresses,
    ]
  );

  /**
   * Redeem equal YES and NO tokens back to USDC
   */
  const redeemTokens = useCallback(
    async (amount: bigint): Promise<`0x${string}`> => {
      if (!marketAddress || !userAddress) {
        throw new Error('Market address or user address not available');
      }

      if (amount <= 0n) {
        throw new Error('Amount must be greater than 0');
      }

      try {
        setTransactionState({ status: 'pending_signature' });

        const hash = await writeMarket({
          address: marketAddress,
          abi: marketAbi,
          functionName: 'redeemTokens',
          args: [amount],
        });

        setTransactionState({ status: 'pending_confirmation', hash });
        setCurrentTxHash(hash);

        // Invalidate relevant queries
        queryClient.invalidateQueries({
          queryKey: ['readContract', { address: marketAddress }],
        });
        queryClient.invalidateQueries({
          queryKey: ['readContract', { address: addresses.usdc }],
        });
        queryClient.invalidateQueries({
          queryKey: ['readContract', { address: addresses.conditionalTokens }],
        });

        return hash;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Redeem tokens failed');
        setTransactionState({ status: 'failed', error: err });
        throw err;
      }
    },
    [marketAddress, userAddress, writeMarket, queryClient, addresses]
  );

  /**
   * Redeem winning tokens after market resolution
   */
  const redeemWinnings = useCallback(async (): Promise<`0x${string}`> => {
    if (!marketAddress || !userAddress) {
      throw new Error('Market address or user address not available');
    }

    try {
      setTransactionState({ status: 'pending_signature' });

      const hash = await writeMarket({
        address: marketAddress,
        abi: marketAbi,
        functionName: 'redeemWinnings',
      });

      setTransactionState({ status: 'pending_confirmation', hash });
      setCurrentTxHash(hash);

      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ['readContract', { address: marketAddress }],
      });
      queryClient.invalidateQueries({
        queryKey: ['readContract', { address: addresses.usdc }],
      });
      queryClient.invalidateQueries({
        queryKey: ['readContract', { address: addresses.conditionalTokens }],
      });

      return hash;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Redeem winnings failed');
      setTransactionState({ status: 'failed', error: err });
      throw err;
    }
  }, [marketAddress, userAddress, writeMarket, queryClient, addresses]);

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
      mintTokens,
      redeemTokens,
      redeemWinnings,
      transactionState,
      resetState,
      isLoading,
    }),
    [mintTokens, redeemTokens, redeemWinnings, transactionState, resetState, isLoading]
  );
}
