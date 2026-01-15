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
import { queryKeys, mutationKeys } from '../../api';
import { recordPreStance, recordPostStance } from '../../api';
import type { Stance, StanceValue } from '@debate-platform/shared';
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
