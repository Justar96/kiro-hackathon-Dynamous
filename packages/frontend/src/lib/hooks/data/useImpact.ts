/**
 * Impact Attribution Hooks
 * 
 * Hooks for attributing mind-change impact to arguments.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthToken } from './useAuthToken';
import { queryKeys, mutationKeys, requireAuthToken } from '../../api';
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
    mutationKey: mutationKeys.impact.attribute(),
    mutationFn: ({
      debateId,
      argumentId
    }: {
      debateId: string;
      argumentId: string;
    }) => {
      const authToken = requireAuthToken(token);
      return attributeImpact(debateId, { argumentId }, authToken);
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
 *
 * Fix: Changed signature to accept debateId for targeted invalidation
 * instead of invalidating all debates/markets globally
 */
export function useMindChanged() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: mutationKeys.arguments.mindChanged(),
    mutationFn: ({ argumentId }: { argumentId: string; debateId: string }) => {
      const authToken = requireAuthToken(token);
      return markMindChanged(argumentId, authToken);
    },
    onSuccess: (_, { debateId }) => {
      // Fix: Only invalidate the specific debate's data, not all debates
      // This prevents massive refetch cascade across the entire app
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.full(debateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.detail(debateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.market.byDebate(debateId) });
      // Leaderboard will naturally refresh via staleTime
    },
  });
}
