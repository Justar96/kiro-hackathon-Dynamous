/**
 * Impact Attribution Hooks
 * 
 * Hooks for attributing mind-change impact to arguments.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthToken } from './useAuthToken';
import { queryKeys } from '../../api';
import { attributeImpact, markMindChanged } from '../../api';

/**
 * Attribute mind-change impact to a specific argument.
 * This is the "This changed my mind" interaction.
 * Requirements: 13.1
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useAttributeImpact() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: ['mutations', 'impact', 'attribute'] as const,
    mutationFn: ({
      debateId,
      argumentId
    }: {
      debateId: string;
      argumentId: string;
    }) => {
      if (!token) throw new Error('Authentication required');
      return attributeImpact(debateId, { argumentId }, token);
    },
    onSuccess: (_, { debateId }) => {
      // Invalidate stance to update lastArgumentSeen
      queryClient.invalidateQueries({ queryKey: queryKeys.stances.byDebate(debateId) });
      // Invalidate market to update impact scores
      queryClient.invalidateQueries({ queryKey: queryKeys.market.byDebate(debateId) });
      // Invalidate debate detail to refresh argument impact scores
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.detail(debateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.full(debateId) });
    },
  });
}

/**
 * Mark that a specific argument changed your mind.
 * Per original vision: "This changed my mind" button for explicit impact attribution.
 * Updates impact score and creates spike if significant.
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useMindChanged() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: ['mutations', 'arguments', 'mindChanged'] as const,
    mutationFn: (argumentId: string) => {
      if (!token) throw new Error('Authentication required');
      return markMindChanged(argumentId, token);
    },
    onSuccess: () => {
      // Invalidate all relevant queries to refresh impact scores
      queryClient.invalidateQueries({ queryKey: ['debates'] });
      queryClient.invalidateQueries({ queryKey: ['market'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}
