/**
 * User Query Options
 * 
 * TanStack Query options for user-related data fetching.
 */

import { queryOptions, keepPreviousData } from '@tanstack/react-query';
import { fetchApi, getAuthHeader } from '../client';
import { queryKeys } from '../queryKeys';
import { CACHE_STRATEGIES } from '../cache';
import type { Debate, User } from '@debate-platform/shared';
import type {
  CurrentUserResponse,
  UserResponse,
  UserStatsResponse,
  UserDebatesResponse,
} from '../types';

/**
 * Query options for fetching current user profile
 * Uses 'static' cache strategy for user profile data
 */
export const currentUserQueryOptions = (token?: string) =>
  queryOptions({
    queryKey: queryKeys.users.current(),
    queryFn: async (): Promise<CurrentUserResponse | null> => {
      if (!token) return null;
      try {
        return await fetchApi<CurrentUserResponse>('/api/users/me', {
          headers: getAuthHeader(token),
        });
      } catch {
        return null;
      }
    },
    ...CACHE_STRATEGIES.static,
    enabled: !!token,
  });

/**
 * Query options for fetching user by ID
 * Uses 'static' cache strategy for user profile data
 */
export const userQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.users.detail(userId),
    queryFn: async (): Promise<User | null> => {
      if (!userId) return null;
      try {
        const response = await fetchApi<UserResponse>(`/api/users/${userId}`);
        return response.user;
      } catch {
        return null;
      }
    },
    ...CACHE_STRATEGIES.static,
    enabled: !!userId,
  });

/**
 * Query options for fetching user statistics
 * Uses 'static' cache strategy for user stats
 */
export const userStatsQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.users.stats(userId),
    queryFn: async (): Promise<UserStatsResponse['stats'] | null> => {
      if (!userId) return null;
      try {
        const response = await fetchApi<UserStatsResponse>(`/api/users/${userId}/stats`);
        return response.stats;
      } catch {
        return null;
      }
    },
    ...CACHE_STRATEGIES.static,
    enabled: !!userId,
  });

/**
 * Query options for fetching user's debate history
 * Uses 'static' cache strategy for user history
 */
export const userDebatesQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.users.debates(userId),
    queryFn: async (): Promise<Debate[]> => {
      if (!userId) return [];
      try {
        const response = await fetchApi<UserDebatesResponse>(`/api/users/${userId}/debates`);
        return response.debates;
      } catch {
        return [];
      }
    },
    ...CACHE_STRATEGIES.static,
    enabled: !!userId,
    placeholderData: keepPreviousData,
    // Sort by most recent participation
    select: (data) => [...data].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    }),
  });
