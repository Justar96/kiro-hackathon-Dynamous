/**
 * Optimistic Comment Hook
 * 
 * Hook for optimistic comment updates.
 * Immediately adds the comment to the list before server confirmation,
 * handles rollback on error, and reconciles with server response.
 * 
 * Requirements: 3.3, 3.4, 3.5
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { useAuthToken } from '../data/useAuthToken';
import { useToast } from '../../../components/common/Toast';
import { queryKeys, mutationKeys } from '../../api';
import { addComment } from '../../api';
import type { Comment } from '@debate-platform/shared';
import type { OptimisticContext } from './types';

interface UseOptimisticCommentOptions {
  debateId: string;
  userId?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

interface AddCommentParams {
  content: string;
  parentId?: string | null;
}

/**
 * Hook for optimistic comment updates.
 * Immediately adds the comment to the list before server confirmation,
 * handles rollback on error, and reconciles with server response.
 */
export function useOptimisticComment({ debateId, userId, onSuccess, onError }: UseOptimisticCommentOptions) {
  const queryClient = useQueryClient();
  const token = useAuthToken();
  const { showToast } = useToast();
  const isPendingRef = useRef(false);
  const pendingCommentsRef = useRef<Comment[]>([]);

  const mutation = useMutation({
    mutationKey: mutationKeys.comments.add(debateId),
    mutationFn: async (params: AddCommentParams) => {
      if (!token) throw new Error('Authentication required');
      return addComment(debateId, { content: params.content, parentId: params.parentId }, token);
    },
    onMutate: async (params: AddCommentParams) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.comments.byDebate(debateId) });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData<Comment[]>(queryKeys.comments.byDebate(debateId));
      
      // Create optimistic comment
      const optimisticComment: Comment = {
        id: `optimistic-${Date.now()}`,
        debateId,
        userId: userId || token || '',
        parentId: params.parentId || null,
        content: params.content,
        createdAt: new Date(),
      };
      
      // Track pending comments
      pendingCommentsRef.current = [...pendingCommentsRef.current, optimisticComment];
      
      // Optimistically update the cache
      queryClient.setQueryData<Comment[]>(queryKeys.comments.byDebate(debateId), (old) => {
        if (!old) return [optimisticComment];
        return [...old, optimisticComment];
      });
      
      return { 
        previousData, 
        timestamp: Date.now(),
        optimisticId: optimisticComment.id,
      } as OptimisticContext<Comment[] | undefined> & { optimisticId: string };
    },
    onError: (error: Error, _params, context) => {
      isPendingRef.current = false;
      
      // Remove from pending comments
      if (context?.optimisticId) {
        pendingCommentsRef.current = pendingCommentsRef.current.filter(
          c => c.id !== context.optimisticId
        );
      }
      
      // Rollback to previous state
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKeys.comments.byDebate(debateId), context.previousData);
      }
      
      // Show error toast
      showToast({
        type: 'error',
        message: error.message || 'Failed to post comment. Please try again.',
      });
      
      onError?.(error);
    },
    onSuccess: (_data, _params, context) => {
      isPendingRef.current = false;
      
      // Remove from pending comments
      if (context?.optimisticId) {
        pendingCommentsRef.current = pendingCommentsRef.current.filter(
          c => c.id !== context.optimisticId
        );
      }
      
      // Invalidate to reconcile with server data
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.byDebate(debateId) });
      
      onSuccess?.();
    },
    onSettled: () => {
      isPendingRef.current = false;
    },
  });

  const addCommentOptimistic = useCallback(
    (content: string, parentId?: string | null) => {
      // Prevent duplicate submissions - check both ref and mutation state
      if (isPendingRef.current || mutation.isPending) return;
      
      // Set ref immediately to prevent rapid duplicate calls
      isPendingRef.current = true;
      
      mutation.mutate({ content, parentId });
    },
    [mutation]
  );

  return {
    addComment: addCommentOptimistic,
    isPending: mutation.isPending,
    pendingComments: pendingCommentsRef.current,
    error: mutation.error,
  };
}
