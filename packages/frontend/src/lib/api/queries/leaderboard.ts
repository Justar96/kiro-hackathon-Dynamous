/**
 * Leaderboard Query Options
 * 
 * TanStack Query options for leaderboard-related data fetching.
 */

import { queryOptions } from '@tanstack/react-query';
import { fetchApi } from '../client';
import { queryKeys } from '../queryKeys';
import { CACHE_STRATEGIES } from '../cache';
import type { TopArgument, TopUser } from '../types';

/**
 * Query options for fetching top persuasive arguments
 * Uses 'static' cache strategy for leaderboard data
 */
export const leaderboardQueryOptions = (limit: number = 10) =>
  queryOptions({
    queryKey: queryKeys.leaderboard.arguments(),
    queryFn: async (): Promise<TopArgument[]> => {
      const response = await fetchApi<{ arguments: TopArgument[] }>(`/api/leaderboard/arguments?limit=${limit}`);
      return response.arguments;
    },
    ...CACHE_STRATEGIES.static,
  });

/**
 * Query options for fetching top users by reputation
 * Uses 'stable' cache strategy for rarely changing leaderboard
 */
export const topUsersQueryOptions = (limit: number = 10) =>
  queryOptions({
    queryKey: queryKeys.leaderboard.users(),
    queryFn: async (): Promise<TopUser[]> => {
      const response = await fetchApi<{ users: TopUser[] }>(`/api/leaderboard/users?limit=${limit}`);
      return response.users;
    },
    ...CACHE_STRATEGIES.stable,
  });
