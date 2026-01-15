/**
 * Reaction Query Options
 * 
 * TanStack Query options for reaction-related data fetching.
 */

import { queryOptions } from '@tanstack/react-query';
import { fetchApi, getAuthHeader } from '../client';
import { queryKeys } from '../queryKeys';
import { CACHE_STRATEGIES } from '../cache';
import type { ReactionsResponse } from '../types';

/**
 * Query options for fetching reactions for an argument
 * Uses 'frequent' cache strategy for interactive content
 * TanStack Query v5 Best Practice: Auth state included since userReactions varies by user
 */
export const reactionsQueryOptions = (argumentId: string, token?: string) =>
  queryOptions({
    queryKey: [...queryKeys.arguments.reactions(argumentId), token ? 'auth' : 'anon'] as const,
    queryFn: async (): Promise<ReactionsResponse> => {
      return await fetchApi<ReactionsResponse>(`/api/arguments/${argumentId}/reactions`, {
        headers: getAuthHeader(token),
      });
    },
    ...CACHE_STRATEGIES.frequent,
    enabled: !!argumentId,
  });
