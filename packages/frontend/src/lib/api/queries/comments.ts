/**
 * Comment Query Options
 * 
 * TanStack Query options for comment-related data fetching.
 */

import { queryOptions, infiniteQueryOptions } from '@tanstack/react-query';
import { fetchApi, ApiError } from '../client';
import { queryKeys } from '../queryKeys';
import { CACHE_STRATEGIES } from '../cache';
import type { Comment } from '@debate-platform/shared';
import type { CommentsResponse, PaginatedCommentsResponse } from '../types';

/**
 * Query options for fetching comments for a debate
 * Uses 'frequent' cache strategy for user-generated content
 */
export const commentsQueryOptions = (debateId: string) =>
  queryOptions({
    queryKey: queryKeys.comments.byDebate(debateId),
    queryFn: async (): Promise<Comment[]> => {
      if (!debateId) return [];
      const response = await fetchApi<CommentsResponse>(`/api/debates/${debateId}/comments`);
      return response.comments;
    },
    ...CACHE_STRATEGIES.frequent,
    enabled: !!debateId,
    // Sort comments by creation time (oldest first for natural reading order)
    select: (data) => [...data].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return aTime - bTime;
    }),
  });

/**
 * Infinite query options for fetching paginated comments.
 * TanStack Query v5 Best Practice: Use infiniteQueryOptions for paginated data.
 * 
 * This enables "load more" functionality for debates with many comments.
 * Uses cursor-based pagination for efficient loading.
 * 
 * @param debateId - The debate ID to fetch comments for
 * @param pageSize - Number of comments per page (default: 20)
 */
export const commentsInfiniteQueryOptions = (debateId: string, pageSize: number = 20) =>
  infiniteQueryOptions({
    queryKey: [...queryKeys.comments.byDebate(debateId), 'infinite'] as const,
    queryFn: async ({ pageParam }): Promise<PaginatedCommentsResponse> => {
      if (!debateId) {
        return { comments: [], nextCursor: null, hasMore: false, totalCount: 0 };
      }
      
      const params = new URLSearchParams({
        limit: String(pageSize),
      });
      
      if (pageParam) {
        params.set('cursor', pageParam);
      }
      
      try {
        const response = await fetchApi<PaginatedCommentsResponse>(
          `/api/debates/${debateId}/comments?${params.toString()}`
        );
        return response;
      } catch (error) {
        // Only fallback to non-paginated API when endpoint doesn't support pagination (404)
        // Rethrow other errors (auth, server issues, etc.)
        if (error instanceof ApiError && error.status === 404) {
          const response = await fetchApi<CommentsResponse>(
            `/api/debates/${debateId}/comments`
          );
          return {
            comments: response.comments,
            nextCursor: null,
            hasMore: false,
            totalCount: response.comments.length,
          };
        }
        throw error;
      }
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    ...CACHE_STRATEGIES.frequent,
    enabled: !!debateId,
  });
