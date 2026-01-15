/**
 * Market Query Options
 * 
 * TanStack Query options for market-related data fetching.
 */

import { queryOptions } from '@tanstack/react-query';
import { fetchApi, getAuthHeader } from '../client';
import { queryKeys } from '../queryKeys';
import { CACHE_STRATEGIES } from '../cache';
import type { MarketResponse } from '../types';

/**
 * Query options for fetching market data for a debate
 * Uses 'realtime' cache strategy for live market data
 * TanStack Query v5 Best Practice: Auth state included in query key
 */
export const marketQueryOptions = (debateId: string, token?: string) =>
  queryOptions({
    queryKey: [...queryKeys.market.byDebate(debateId), token ? 'auth' : 'anon'] as const,
    queryFn: async (): Promise<MarketResponse | null> => {
      if (!debateId) return null;
      try {
        return await fetchApi<MarketResponse>(`/api/debates/${debateId}/market`, {
          headers: getAuthHeader(token),
        });
      } catch {
        return null;
      }
    },
    ...CACHE_STRATEGIES.realtime,
    enabled: !!debateId,
  });
