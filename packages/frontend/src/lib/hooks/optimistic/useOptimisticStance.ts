/**
 * Optimistic Stance Hook
 * 
 * Hook for optimistic stance updates.
 * Immediately updates the UI before server confirmation,
 * handles rollback on error, and reconciles with server response.
 * 
 * Requirements: 3.1, 3.4, 3.5
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { useAuthToken } from '../data/useAuthToken';
import { useToast } from '../../../components/common/Toast';
import { queryKeys, mutationKeys, requireAuthToken } from '../../api';
import { getMutationErrorMessage } from '../mutationHelpers';
import { recordPreStance, recordPostStance } from '../../api';
import type { Stance, StanceValue } from '@thesis/shared';
import type { StanceResponse, OptimisticContext } from './types';

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
 */
export function useOptimisticStance({ debateId, onSuccess, onError }: UseOptimisticStanceOptions) {
  const queryClient = useQueryClient();
  const token = useAuthToken();
  const { showToast } = useToast();
  const isPendingRef = useRef(false);

  const mutation = useMutation({
    mutationKey: mutationKeys.stances.record(debateId),
    mutationFn: async (params: RecordStanceParams) => {
      const authToken = requireAuthToken(token);
      
      if (params.type === 'pre') {
        return recordPreStance(
          debateId,
          { supportValue: params.supportValue, confidence: params.confidence },
          authToken
        );
      } else {
        return recordPostStance(
          debateId,
          { 
            supportValue: params.supportValue, 
            confidence: params.confidence,
            lastArgumentSeen: params.lastArgumentSeen,
          },
          authToken
        );
      }
    },
    onMutate: async (params: RecordStanceParams) => {
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
        let delta = null;
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
        message: getMutationErrorMessage(error, 'Failed to record stance. Please try again.'),
      });
      
      onError?.(error);
    },
    onSuccess: (serverResponse, params) => {
      isPendingRef.current = false;

      // Fix: Reconcile with server data using setQueryData instead of invalidating
      // This avoids a redundant refetch after the optimistic update
      // Market data is updated via SSE, so we don't need to invalidate it
      if (serverResponse) {
        queryClient.setQueryData<StanceResponse>(queryKeys.stances.byDebate(debateId), (oldData) => {
          // Handle different response types:
          // - Pre stance returns Stance directly
          // - Post stance returns RecordPostStanceResponse with { stance, delta }
          const isPostResponse = params.type === 'post' && 'stance' in serverResponse;
          const stanceData: Stance = isPostResponse
            ? (serverResponse as { stance: Stance }).stance
            : serverResponse as Stance;
          const deltaData = isPostResponse
            ? (serverResponse as { delta: unknown }).delta as StanceResponse['delta']
            : null;

          if (!oldData) {
            return {
              stances: {
                pre: params.type === 'pre' ? stanceData : null,
                post: params.type === 'post' ? stanceData : null,
              },
              delta: deltaData,
            };
          }

          return {
            stances: {
              pre: params.type === 'pre' ? stanceData : oldData.stances.pre,
              post: params.type === 'post' ? stanceData : oldData.stances.post,
            },
            delta: deltaData ?? oldData.delta,
          };
        });
      }

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
