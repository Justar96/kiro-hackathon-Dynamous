/**
 * Optimistic Reaction Hook
 * 
 * Hook for optimistic reaction updates.
 * Immediately increments/decrements reaction counts before server confirmation,
 * handles rollback on error, and reconciles with server response.
 * 
 * Requirements: 3.2, 3.4, 3.5
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { useAuthToken } from '../data/useAuthToken';
import { useToast } from '../../../components/common/Toast';
import { queryKeys, mutationKeys } from '../../api';
import { addReaction, removeReaction } from '../../api';
import type { ReactionsResponse, OptimisticContext } from './types';

interface UseOptimisticReactionOptions {
  argumentId: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

type ReactionType = 'agree' | 'strong_reasoning';

/**
 * Hook for optimistic reaction updates.
 * Immediately increments/decrements reaction counts before server confirmation,
 * handles rollback on error, and reconciles with server response.
 */
export function useOptimisticReaction({ argumentId, onSuccess, onError }: UseOptimisticReactionOptions) {
  const queryClient = useQueryClient();
  const token = useAuthToken();
  const { showToast } = useToast();
  const isPendingRef = useRef(false);

  const addMutation = useMutation({
    mutationKey: mutationKeys.reactions.add(argumentId),
    mutationFn: async (type: ReactionType) => {
      if (!token) throw new Error('Authentication required');
      return addReaction(argumentId, { type }, token);
    },
    onMutate: async (type: ReactionType) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.arguments.reactions(argumentId) });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData<ReactionsResponse>(queryKeys.arguments.reactions(argumentId));
      
      // Optimistically update the cache
      queryClient.setQueryData<ReactionsResponse>(queryKeys.arguments.reactions(argumentId), (old) => {
        if (!old) {
          return {
            counts: {
              agree: type === 'agree' ? 1 : 0,
              strongReasoning: type === 'strong_reasoning' ? 1 : 0,
            },
            userReactions: {
              agree: type === 'agree',
              strongReasoning: type === 'strong_reasoning',
            },
          };
        }
        
        return {
          counts: {
            agree: old.counts.agree + (type === 'agree' ? 1 : 0),
            strongReasoning: old.counts.strongReasoning + (type === 'strong_reasoning' ? 1 : 0),
          },
          userReactions: {
            agree: type === 'agree' ? true : (old.userReactions?.agree ?? false),
            strongReasoning: type === 'strong_reasoning' ? true : (old.userReactions?.strongReasoning ?? false),
          },
        };
      });
      
      return { previousData, timestamp: Date.now() } as OptimisticContext<ReactionsResponse | undefined>;
    },
    onError: (error: Error, _type, context) => {
      isPendingRef.current = false;
      
      // Rollback to previous state
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKeys.arguments.reactions(argumentId), context.previousData);
      }
      
      // Show error toast
      showToast({
        type: 'error',
        message: error.message || 'Failed to add reaction. Please try again.',
      });
      
      onError?.(error);
    },
    onSuccess: () => {
      isPendingRef.current = false;
      
      // Invalidate to reconcile with server data
      queryClient.invalidateQueries({ queryKey: queryKeys.arguments.reactions(argumentId) });
      
      onSuccess?.();
    },
    onSettled: () => {
      isPendingRef.current = false;
    },
  });

  const removeMutation = useMutation({
    mutationKey: mutationKeys.reactions.remove(argumentId),
    mutationFn: async (type: ReactionType) => {
      if (!token) throw new Error('Authentication required');
      return removeReaction(argumentId, type, token);
    },
    onMutate: async (type: ReactionType) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.arguments.reactions(argumentId) });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData<ReactionsResponse>(queryKeys.arguments.reactions(argumentId));
      
      // Optimistically update the cache
      queryClient.setQueryData<ReactionsResponse>(queryKeys.arguments.reactions(argumentId), (old) => {
        if (!old) return old;
        
        return {
          counts: {
            agree: Math.max(0, old.counts.agree - (type === 'agree' ? 1 : 0)),
            strongReasoning: Math.max(0, old.counts.strongReasoning - (type === 'strong_reasoning' ? 1 : 0)),
          },
          userReactions: {
            agree: type === 'agree' ? false : (old.userReactions?.agree ?? false),
            strongReasoning: type === 'strong_reasoning' ? false : (old.userReactions?.strongReasoning ?? false),
          },
        };
      });
      
      return { previousData, timestamp: Date.now() } as OptimisticContext<ReactionsResponse | undefined>;
    },
    onError: (error: Error, _type, context) => {
      isPendingRef.current = false;
      
      // Rollback to previous state
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKeys.arguments.reactions(argumentId), context.previousData);
      }
      
      // Show error toast
      showToast({
        type: 'error',
        message: error.message || 'Failed to remove reaction. Please try again.',
      });
      
      onError?.(error);
    },
    onSuccess: () => {
      isPendingRef.current = false;
      
      // Invalidate to reconcile with server data
      queryClient.invalidateQueries({ queryKey: queryKeys.arguments.reactions(argumentId) });
      
      onSuccess?.();
    },
    onSettled: () => {
      isPendingRef.current = false;
    },
  });

  const addReactionOptimistic = useCallback(
    (type: ReactionType) => {
      // Prevent duplicate submissions - check both ref and mutation state
      if (isPendingRef.current || addMutation.isPending || removeMutation.isPending) return;
      
      // Set ref immediately to prevent rapid duplicate calls
      isPendingRef.current = true;
      
      addMutation.mutate(type);
    },
    [addMutation, removeMutation]
  );

  const removeReactionOptimistic = useCallback(
    (type: ReactionType) => {
      // Prevent duplicate submissions - check both ref and mutation state
      if (isPendingRef.current || addMutation.isPending || removeMutation.isPending) return;
      
      // Set ref immediately to prevent rapid duplicate calls
      isPendingRef.current = true;
      
      removeMutation.mutate(type);
    },
    [addMutation, removeMutation]
  );

  return {
    addReaction: addReactionOptimistic,
    removeReaction: removeReactionOptimistic,
    isPending: addMutation.isPending || removeMutation.isPending,
    error: addMutation.error || removeMutation.error,
  };
}
