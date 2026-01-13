/**
 * useSSEComments Hook
 * 
 * Subscribes to real-time comment updates via SSE and syncs with TanStack Query cache.
 * Handles optimistic comment deduplication and threaded comment insertion.
 * 
 * Requirements: 6.2, 6.3, 6.5
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSSE } from './useSSE';
import { queryKeys } from './queries';
import type { Comment, CommentEventData } from '@debate-platform/shared';

/**
 * Check if a comment ID is an optimistic ID (starts with 'optimistic-')
 * Used for deduplication (Requirement 6.2)
 */
function isOptimisticId(id: string): boolean {
  return id.startsWith('optimistic-');
}

/**
 * Find the correct position to insert a reply comment in a threaded list.
 * Replies should be inserted after their parent and any existing replies to that parent.
 * (Requirement 6.5)
 * 
 * @param comments - Current list of comments
 * @param parentId - The parent comment ID
 * @returns The index where the reply should be inserted
 */
function findThreadedInsertPosition(comments: Comment[], parentId: string): number {
  const parentIndex = comments.findIndex(c => c.id === parentId);
  
  if (parentIndex === -1) {
    // Parent not found, append to end
    return comments.length;
  }
  
  // Find the last reply to this parent (or nested replies)
  let insertIndex = parentIndex + 1;
  
  // Track all comment IDs that are part of this thread
  const threadIds = new Set<string>([parentId]);
  
  for (let i = parentIndex + 1; i < comments.length; i++) {
    const comment = comments[i];
    
    // If this comment's parent is in our thread, it's part of the thread
    if (comment.parentId && threadIds.has(comment.parentId)) {
      threadIds.add(comment.id);
      insertIndex = i + 1;
    } else if (!comment.parentId || !threadIds.has(comment.parentId)) {
      // This comment is not part of our thread, stop here
      break;
    }
  }
  
  return insertIndex;
}

/**
 * Hook to subscribe to real-time comment updates via SSE.
 * Automatically updates the comments query cache when new comments arrive.
 * Handles optimistic comment deduplication and threaded comment insertion.
 *
 * Requirements: 6.2, 6.3, 6.5
 *
 * @param debateId - The debate ID to subscribe to
 * @param currentUserId - Optional current user ID for deduplication
 * @returns Object with connection status
 * 
 * @example
 * ```tsx
 * const { isConnected } = useSSEComments(debateId, userId);
 * ```
 */
export function useSSEComments(debateId: string, currentUserId?: string) {
  const queryClient = useQueryClient();

  // Handle incoming comment events
  const handleCommentEvent = useCallback((eventData: CommentEventData) => {
    if (!eventData.comment) return;
    if (eventData.action !== 'add') return; // Only handle 'add' action for now

    const newComment = eventData.comment;
    const parentId = eventData.parentId;

    // Update the comments cache (Requirement 6.3)
    queryClient.setQueryData<Comment[]>(
      queryKeys.comments.byDebate(debateId),
      (oldComments) => {
        if (!oldComments) return [newComment];

        // Deduplication check (Requirement 6.2):
        // Check if this exact comment already exists (by ID)
        const existingIndex = oldComments.findIndex(c => c.id === newComment.id);
        if (existingIndex !== -1) {
          // Comment already exists, no need to add
          return oldComments;
        }

        // Check for optimistic comments that should be replaced
        // An optimistic comment from the current user with matching content should be replaced
        const optimisticIndex = oldComments.findIndex(c => 
          isOptimisticId(c.id) && 
          c.userId === newComment.userId &&
          c.content === newComment.content &&
          c.parentId === newComment.parentId
        );

        if (optimisticIndex !== -1) {
          // Replace optimistic comment with real one
          const updatedComments = [...oldComments];
          updatedComments[optimisticIndex] = newComment;
          return updatedComments;
        }

        // Check if there are any optimistic comments from the current user
        // that might be duplicates (same user, similar timing)
        const hasOptimisticFromUser = currentUserId && oldComments.some(c =>
          isOptimisticId(c.id) && c.userId === currentUserId
        );

        if (hasOptimisticFromUser && newComment.userId === currentUserId) {
          // Remove all optimistic comments from this user and add the real one
          const withoutOptimistic = oldComments.filter(c => 
            !(isOptimisticId(c.id) && c.userId === currentUserId)
          );
          
          // Insert at correct position for threaded comments
          if (parentId) {
            const insertIndex = findThreadedInsertPosition(withoutOptimistic, parentId);
            const result = [...withoutOptimistic];
            result.splice(insertIndex, 0, newComment);
            return result;
          }
          
          return [...withoutOptimistic, newComment];
        }

        // No deduplication needed, insert the new comment
        // Handle threaded comment insertion (Requirement 6.5)
        if (parentId) {
          const insertIndex = findThreadedInsertPosition(oldComments, parentId);
          const result = [...oldComments];
          result.splice(insertIndex, 0, newComment);
          return result;
        }

        // Top-level comment, append to end
        return [...oldComments, newComment];
      }
    );
  }, [debateId, currentUserId, queryClient]);

  // Subscribe to comment events
  const { isConnected, connectionStatus } = useSSE<CommentEventData>(
    'comment',
    handleCommentEvent,
    [debateId, currentUserId]
  );

  return {
    isConnected,
    connectionStatus,
  };
}
