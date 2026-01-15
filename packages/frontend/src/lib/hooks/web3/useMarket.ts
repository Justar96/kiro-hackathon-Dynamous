/**
 * useMarket Hook
 *
 * Provides market state reading from the Market contract.
 * Caches with TanStack Query and subscribes to StateChanged events.
 *
 * Requirements: 10.1, 10.4, 10.5
 */

import { useMemo } from 'react';
import { useReadContract, useWatchContractEvent } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { marketAbi } from '@thesis/shared';

/**
 * Market state enum values
 */
export type MarketState = 'ACTIVE' | 'PENDING_RESOLUTION' | 'DISPUTED' | 'RESOLVED';

/**
 * Market outcome enum values
 */
export type MarketOutcome = 'UNRESOLVED' | 'YES' | 'NO' | 'INVALID';

/**
 * Market state data from contract
 */
export interface MarketStateData {
  /** Unique question ID for oracle resolution */
  questionId: `0x${string}`;
  /** Human-readable question text */
  question: string;
  /** Resolution criteria text */
  resolutionCriteria: string;
  /** Market end timestamp (Unix seconds) */
  endTime: Date;
  /** Current market state */
  state: MarketState;
  /** Current outcome (UNRESOLVED until resolved) */
  outcome: MarketOutcome;
  /** YES token ID for this market */
  yesTokenId: bigint;
  /** NO token ID for this market */
  noTokenId: bigint;
  /** Resolution timestamp (0 if not resolved) */
  resolutionTime: Date | null;
  /** Dispute period end timestamp (0 if not in dispute) */
  disputeEndTime: Date | null;
}

/**
 * Options for useMarket hook
 */
export interface UseMarketOptions {
  /** Whether to enable real-time updates via event watching */
  watchEvents?: boolean;
  /** Custom stale time in milliseconds (default: 5 minutes for static data) */
  staleTime?: number;
}

/**
 * Return type for useMarket hook
 */
export interface UseMarketReturn {
  /** Market state data */
  data: MarketStateData | undefined;
  /** Whether data is loading */
  isLoading: boolean;
  /** Whether there was an error */
  isError: boolean;
  /** Error object if any */
  error: Error | null;
  /** Refetch market data */
  refetch: () => void;
}

/**
 * Convert contract state enum (0-3) to MarketState
 */
function parseMarketState(stateValue: number): MarketState {
  switch (stateValue) {
    case 0:
      return 'ACTIVE';
    case 1:
      return 'PENDING_RESOLUTION';
    case 2:
      return 'DISPUTED';
    case 3:
      return 'RESOLVED';
    default:
      return 'ACTIVE';
  }
}

/**
 * Convert contract outcome enum (0-3) to MarketOutcome
 */
function parseMarketOutcome(outcomeValue: number): MarketOutcome {
  switch (outcomeValue) {
    case 0:
      return 'UNRESOLVED';
    case 1:
      return 'YES';
    case 2:
      return 'NO';
    case 3:
      return 'INVALID';
    default:
      return 'UNRESOLVED';
  }
}

/**
 * Hook for reading market state from the Market contract
 *
 * @param marketAddress - Address of the Market contract
 * @param options - Configuration options
 * @returns Market state data and loading/error states
 */
export function useMarket(
  marketAddress: `0x${string}` | undefined,
  options: UseMarketOptions = {}
): UseMarketReturn {
  const { watchEvents = true, staleTime = 5 * 60 * 1000 } = options; // 5 minutes default

  const queryClient = useQueryClient();

  // Read all market data in a single multicall-style read
  const {
    data: _marketData,
    isLoading,
    isError,
    error,
    refetch,
  } = useReadContract({
    address: marketAddress,
    abi: marketAbi,
    functionName: 'questionId',
    query: {
      enabled: !!marketAddress,
      staleTime,
      // We'll use this as a trigger to fetch all data
      select: () => null, // We'll fetch all data separately
    },
  });

  // Read individual fields
  const { data: questionId } = useReadContract({
    address: marketAddress,
    abi: marketAbi,
    functionName: 'questionId',
    query: { enabled: !!marketAddress, staleTime },
  });

  const { data: question } = useReadContract({
    address: marketAddress,
    abi: marketAbi,
    functionName: 'question',
    query: { enabled: !!marketAddress, staleTime },
  });

  const { data: resolutionCriteria } = useReadContract({
    address: marketAddress,
    abi: marketAbi,
    functionName: 'resolutionCriteria',
    query: { enabled: !!marketAddress, staleTime },
  });

  const { data: endTime } = useReadContract({
    address: marketAddress,
    abi: marketAbi,
    functionName: 'endTime',
    query: { enabled: !!marketAddress, staleTime },
  });

  const { data: state } = useReadContract({
    address: marketAddress,
    abi: marketAbi,
    functionName: 'state',
    query: { enabled: !!marketAddress, staleTime: 30_000 }, // 30 seconds for dynamic data
  });

  const { data: outcome } = useReadContract({
    address: marketAddress,
    abi: marketAbi,
    functionName: 'outcome',
    query: { enabled: !!marketAddress, staleTime: 30_000 },
  });

  const { data: yesTokenId } = useReadContract({
    address: marketAddress,
    abi: marketAbi,
    functionName: 'yesTokenId',
    query: { enabled: !!marketAddress, staleTime },
  });

  const { data: noTokenId } = useReadContract({
    address: marketAddress,
    abi: marketAbi,
    functionName: 'noTokenId',
    query: { enabled: !!marketAddress, staleTime },
  });

  const { data: resolutionTime } = useReadContract({
    address: marketAddress,
    abi: marketAbi,
    functionName: 'resolutionTime',
    query: { enabled: !!marketAddress, staleTime: 30_000 },
  });

  const { data: disputeEndTime } = useReadContract({
    address: marketAddress,
    abi: marketAbi,
    functionName: 'disputeEndTime',
    query: { enabled: !!marketAddress, staleTime: 30_000 },
  });

  // Watch StateChanged events for real-time updates
  useWatchContractEvent({
    address: marketAddress,
    abi: marketAbi,
    eventName: 'StateChanged',
    onLogs: () => {
      // Invalidate queries to trigger refetch
      if (marketAddress) {
        queryClient.invalidateQueries({
          queryKey: ['readContract', { address: marketAddress }],
        });
      }
    },
    enabled: watchEvents && !!marketAddress,
  });

  // Watch MarketResolved events
  useWatchContractEvent({
    address: marketAddress,
    abi: marketAbi,
    eventName: 'MarketResolved',
    onLogs: () => {
      if (marketAddress) {
        queryClient.invalidateQueries({
          queryKey: ['readContract', { address: marketAddress }],
        });
      }
    },
    enabled: watchEvents && !!marketAddress,
  });

  // Watch ResolutionProposed events
  useWatchContractEvent({
    address: marketAddress,
    abi: marketAbi,
    eventName: 'ResolutionProposed',
    onLogs: () => {
      if (marketAddress) {
        queryClient.invalidateQueries({
          queryKey: ['readContract', { address: marketAddress }],
        });
      }
    },
    enabled: watchEvents && !!marketAddress,
  });

  // Watch ResolutionDisputed events
  useWatchContractEvent({
    address: marketAddress,
    abi: marketAbi,
    eventName: 'ResolutionDisputed',
    onLogs: () => {
      if (marketAddress) {
        queryClient.invalidateQueries({
          queryKey: ['readContract', { address: marketAddress }],
        });
      }
    },
    enabled: watchEvents && !!marketAddress,
  });

  // Combine all data into MarketStateData
  const data = useMemo((): MarketStateData | undefined => {
    if (
      !questionId ||
      !question ||
      !resolutionCriteria ||
      endTime === undefined ||
      state === undefined ||
      outcome === undefined ||
      yesTokenId === undefined ||
      noTokenId === undefined
    ) {
      return undefined;
    }

    return {
      questionId: questionId as `0x${string}`,
      question,
      resolutionCriteria,
      endTime: new Date(Number(endTime) * 1000),
      state: parseMarketState(state),
      outcome: parseMarketOutcome(outcome),
      yesTokenId,
      noTokenId,
      resolutionTime:
        resolutionTime && resolutionTime > 0n
          ? new Date(Number(resolutionTime) * 1000)
          : null,
      disputeEndTime:
        disputeEndTime && disputeEndTime > 0n
          ? new Date(Number(disputeEndTime) * 1000)
          : null,
    };
  }, [
    questionId,
    question,
    resolutionCriteria,
    endTime,
    state,
    outcome,
    yesTokenId,
    noTokenId,
    resolutionTime,
    disputeEndTime,
  ]);

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
