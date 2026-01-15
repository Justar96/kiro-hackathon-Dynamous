import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { infiniteDebatesQueryOptions, type UseInfiniteDebatesOptions } from './api';
import type { DebateWithMarket } from '@debate-platform/shared';

/**
 * Custom hook for infinite scroll debates feed.
 * Wraps TanStack Query's useInfiniteQuery with debate-specific logic.
 * 
 * Requirements: 1.1, 1.2, 1.3 - Cursor-based pagination for infinite scroll
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
