/**
 * useSSEMarket Hook
 * 
 * Subscribes to real-time market price updates via SSE and syncs with TanStack Query cache.
 * 
 * Requirements: 2.3, 2.5
 */

import { useSSEQuerySync } from '../useSSEQuerySync';
import { queryKeys } from '../../api/queryKeys';
import type { MarketEventData } from '@debate-platform/shared';

interface MarketCacheData {
  marketPrice: {
    supportPrice: number;
    opposePrice: number;
    totalVotes: number;
    mindChangeCount: number;
  };
  history?: Array<{ timestamp: Date; supportPrice: number; voteCount: number }>;
  spikes?: Array<{ timestamp: Date; argumentId: string; deltaAmount: number; direction: 'support' | 'oppose'; label: string }>;
}

/**
 * Hook for subscribing to real-time market price updates.
 * Updates the TanStack Query cache when market events are received.
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
  // Use the auth-aware query key to match the marketQueryOptions
  const queryKey = [...queryKeys.market.byDebate(debateId), token ? 'auth' : 'anon'] as const;

  const result = useSSEQuerySync<MarketCacheData, MarketEventData>({
    eventType: 'market',
    queryKey,
    updateFn: (oldData, eventData) => {
      // Preserve existing history and spikes, only update marketPrice (Requirement 9.3)
      return {
        ...oldData,
        marketPrice: {
          supportPrice: eventData.supportPrice,
          opposePrice: eventData.opposePrice,
          totalVotes: eventData.totalVotes,
          mindChangeCount: eventData.mindChangeCount,
        },
      } as MarketCacheData;
    },
    // Only update if data has actually changed (Requirement 9.4)
    shouldUpdate: (eventData, currentData) => {
      if (!currentData?.marketPrice) return true;
      
      const current = currentData.marketPrice;
      return (
        current.supportPrice !== eventData.supportPrice ||
        current.opposePrice !== eventData.opposePrice ||
        current.totalVotes !== eventData.totalVotes ||
        current.mindChangeCount !== eventData.mindChangeCount
      );
    },
  });

  return {
    isConnected: result.isConnected,
    connectionStatus: result.connectionStatus,
    lastUpdate: result.lastUpdate,
  };
}
