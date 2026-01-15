/**
 * Stance Data Hooks
 * 
 * Hooks for fetching and mutating user stance data.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthToken } from './useAuthToken';
import { queryKeys, userStanceQueryOptions, requireAuthToken } from '../../api';
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
    mutationKey: mutationKeys.stances.pre(),
    mutationFn: ({
      debateId,
      supportValue,
      confidence
    }: {
      debateId: string;
      supportValue: number;
      confidence: number;
    }) => {
      const authToken = requireAuthToken(token);
      return recordPreStance(debateId, { supportValue, confidence }, authToken);
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
    mutationKey: mutationKeys.stances.post(),
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
      const authToken = requireAuthToken(token);
      return recordPostStance(debateId, { supportValue, confidence, lastArgumentSeen }, authToken);
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
    mutationKey: mutationKeys.stances.quick(),
    mutationFn: ({
      debateId,
      side,
    }: {
      debateId: string;
      side: 'support' | 'oppose';
    }) => {
      const authToken = requireAuthToken(token);
      return recordQuickStance(debateId, { side }, authToken);
    },
    onSuccess: (_, { debateId }) => {
      // Fix: Only invalidate specific debate data, not the entire debate list
      // This prevents refetching all debates when recording a single stance
      queryClient.invalidateQueries({ queryKey: queryKeys.stances.byDebate(debateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.market.byDebate(debateId) });
      // Invalidate specific debate keys instead of debates.all
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.full(debateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.detail(debateId) });
    },
  });
}
