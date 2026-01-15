/**
 * Stance Query Options
 * 
 * TanStack Query options for stance-related data fetching.
 */

import { queryOptions } from '@tanstack/react-query';
import { fetchApi, getAuthHeader } from '../client';
import { queryKeys } from '../queryKeys';
import { CACHE_STRATEGIES } from '../cache';
import type { StanceResponse, StanceStats } from '../types';

/**
 * Query options for fetching user's stances for a debate
 * Uses 'frequent' cache strategy for user-specific data
 */
export const userStanceQueryOptions = (debateId: string, token?: string) =>
  queryOptions({
    queryKey: queryKeys.stances.byDebate(debateId),
    queryFn: async (): Promise<StanceResponse | null> => {
      if (!token || !debateId) return null;
      try {
        return await fetchApi<StanceResponse>(`/api/debates/${debateId}/stance`, {
          headers: getAuthHeader(token),
        });
      } catch {
        return null;
      }
    },
    ...CACHE_STRATEGIES.frequent,
    enabled: !!debateId && !!token,
  });

/**
 * Query options for fetching aggregate stance stats (public)
 * Uses 'frequent' cache strategy for live stats
 */
export const stanceStatsQueryOptions = (debateId: string) =>
  queryOptions({
    queryKey: queryKeys.stanceStats.byDebate(debateId),
    queryFn: async (): Promise<StanceStats> => {
      return fetchApi<StanceStats>(`/api/debates/${debateId}/stance-stats`);
    },
    ...CACHE_STRATEGIES.frequent,
    enabled: !!debateId,
  });
