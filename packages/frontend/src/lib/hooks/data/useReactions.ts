/**
 * Reaction Data Hooks
 * 
 * Hooks for fetching and mutating reaction data on arguments.
 */

import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthToken } from './useAuthToken';
import { queryKeys, reactionsQueryOptions, mutationKeys, requireAuthToken } from '../../api';
import { addReaction, removeReaction } from '../../api';

/**
 * Fetch reactions for an argument
 */
export function useReactions(argumentId: string) {
  const token = useAuthToken();
  return useQuery(reactionsQueryOptions(argumentId, token));
}

/**
 * Batch fetch reactions for multiple arguments using useQueries with combine.
 * TanStack Query v5 Best Practice: Use combine to merge results from parallel queries.
 * 
 * This is useful when displaying a list of arguments (e.g., in a debate round)
 * where each argument needs its reaction counts.
 * 
 * @param argumentIds - Array of argument IDs to fetch reactions for
 * @returns Combined result with reactions keyed by argument ID
 */
export function useBatchReactions(argumentIds: string[]) {
  const token = useAuthToken();

  return useQueries({
    queries: argumentIds.map((argumentId) => ({
      ...reactionsQueryOptions(argumentId, token),
      // Ensure disabled for empty IDs
      enabled: !!argumentId,
    })),
    combine: (results) => {
      // Create a map of argumentId -> reactions data
      const reactionsMap: Record<string, {
        counts: { agree: number; strongReasoning: number };
        userReactions: { agree: boolean; strongReasoning: boolean } | null;
      }> = {};

      // Track overall loading/error state
      let isPending = false;
      let isError = false;
      const errors: Error[] = [];

      results.forEach((result, index) => {
        const argumentId = argumentIds[index];
        
        if (result.isPending) {
          isPending = true;
        }
        
        if (result.isError) {
          isError = true;
          errors.push(result.error as Error);
        }
        
        if (result.data) {
          reactionsMap[argumentId] = result.data;
        }
      });

      return {
        data: reactionsMap,
        isPending,
        isError,
        errors,
        // Helper to get reactions for a specific argument
        getReactions: (argumentId: string) => reactionsMap[argumentId] ?? null,
      };
    },
  });
}

/**
 * Add a reaction to an argument
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useAddReaction() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: mutationKeys.reactions.add(),
    mutationFn: ({
      argumentId,
      type
    }: {
      argumentId: string;
      type: 'agree' | 'strong_reasoning';
    }) => {
      const authToken = requireAuthToken(token);
      return addReaction(argumentId, { type }, authToken);
    },
    onSuccess: (_, { argumentId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.arguments.reactions(argumentId) });
    },
  });
}

/**
 * Remove a reaction from an argument
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useRemoveReaction() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: mutationKeys.reactions.remove(),
    mutationFn: ({
      argumentId,
      type
    }: {
      argumentId: string;
      type: 'agree' | 'strong_reasoning';
    }) => {
      const authToken = requireAuthToken(token);
      return removeReaction(argumentId, type, authToken);
    },
    onSuccess: (_, { argumentId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.arguments.reactions(argumentId) });
    },
  });
}
