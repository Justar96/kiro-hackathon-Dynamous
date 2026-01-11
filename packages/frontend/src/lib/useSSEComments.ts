import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSSE } from './useSSE';
import { queryKeys } from './queries';
import type { Comment } from '@debate-platform/shared';

/**
 * Hook to subscribe to real-time comment updates via SSE.
 * Automatically updates the comments query cache when new comments arrive.
 *
 * Requirements: 9.2
 *
 * @param debateId - The debate ID to subscribe to
 * @returns Object with connection status
 */
export function useSSEComments(debateId: string) {
  const queryClient = useQueryClient();

  // Handle incoming comment events
  const handleCommentEvent = useCallback((data: { comment: Comment }) => {
    if (!data.comment) return;

    // Update the comments cache by adding the new comment
    queryClient.setQueryData<Comment[]>(
      queryKeys.comments.byDebate(debateId),
      (oldComments) => {
        if (!oldComments) return [data.comment];

        // Check if comment already exists (avoid duplicates from optimistic updates)
        const exists = oldComments.some(c =>
          c.id === data.comment.id || c.id.startsWith('optimistic-')
        );
        if (exists && !oldComments.some(c => c.id.startsWith('optimistic-'))) {
          return oldComments;
        }

        // Replace optimistic comments with real ones, or add new
        const withoutOptimistic = oldComments.filter(c => !c.id.startsWith('optimistic-'));
        return [...withoutOptimistic, data.comment];
      }
    );
  }, [debateId, queryClient]);

  // Subscribe to comment events
  const { isConnected, connectionStatus } = useSSE<{ comment: Comment }>(
    'comment',
    handleCommentEvent,
    [debateId]
  );

  return {
    isConnected,
    connectionStatus,
  };
}
