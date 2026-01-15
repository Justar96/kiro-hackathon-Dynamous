/**
 * User Query Options
 * 
 * TanStack Query options for user-related data fetching.
 */

import { queryOptions, keepPreviousData } from '@tanstack/react-query';
import { fetchApi, getAuthHeader } from '../client';
import { queryKeys } from '../queryKeys';
import { CACHE_STRATEGIES } from '../cache';
import type { Debate, User, ReputationBreakdown } from '@thesis/shared';
import type {
  CurrentUserResponse,
  UserResponse,
  UserStatsResponse,
  UserDebatesResponse,
  VotingHistoryResponse,
  VotingHistoryEntry,
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


/**
 * Query options for fetching user's private voting history (self-access only)
 * Per Requirement 3.4: Users can view their own voting history privately
 * Uses 'static' cache strategy for user history
 */
export const votingHistoryQueryOptions = (userId: string, token?: string) =>
  queryOptions({
    queryKey: queryKeys.users.votingHistory(userId),
    queryFn: async (): Promise<VotingHistoryEntry[]> => {
      if (!userId || !token) return [];
      try {
        const response = await fetchApi<VotingHistoryResponse>(
          `/api/users/${userId}/voting-history`,
          { headers: getAuthHeader(token) }
        );
        return response.votingHistory;
      } catch {
        // Return empty array if unauthorized or error
        return [];
      }
    },
    ...CACHE_STRATEGIES.static,
    enabled: !!userId && !!token,
    placeholderData: keepPreviousData,
  });


/**
 * Query options for fetching user reputation breakdown
 * Requirement 4.1 - Return ReputationBreakdown for user profile
 * Uses 'static' cache strategy for reputation data
 */
export const reputationBreakdownQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.users.reputation(userId),
    queryFn: async (): Promise<ReputationBreakdown | null> => {
      if (!userId) return null;
      try {
        const response = await fetchApi<{ breakdown: ReputationBreakdown }>(
          `/api/users/${userId}/reputation`
        );
        return response.breakdown;
      } catch {
        return null;
      }
    },
    ...CACHE_STRATEGIES.static,
    enabled: !!userId,
  });
