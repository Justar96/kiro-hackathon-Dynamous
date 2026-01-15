/**
 * Comment Data Hooks
 * 
 * Hooks for fetching and mutating comment data.
 */

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthToken } from './useAuthToken';
import { queryKeys, commentsQueryOptions, commentsInfiniteQueryOptions } from '../../api';
import { addComment } from '../../api';

/**
 * Fetch comments for a debate
 */
export function useComments(debateId: string) {
  return useQuery(commentsQueryOptions(debateId));
}

/**
 * Fetch paginated comments for a debate with infinite loading.
 * TanStack Query v5 Best Practice: Use useInfiniteQuery for paginated data.
 * 
 * Provides:
 * - data.pages: Array of comment pages
 * - fetchNextPage: Load more comments
 * - hasNextPage: Whether more pages exist
 * - isFetchingNextPage: Loading state for next page
 * 
 * @param debateId - The debate ID to fetch comments for
 * @param pageSize - Number of comments per page (default: 20)
 */
export function useInfiniteComments(debateId: string, pageSize: number = 20) {
  return useInfiniteQuery(commentsInfiniteQueryOptions(debateId, pageSize));
}

/**
 * Add a comment to a debate
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useAddComment() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: ['mutations', 'comments', 'add'] as const,
    mutationFn: ({
      debateId,
      content,
      parentId
    }: {
      debateId: string;
      content: string;
      parentId?: string | null;
    }) => {
      if (!token) throw new Error('Authentication required');
      return addComment(debateId, { content, parentId }, token);
    },
    onSuccess: (_, { debateId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.byDebate(debateId) });
    },
  });
}
