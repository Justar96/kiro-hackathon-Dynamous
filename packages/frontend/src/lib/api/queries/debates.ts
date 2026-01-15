/**
 * Debate Query Options
 * 
 * TanStack Query options for debate-related data fetching.
 */

import { queryOptions, infiniteQueryOptions, keepPreviousData } from '@tanstack/react-query';
import { fetchApi, getAuthHeader } from '../client';
import { queryKeys } from '../queryKeys';
import { CACHE_STRATEGIES } from '../cache';
import type {
  DebatesResponse,
  DebatesWithMarketResponse,
  DebateDetailResponse,
} from '../types';
import type { Debate, PaginatedDebatesResponse } from '@debate-platform/shared';

/**
 * Query options for fetching all debates (without market data)
 * Uses 'standard' cache strategy for list views
 */
export const debatesQueryOptions = queryOptions({
  queryKey: queryKeys.debates.lists(),
  queryFn: async (): Promise<Debate[]> => {
    const response = await fetchApi<DebatesResponse>('/api/debates');
    return response.debates;
  },
  ...CACHE_STRATEGIES.standard,
  placeholderData: keepPreviousData,
});

/**
 * Query options for fetching all debates WITH market data in a single request.
 * Eliminates N+1 queries on the index page.
 * Uses 'frequent' cache strategy since market data changes more often
 */
export const debatesWithMarketQueryOptions = queryOptions({
  queryKey: queryKeys.debates.withMarket(),
  queryFn: async (): Promise<Array<{ debate: Debate; marketPrice: import('@debate-platform/shared').MarketPrice | null }>> => {
    const response = await fetchApi<DebatesWithMarketResponse>('/api/debates?includeMarket=true');
    return response.debates;
  },
  ...CACHE_STRATEGIES.frequent,
  placeholderData: keepPreviousData,
  // Sort by most recent activity (active debates first, then by creation time)
  select: (data) => [...data].sort((a, b) => {
    // Active debates come first
    if (a.debate.status === 'active' && b.debate.status !== 'active') return -1;
    if (b.debate.status === 'active' && a.debate.status !== 'active') return 1;
    // Then sort by createdAt (most recent first)
    const aTime = new Date(a.debate.createdAt).getTime();
    const bTime = new Date(b.debate.createdAt).getTime();
    return bTime - aTime;
  }),
});

/**
 * Query options for fetching a single debate by ID with rounds and arguments
 * Uses 'standard' cache strategy for detail views
 * @deprecated Use debateFullQueryOptions for comprehensive data fetching
 */
export const debateQueryOptions = (debateId: string) =>
  queryOptions({
    queryKey: queryKeys.debates.detail(debateId),
    queryFn: async (): Promise<Debate | null> => {
      if (!debateId) return null;
      try {
        const response = await fetchApi<DebateDetailResponse>(`/api/debates/${debateId}`);
        return response.debate;
      } catch {
        return null;
      }
    },
    ...CACHE_STRATEGIES.standard,
    enabled: !!debateId,
  });

/**
 * Query options for fetching debate details with rounds
 * Uses 'frequent' cache strategy for active debate content
 * @deprecated Use debateFullQueryOptions for comprehensive data fetching
 */
export const debateDetailQueryOptions = (debateId: string) =>
  queryOptions({
    queryKey: [...queryKeys.debates.detail(debateId), 'rounds'] as const,
    queryFn: async (): Promise<DebateDetailResponse | null> => {
      if (!debateId) return null;
      try {
        return await fetchApi<DebateDetailResponse>(`/api/debates/${debateId}`);
      } catch {
        return null;
      }
    },
    ...CACHE_STRATEGIES.frequent,
    enabled: !!debateId,
  });

/**
 * Query options for fetching debate with ALL related data in a single request.
 * Includes: debate, rounds, arguments, debater profiles, and market data.
 * This eliminates multiple round-trips on the debate detail page.
 * Uses 'frequent' cache strategy for active debate content
 *
 * TanStack Query v5 Best Practice: Auth state included in query key to prevent
 * cache collision between authenticated and anonymous users when response varies.
 */
export const debateFullQueryOptions = (debateId: string, token?: string) =>
  queryOptions({
    // Include auth flag in key since response may vary (e.g., marketBlocked for non-auth)
    queryKey: [...queryKeys.debates.full(debateId), token ? 'auth' : 'anon'] as const,
    queryFn: async (): Promise<DebateDetailResponse | null> => {
      if (!debateId) return null;
      try {
        return await fetchApi<DebateDetailResponse>(
          `/api/debates/${debateId}?includeDebaters=true&includeMarket=true`,
          { headers: getAuthHeader(token) }
        );
      } catch {
        return null;
      }
    },
    ...CACHE_STRATEGIES.frequent,
    enabled: !!debateId,
    placeholderData: keepPreviousData,
  });

// ============================================================================
// Infinite Debates Query (Reddit-Style Feed)
// ============================================================================

export interface UseInfiniteDebatesOptions {
  pageSize?: number;
  filter?: 'all' | 'my-debates';
  userId?: string;
}

/**
 * Infinite query options for fetching paginated debates with market data.
 * TanStack Query v5 Best Practice: Use infiniteQueryOptions for paginated data.
 * 
 * This enables infinite scroll functionality for the Reddit-style feed.
 * Uses cursor-based pagination for efficient loading.
 */
export const infiniteDebatesQueryOptions = (options: UseInfiniteDebatesOptions = {}) => {
  const { pageSize = 20, filter = 'all', userId } = options;
  
  return infiniteQueryOptions({
    queryKey: [...queryKeys.debates.all, 'infinite', filter, userId ?? 'none'] as const,
    queryFn: async ({ pageParam }): Promise<PaginatedDebatesResponse> => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        includeMarket: 'true',
      });
      
      if (pageParam) {
        params.set('cursor', pageParam);
      }
      
      if (filter === 'my-debates' && userId) {
        params.set('filter', 'my-debates');
        params.set('userId', userId);
      }
      
      const response = await fetchApi<PaginatedDebatesResponse>(
        `/api/debates?${params.toString()}`
      );
      
      return response;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    ...CACHE_STRATEGIES.frequent,
  });
};
