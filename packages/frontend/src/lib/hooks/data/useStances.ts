/**
 * Stance Data Hooks
 * 
 * Hooks for fetching and mutating user stance data.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthToken } from './useAuthToken';
import { queryKeys, userStanceQueryOptions } from '../../api';
import { recordPreStance, recordPostStance, recordQuickStance } from '../../api';
import { mutationKeys } from '../../api';

/**
 * Fetch user's stances for a debate
 */
export function useUserStance(debateId: string) {
  const token = useAuthToken();
  return useQuery(userStanceQueryOptions(debateId, token));
}

/**
 * Record pre-read stance
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useRecordPreStance() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: ['mutations', 'stances', 'pre'] as const,
    mutationFn: ({
      debateId,
      supportValue,
      confidence
    }: {
      debateId: string;
      supportValue: number;
      confidence: number;
    }) => {
      if (!token) throw new Error('Authentication required');
      return recordPreStance(debateId, { supportValue, confidence }, token);
    },
    onSuccess: (_, { debateId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stances.byDebate(debateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.market.byDebate(debateId) });
    },
  });
}

/**
 * Record post-read stance
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useRecordPostStance() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: ['mutations', 'stances', 'post'] as const,
    mutationFn: ({
      debateId,
      supportValue,
      confidence,
      lastArgumentSeen,
    }: {
      debateId: string;
      supportValue: number;
      confidence: number;
      lastArgumentSeen?: string | null;
    }) => {
      if (!token) throw new Error('Authentication required');
      return recordPostStance(debateId, { supportValue, confidence, lastArgumentSeen }, token);
    },
    onSuccess: (_, { debateId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stances.byDebate(debateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.market.byDebate(debateId) });
    },
  });
}

/**
 * Quick stance from index page - simplified support/oppose binary choice.
 * This is a reusable hook replacing inline mutation in index.tsx.
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useQuickStance() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: mutationKeys.stances.quick(''),
    mutationFn: ({
      debateId,
      side,
    }: {
      debateId: string;
      side: 'support' | 'oppose';
    }) => {
      if (!token) throw new Error('Authentication required');
      return recordQuickStance(debateId, { side }, token);
    },
    onSuccess: (_, { debateId }) => {
      // Invalidate relevant queries to refresh stance and market data
      queryClient.invalidateQueries({ queryKey: queryKeys.stances.byDebate(debateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.market.byDebate(debateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.all });
    },
  });
}
