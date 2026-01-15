/**
 * useSSEMarket Hook
 *
 * Subscribes to real-time market price updates via SSE and syncs with TanStack Query cache.
 *
 * Requirements: 2.3, 2.5
 */

import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSSE } from '../useSSE';
import { queryKeys } from '../../api/queryKeys';
import type { MarketEventData, Debate, Round, Argument } from '@thesis/shared';

// Match the DebateDetailResponse structure from debateFullQueryOptions
interface DebateDetailResponse {
  debate: Debate;
  rounds: (Round & {
    supportArgument: Argument | null;
    opposeArgument: Argument | null;
  })[];
  debaters?: {
    support: unknown | null;
    oppose: unknown | null;
  };
  market?: {
    marketPrice: {
      supportPrice: number;
      opposePrice: number;
      totalVotes: number;
      mindChangeCount: number;
    };
    history: unknown[];
    spikes: unknown[];
  } | null;
  marketBlocked?: boolean;
}

/**
 * Hook for subscribing to real-time market price updates.
 * Updates the TanStack Query cache when market events are received.
 *
 * Fix: Now updates the debateFullQueryOptions cache (same as useSSERound/useSSEArguments)
 * instead of a separate market.byDebate cache key that the page doesn't use.
 *
 * @param debateId - The debate ID to subscribe to market updates for
 * @param token - Optional auth token (used for query key differentiation)
 * @returns Object with connection status and last update timestamp
 *
 * @example
 * ```tsx
 * const { isConnected, lastUpdate } = useSSEMarket(debateId, token);
 * ```
 */
export function useSSEMarket(debateId: string, token?: string) {
  const queryClient = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Track last values to avoid unnecessary updates
  const lastValuesRef = useRef<{
    supportPrice: number;
    opposePrice: number;
    totalVotes: number;
    mindChangeCount: number;
  } | null>(null);

  // Handle incoming market events
  const handleMarketEvent = useCallback((eventData: MarketEventData) => {
    // Fix: Use the same query key as debateFullQueryOptions (like useSSERound/useSSEArguments)
    const queryKey = [...queryKeys.debates.full(debateId), token ? 'auth' : 'anon'] as const;

    // Check if data has actually changed to avoid unnecessary updates (Requirement 9.4)
    const lastValues = lastValuesRef.current;
    if (lastValues &&
        lastValues.supportPrice === eventData.supportPrice &&
        lastValues.opposePrice === eventData.opposePrice &&
        lastValues.totalVotes === eventData.totalVotes &&
        lastValues.mindChangeCount === eventData.mindChangeCount) {
      return;
    }

    // Update the cache
    queryClient.setQueryData<DebateDetailResponse | null>(queryKey, (oldData) => {
      if (!oldData) return oldData;

      // Return unchanged if market doesn't exist
      if (!oldData.market) {
        // Create market structure if it doesn't exist
        return {
          ...oldData,
          market: {
            marketPrice: {
              supportPrice: eventData.supportPrice,
              opposePrice: eventData.opposePrice,
              totalVotes: eventData.totalVotes,
              mindChangeCount: eventData.mindChangeCount,
            },
            history: [],
            spikes: [],
          },
        };
      }

      // Preserve existing history and spikes, only update marketPrice (Requirement 9.3)
      return {
        ...oldData,
        market: {
          ...oldData.market,
          marketPrice: {
            supportPrice: eventData.supportPrice,
            opposePrice: eventData.opposePrice,
            totalVotes: eventData.totalVotes,
            mindChangeCount: eventData.mindChangeCount,
          },
        },
      };
    });

    // Update tracking refs
    lastValuesRef.current = {
      supportPrice: eventData.supportPrice,
      opposePrice: eventData.opposePrice,
      totalVotes: eventData.totalVotes,
      mindChangeCount: eventData.mindChangeCount,
    };
    setLastUpdate(new Date());
  }, [debateId, token, queryClient]);

  // Subscribe to market events
  const { isConnected, connectionStatus } = useSSE<MarketEventData>(
    'market',
    handleMarketEvent,
    [debateId, token]
  );

  return {
    isConnected,
    connectionStatus,
    lastUpdate,
  };
}
