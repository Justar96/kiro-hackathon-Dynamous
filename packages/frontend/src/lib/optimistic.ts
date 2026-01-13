/**
 * Optimistic Update Hooks
 * 
 * These hooks implement optimistic updates for user actions, providing
 * immediate UI feedback before server confirmation with proper rollback
 * on error and reconciliation on success.
 * 
 * TanStack Query v5 Best Practices:
 * - All mutations have mutationKey for tracking via useMutationState
 * - Proper optimistic cache updates with rollback
 * - Reconciliation with server data via invalidation
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { useAuthToken } from './hooks';
import { useToast } from '../components/common/Toast';
import { queryKeys } from './queries';
import { mutationKeys } from './cacheStrategies';
import {
  recordPreStance,
  recordPostStance,
  addReaction,
  removeReaction,
  addComment,
} from './mutations';
import type { 
  Stance, 
  StanceValue, 
  Comment, 
  ReactionCounts,
  PersuasionDelta,
} from '@debate-platform/shared';

// ============================================================================
// Types
// ============================================================================

interface StanceResponse {
  stances: {
    pre: Stance | null;
    post: Stance | null;
  };
  delta: PersuasionDelta | null;
}

interface ReactionsResponse {
  counts: ReactionCounts;
  userReactions: {
    agree: boolean;
    strongReasoning: boolean;
  } | null;
}

interface OptimisticContext<T> {
  previousData: T;
  timestamp: number;
}

// ============================================================================
// useOptimisticStance Hook
// ============================================================================

interface UseOptimisticStanceOptions {
  debateId: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

interface RecordStanceParams {
  type: 'pre' | 'post';
  supportValue: number;
  confidence: number;
  lastArgumentSeen?: string | null;
}

/**
 * Hook for optimistic stance updates.
 * Immediately updates the UI before server confirmation,
 * handles rollback on error, and reconciles with server response.
 * 
 * Requirements: 3.1, 3.4, 3.5
 */
export function useOptimisticStance({ debateId, onSuccess, onError }: UseOptimisticStanceOptions) {
  const queryClient = useQueryClient();
  const token = useAuthToken();
  const { showToast } = useToast();
  const isPendingRef = useRef(false);

  const mutation = useMutation({
    mutationKey: mutationKeys.stances.record(debateId),
    mutationFn: async (params: RecordStanceParams) => {
      if (!token) throw new Error('Authentication required');
      
      if (params.type === 'pre') {
        return recordPreStance(
          debateId,
          { supportValue: params.supportValue, confidence: params.confidence },
          token
        );
      } else {
        return recordPostStance(
          debateId,
          { 
            supportValue: params.supportValue, 
            confidence: params.confidence,
            lastArgumentSeen: params.lastArgumentSeen,
          },
          token
        );
      }
    },
    onMutate: async (params: RecordStanceParams) => {
      // Note: isPendingRef is already set to true in recordStance before mutate is called
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.stances.byDebate(debateId) });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData<StanceResponse>(queryKeys.stances.byDebate(debateId));
      
      // Optimistically update the cache
      queryClient.setQueryData<StanceResponse>(queryKeys.stances.byDebate(debateId), (old) => {
        if (!old) {
          // Create new stance response if none exists
          const newStance: Stance = {
            id: `optimistic-${Date.now()}`,
            debateId,
            voterId: token || '',
            type: params.type,
            supportValue: params.supportValue,
            confidence: params.confidence,
            lastArgumentSeen: params.lastArgumentSeen || null,
            createdAt: new Date(),
          };
          
          return {
            stances: {
              pre: params.type === 'pre' ? newStance : null,
              post: params.type === 'post' ? newStance : null,
            },
            delta: null,
          };
        }
        
        const newStance: Stance = {
          id: `optimistic-${Date.now()}`,
          debateId,
          voterId: token || '',
          type: params.type,
          supportValue: params.supportValue,
          confidence: params.confidence,
          lastArgumentSeen: params.lastArgumentSeen || null,
          createdAt: new Date(),
        };
        
        // Calculate delta if we have both stances
        let delta: PersuasionDelta | null = null;
        if (params.type === 'post' && old.stances.pre) {
          delta = {
            userId: token || '',
            debateId,
            preStance: {
              supportValue: old.stances.pre.supportValue,
              confidence: old.stances.pre.confidence,
            },
            postStance: {
              supportValue: params.supportValue,
              confidence: params.confidence,
            },
            delta: params.supportValue - old.stances.pre.supportValue,
            lastArgumentSeen: params.lastArgumentSeen || null,
          };
        }
        
        return {
          stances: {
            pre: params.type === 'pre' ? newStance : old.stances.pre,
            post: params.type === 'post' ? newStance : old.stances.post,
          },
          delta: delta || old.delta,
        };
      });
      
      return { previousData, timestamp: Date.now() } as OptimisticContext<StanceResponse | undefined>;
    },
    onError: (error: Error, _params, context) => {
      isPendingRef.current = false;
      
      // Rollback to previous state
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKeys.stances.byDebate(debateId), context.previousData);
      }
      
      // Show error toast
      showToast({
        type: 'error',
        message: error.message || 'Failed to record stance. Please try again.',
      });
      
      onError?.(error);
    },
    onSuccess: (_data, _params) => {
      isPendingRef.current = false;
      
      // Invalidate to reconcile with server data
      queryClient.invalidateQueries({ queryKey: queryKeys.stances.byDebate(debateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.market.byDebate(debateId) });
      
      onSuccess?.();
    },
    onSettled: () => {
      isPendingRef.current = false;
    },
  });

  const recordStance = useCallback(
    (type: 'pre' | 'post', value: StanceValue, lastArgumentSeen?: string | null) => {
      // Prevent duplicate submissions - check both ref and mutation state
      if (isPendingRef.current || mutation.isPending) return;
      
      // Set ref immediately to prevent rapid duplicate calls
      isPendingRef.current = true;
      
      mutation.mutate({
        type,
        supportValue: value.supportValue,
        confidence: value.confidence ?? 3,
        lastArgumentSeen,
      });
    },
    [mutation]
  );

  return {
    recordStance,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}


// ============================================================================
// useOptimisticReaction Hook
// ============================================================================

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
 * 
 * Requirements: 3.2, 3.4, 3.5
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
      // Note: isPendingRef is already set to true in addReactionOptimistic before mutate is called
      
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
      // Note: isPendingRef is already set to true in removeReactionOptimistic before mutate is called
      
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


// ============================================================================
// useOptimisticComment Hook
// ============================================================================

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
 * 
 * Requirements: 3.3, 3.4, 3.5
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
      // Note: isPendingRef is already set to true in addCommentOptimistic before mutate is called
      
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
