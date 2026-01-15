/**
 * Steelman Query Options
 * 
 * TanStack Query options for steelman gate-related data fetching.
 */

import { queryOptions } from '@tanstack/react-query';
import { fetchApi } from '../client';
import { queryKeys } from '../queryKeys';
import { CACHE_STRATEGIES } from '../cache';
import type { SteelmanStatus, PendingSteelman } from '../types';

/**
 * Query options for checking steelman gate status
 * Uses 'frequent' cache strategy for gate status checks
 */
export const steelmanStatusQueryOptions = (debateId: string, roundNumber: number, token?: string) =>
  queryOptions({
    queryKey: queryKeys.steelman.status(debateId, roundNumber),
    queryFn: async (): Promise<SteelmanStatus> => {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return fetchApi<SteelmanStatus>(
        `/api/debates/${debateId}/steelman/status?round=${roundNumber}`,
        { headers }
      );
    },
    ...CACHE_STRATEGIES.frequent,
    enabled: !!debateId && !!token && roundNumber > 1,
  });

/**
 * Query options for fetching pending steelmans to review
 * Uses 'realtime' cache strategy for pending reviews
 */
export const pendingSteelmansQueryOptions = (debateId: string, token?: string) =>
  queryOptions({
    queryKey: queryKeys.steelman.pending(debateId),
    queryFn: async (): Promise<PendingSteelman[]> => {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetchApi<{ pending: PendingSteelman[] }>(
        `/api/debates/${debateId}/steelman/pending`,
        { headers }
      );
      return response.pending;
    },
    ...CACHE_STRATEGIES.realtime,
    enabled: !!debateId && !!token,
  });
