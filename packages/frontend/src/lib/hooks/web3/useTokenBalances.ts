/**
 * useTokenBalances Hook
 *
 * Provides real-time token balance tracking for USDC and outcome tokens.
 * Subscribes to Transfer events for automatic balance updates.
 *
 * Requirements: 6.5
 */

import { useMemo } from 'react';
import { useAccount, useReadContract, useReadContracts, useWatchContractEvent } from 'wagmi';
import {
  erc20Abi,
  conditionalTokensAbi,
  CONTRACT_ADDRESSES,
  type SupportedChainId,
  isSupportedChain,
  fromUsdcUnits,
} from '@thesis/shared';
import { DEFAULT_CHAIN_ID } from '../../wagmi';

/**
 * Token balances state
 */
export interface TokenBalancesState {
  /** USDC balance in raw units (6 decimals) */
  usdcBalance: bigint;
  /** USDC balance formatted as number */
  usdcBalanceFormatted: number;
  /** YES token balance for a specific market */
  yesBalance: bigint;
  /** NO token balance for a specific market */
  noBalance: bigint;
  /** Whether balances are loading */
  isLoading: boolean;
  /** Whether there was an error fetching balances */
  isError: boolean;
  /** Error message if any */
  error: Error | null;
  /** Refetch all balances */
  refetch: () => void;
}

/**
 * Options for useTokenBalances hook
 */
export interface UseTokenBalancesOptions {
  /** YES token ID from the market contract */
  yesTokenId?: bigint;
  /** NO token ID from the market contract */
  noTokenId?: bigint;
  /** Whether to enable real-time updates via event watching */
  watchEvents?: boolean;
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
 * Hook for tracking USDC and outcome token balances
 */
export function useTokenBalances(options: UseTokenBalancesOptions = {}): TokenBalancesState {
  const { yesTokenId, noTokenId, watchEvents = true } = options;

  const { address, chainId } = useAccount();
  const addresses = getAddresses(chainId);

  // Read USDC balance
  const {
    data: usdcBalanceData,
    isLoading: isUsdcLoading,
    isError: isUsdcError,
    error: usdcError,
    refetch: refetchUsdc,
  } = useReadContract({
    address: addresses.usdc,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      staleTime: 30_000, // 30 seconds
    },
  });

  // Read outcome token balances (YES and NO)
  const hasTokenIds = yesTokenId !== undefined && noTokenId !== undefined;

  const {
    data: outcomeBalances,
    isLoading: isOutcomeLoading,
    isError: isOutcomeError,
    error: outcomeError,
    refetch: refetchOutcome,
  } = useReadContracts({
    contracts: hasTokenIds && address
      ? [
          {
            address: addresses.conditionalTokens,
            abi: conditionalTokensAbi,
            functionName: 'balanceOf',
            args: [address, yesTokenId],
          },
          {
            address: addresses.conditionalTokens,
            abi: conditionalTokensAbi,
            functionName: 'balanceOf',
            args: [address, noTokenId],
          },
        ]
      : [],
    query: {
      enabled: hasTokenIds && !!address,
      staleTime: 30_000, // 30 seconds
    },
  });

  // Watch USDC Transfer events for real-time updates
  useWatchContractEvent({
    address: addresses.usdc,
    abi: erc20Abi,
    eventName: 'Transfer',
    onLogs: (logs) => {
      // Check if any transfer involves the current user
      const userInvolved = logs.some(
        (log) =>
          log.args.from?.toLowerCase() === address?.toLowerCase() ||
          log.args.to?.toLowerCase() === address?.toLowerCase()
      );
      if (userInvolved) {
        refetchUsdc();
      }
    },
    enabled: watchEvents && !!address,
  });

  // Watch ERC-1155 TransferSingle events for outcome tokens
  useWatchContractEvent({
    address: addresses.conditionalTokens,
    abi: conditionalTokensAbi,
    eventName: 'TransferSingle',
    onLogs: (logs) => {
      // Check if any transfer involves the current user and our token IDs
      const userInvolved = logs.some((log) => {
        const isUserTransfer =
          log.args.from?.toLowerCase() === address?.toLowerCase() ||
          log.args.to?.toLowerCase() === address?.toLowerCase();
        const isRelevantToken =
          log.args.id === yesTokenId || log.args.id === noTokenId;
        return isUserTransfer && isRelevantToken;
      });
      if (userInvolved) {
        refetchOutcome();
      }
    },
    enabled: watchEvents && hasTokenIds && !!address,
  });

  // Watch ERC-1155 TransferBatch events for outcome tokens
  useWatchContractEvent({
    address: addresses.conditionalTokens,
    abi: conditionalTokensAbi,
    eventName: 'TransferBatch',
    onLogs: (logs) => {
      // Check if any batch transfer involves the current user
      const userInvolved = logs.some(
        (log) =>
          log.args.from?.toLowerCase() === address?.toLowerCase() ||
          log.args.to?.toLowerCase() === address?.toLowerCase()
      );
      if (userInvolved) {
        refetchOutcome();
      }
    },
    enabled: watchEvents && hasTokenIds && !!address,
  });

  // Extract balances from results
  const usdcBalance = usdcBalanceData ?? 0n;
  const yesBalance = outcomeBalances?.[0]?.result ?? 0n;
  const noBalance = outcomeBalances?.[1]?.result ?? 0n;

  // Combined loading and error states
  const isLoading = isUsdcLoading || (hasTokenIds && isOutcomeLoading);
  const isError = isUsdcError || isOutcomeError;
  const error = usdcError || outcomeError || null;

  // Refetch function
  const refetch = () => {
    refetchUsdc();
    if (hasTokenIds) {
      refetchOutcome();
    }
  };

  return useMemo(
    () => ({
      usdcBalance,
      usdcBalanceFormatted: fromUsdcUnits(usdcBalance),
      yesBalance,
      noBalance,
      isLoading,
      isError,
      error,
      refetch,
    }),
    [usdcBalance, yesBalance, noBalance, isLoading, isError, error, refetch]
  );
}
