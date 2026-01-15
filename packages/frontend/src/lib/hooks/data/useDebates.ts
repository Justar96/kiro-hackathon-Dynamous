/**
 * Debate Data Hooks
 *
 * Hooks for fetching and mutating debate data.
 * Includes infinite scroll support for Reddit-style feed.
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuthToken } from './useAuthToken';
import {
  queryKeys,
  debatesQueryOptions,
  debateFullQueryOptions,
  infiniteDebatesQueryOptions,
  type UseInfiniteDebatesOptions,
  requireAuthToken,
} from '../../api';
import { createDebate, joinDebate, submitArgument } from '../../api';
import { mutationKeys } from '../../api';
import type { DebateWithMarket } from '@thesis/shared';

/**
 * Fetch all debates
 */
export function useDebates() {
  return useQuery(debatesQueryOptions);
}

/**
 * Fetch debate with ALL related data (debate, rounds, debaters, market) in one request.
 * Use this for the debate detail page to minimize API calls.
 */
export function useDebateFull(debateId: string) {
  const token = useAuthToken();
  return useQuery(debateFullQueryOptions(debateId, token));
}

/**
 * Create a new debate
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useCreateDebate() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: mutationKeys.debates.create(),
    mutationFn: (input: { resolution: string; creatorSide?: 'support' | 'oppose' }) => {
      const authToken = requireAuthToken(token);
      return createDebate(input, authToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.all });
    },
  });
}

/**
 * Join a debate as oppose debater
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useJoinDebate() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: mutationKeys.debates.join(),
    mutationFn: (debateId: string) => {
      const authToken = requireAuthToken(token);
      return joinDebate(debateId, authToken);
    },
    onSuccess: (_, debateId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.detail(debateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.all });
    },
  });
}

/**
 * Submit an argument in a debate
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useSubmitArgument() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: mutationKeys.arguments.submit(),
    mutationFn: ({ debateId, content }: { debateId: string; content: string }) => {
      const authToken = requireAuthToken(token);
      return submitArgument(debateId, { content }, authToken);
    },
    onSuccess: (_, { debateId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.detail(debateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.full(debateId) });
    },
  });
}

// ============================================================================
// Infinite Scroll Hook
// ============================================================================

/**
 * Custom hook for infinite scroll debates feed.
 * Wraps TanStack Query's useInfiniteQuery with debate-specific logic.
 *
 * TanStack Query v5 Best Practices:
 * - Uses infiniteQueryOptions for type-safe configuration
 * - Implements maxPages for memory management
 * - Cursor-based pagination for efficient loading
 *
 * @param options - Configuration options
 * @param options.pageSize - Number of debates per page (default: 20)
 * @param options.filter - Filter type: 'all' or 'my-debates'
 * @param options.userId - User ID for 'my-debates' filter
 *
 * @returns Object containing:
 * - debates: Flattened array of all loaded debates with market data
 * - fetchNextPage: Function to load the next page
 * - hasNextPage: Whether more pages are available
 * - isFetchingNextPage: Whether currently loading next page
 * - isLoading: Whether initial load is in progress
 * - isError: Whether an error occurred
 * - error: The error object if any
 * - refetch: Function to refetch all data
 * - totalCount: Total number of debates matching the filter
 */
export function useInfiniteDebates(options: UseInfiniteDebatesOptions = {}) {
  const queryOptions = infiniteDebatesQueryOptions(options);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery(queryOptions);

  // Flatten all pages into a single array of debates
  const debates = useMemo<DebateWithMarket[]>(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.debates);
  }, [data?.pages]);

  // Get total count from the first page (it's the same across all pages)
  const totalCount = data?.pages[0]?.totalCount ?? 0;

  return {
    debates,
    fetchNextPage,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
    totalCount,
  };
}

export type UseInfiniteDebatesResult = ReturnType<typeof useInfiniteDebates>;
