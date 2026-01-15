/**
 * useMarketFactory Hook
 *
 * Provides market creation functionality and market list reading.
 * Subscribes to MarketCreated events for real-time updates.
 *
 * Requirements: 1.1, 1.4, 10.5
 */

import { useCallback, useState, useMemo } from 'react';
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useWatchContractEvent,
} from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import {
  marketFactoryAbi,
  erc20Abi,
  CONTRACT_ADDRESSES,
  MIN_INITIAL_LIQUIDITY,
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
 * Market creation parameters
 */
export interface CreateMarketParams {
  /** Market question text */
  question: string;
  /** Resolution criteria text */
  resolutionCriteria: string;
  /** Market end timestamp (Unix seconds) */
  endTime: number;
  /** Initial liquidity in USDC (raw units, 6 decimals) */
  initialLiquidity: bigint;
}

/**
 * Market info from factory
 */
export interface MarketInfo {
  /** Market contract address */
  address: `0x${string}`;
  /** Question ID */
  questionId: `0x${string}`;
}

/**
 * Market factory actions interface
 */
export interface MarketFactoryActions {
  /**
   * Create a new prediction market
   * Automatically handles USDC approval for initial liquidity
   *
   * @param params - Market creation parameters
   * @returns Transaction hash
   */
  createMarket: (params: CreateMarketParams) => Promise<`0x${string}`>;

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
 * Market list state
 */
export interface MarketListState {
  /** List of all market addresses */
  markets: `0x${string}`[];
  /** Total number of markets */
  marketCount: number;
  /** Whether data is loading */
  isLoading: boolean;
  /** Whether there was an error */
  isError: boolean;
  /** Error object if any */
  error: Error | null;
  /** Refetch market list */
  refetch: () => void;
}

/**
 * Combined return type for useMarketFactory
 */
export interface UseMarketFactoryReturn {
  /** Market creation actions */
  actions: MarketFactoryActions;
  /** Market list state */
  marketList: MarketListState;
}

/**
 * Get contract addresses for the current chain
 */
function getAddresses(chainId: number | undefined): {
  marketFactory: `0x${string}`;
  usdc: `0x${string}`;
} {
  const effectiveChainId = chainId && isSupportedChain(chainId) ? chainId : DEFAULT_CHAIN_ID;
  return {
    marketFactory: CONTRACT_ADDRESSES[effectiveChainId as SupportedChainId].marketFactory,
    usdc: CONTRACT_ADDRESSES[effectiveChainId as SupportedChainId].usdc,
  };
}

/**
 * Options for useMarketFactory hook
 */
export interface UseMarketFactoryOptions {
  /** Whether to enable real-time updates via event watching */
  watchEvents?: boolean;
}

/**
 * Hook for MarketFactory contract interactions
 *
 * @param options - Configuration options
 * @returns Market factory actions and market list state
 */
export function useMarketFactory(
  options: UseMarketFactoryOptions = {}
): UseMarketFactoryReturn {
  const { watchEvents = true } = options;

  const { address: userAddress, chainId } = useAccount();
  const addresses = getAddresses(chainId);
  const queryClient = useQueryClient();

  const [transactionState, setTransactionState] = useState<TransactionState>({ status: 'idle' });

  // Contract write hooks
  const { writeContractAsync: writeFactory } = useWriteContract();
  const { writeContractAsync: writeUsdc } = useWriteContract();

  // Transaction receipt hook
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>();
  const { data: receipt } = useWaitForTransactionReceipt({
    hash: currentTxHash,
  });

  // Read market count
  const {
    data: marketCount,
    isLoading: isCountLoading,
    isError: isCountError,
    error: countError,
    refetch: refetchCount,
  } = useReadContract({
    address: addresses.marketFactory,
    abi: marketFactoryAbi,
    functionName: 'marketCount',
    query: {
      staleTime: 30_000, // 30 seconds
    },
  });

  // Read all markets
  const {
    data: allMarkets,
    isLoading: isMarketsLoading,
    isError: isMarketsError,
    error: marketsError,
    refetch: refetchMarkets,
  } = useReadContract({
    address: addresses.marketFactory,
    abi: marketFactoryAbi,
    functionName: 'allMarkets',
    query: {
      staleTime: 30_000, // 30 seconds
    },
  });

  // Check USDC allowance for the factory contract
  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: addresses.usdc,
    abi: erc20Abi,
    functionName: 'allowance',
    args: userAddress ? [userAddress, addresses.marketFactory] : undefined,
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
          args: [addresses.marketFactory, amount],
        });

        setTransactionState({ status: 'pending_confirmation', hash });
        setCurrentTxHash(hash);

        // Wait for confirmation by monitoring receipt
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Approval failed');
        setTransactionState({ status: 'failed', error: err });
        throw err;
      }
    },
    [userAddress, usdcAllowance, writeUsdc, addresses]
  );

  /**
   * Validate market creation parameters
   */
  const validateParams = useCallback((params: CreateMarketParams): void => {
    if (!params.question || params.question.trim().length === 0) {
      throw new Error('Question cannot be empty');
    }

    if (!params.resolutionCriteria || params.resolutionCriteria.trim().length === 0) {
      throw new Error('Resolution criteria cannot be empty');
    }

    const now = Math.floor(Date.now() / 1000);
    if (params.endTime <= now) {
      throw new Error('End time must be in the future');
    }

    if (params.initialLiquidity < MIN_INITIAL_LIQUIDITY) {
      throw new Error(
        `Initial liquidity must be at least ${MIN_INITIAL_LIQUIDITY} USDC (in raw units)`
      );
    }
  }, []);

  /**
   * Create a new prediction market
   */
  const createMarket = useCallback(
    async (params: CreateMarketParams): Promise<`0x${string}`> => {
      if (!userAddress) {
        throw new Error('User address not available');
      }

      // Validate parameters
      validateParams(params);

      try {
        // Step 1: Approve USDC if needed
        await approveUsdc(params.initialLiquidity);
        await refetchAllowance();

        // Step 2: Create market
        setTransactionState({ status: 'pending_signature' });

        const hash = await writeFactory({
          address: addresses.marketFactory,
          abi: marketFactoryAbi,
          functionName: 'createMarket',
          args: [
            params.question,
            params.resolutionCriteria,
            BigInt(params.endTime),
            params.initialLiquidity,
          ],
        });

        setTransactionState({ status: 'pending_confirmation', hash });
        setCurrentTxHash(hash);

        // Invalidate relevant queries
        queryClient.invalidateQueries({
          queryKey: ['readContract', { address: addresses.marketFactory }],
        });
        queryClient.invalidateQueries({
          queryKey: ['readContract', { address: addresses.usdc }],
        });

        return hash;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Create market failed');
        setTransactionState({ status: 'failed', error: err });
        throw err;
      }
    },
    [
      userAddress,
      validateParams,
      approveUsdc,
      refetchAllowance,
      writeFactory,
      addresses,
      queryClient,
    ]
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

  // Watch MarketCreated events for real-time updates
  useWatchContractEvent({
    address: addresses.marketFactory,
    abi: marketFactoryAbi,
    eventName: 'MarketCreated',
    onLogs: () => {
      // Invalidate market list queries
      queryClient.invalidateQueries({
        queryKey: ['readContract', { address: addresses.marketFactory }],
      });
    },
    enabled: watchEvents,
  });

  const isLoading =
    transactionState.status === 'pending_signature' ||
    transactionState.status === 'pending_confirmation';

  // Refetch function for market list
  const refetch = useCallback(() => {
    refetchCount();
    refetchMarkets();
  }, [refetchCount, refetchMarkets]);

  // Combine market list state
  const marketList: MarketListState = useMemo(
    () => ({
      markets: (allMarkets as `0x${string}`[]) ?? [],
      marketCount: Number(marketCount ?? 0n),
      isLoading: isCountLoading || isMarketsLoading,
      isError: isCountError || isMarketsError,
      error: countError || marketsError || null,
      refetch,
    }),
    [
      allMarkets,
      marketCount,
      isCountLoading,
      isMarketsLoading,
      isCountError,
      isMarketsError,
      countError,
      marketsError,
      refetch,
    ]
  );

  // Combine actions
  const actions: MarketFactoryActions = useMemo(
    () => ({
      createMarket,
      transactionState,
      resetState,
      isLoading,
    }),
    [createMarket, transactionState, resetState, isLoading]
  );

  return useMemo(
    () => ({
      actions,
      marketList,
    }),
    [actions, marketList]
  );
}
