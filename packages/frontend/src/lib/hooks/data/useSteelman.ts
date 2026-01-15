/**
 * Steelman Gate Hooks
 * 
 * Hooks for steelman gate functionality - ensuring users engage
 * with opposing arguments before submitting their own.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthToken } from './useAuthToken';
import { queryKeys, steelmanStatusQueryOptions, pendingSteelmansQueryOptions } from '../../api';
import { submitSteelman, reviewSteelman, deleteSteelman } from '../../api';

/**
 * Check steelman gate status for a round.
 * Returns whether user can submit argument and steelman status.
 */
export function useSteelmanStatus(debateId: string, roundNumber: number) {
  const token = useAuthToken();
  return useQuery(steelmanStatusQueryOptions(debateId, roundNumber, token));
}

/**
 * Get pending steelmans that need review.
 */
export function usePendingSteelmans(debateId: string) {
  const token = useAuthToken();
  return useQuery(pendingSteelmansQueryOptions(debateId, token));
}

/**
 * Submit a steelman of opponent's argument.
 */
export function useSubmitSteelman() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationFn: ({ debateId, roundNumber, targetArgumentId, content }: {
      debateId: string;
      roundNumber: 1 | 2 | 3;
      targetArgumentId: string;
      content: string;
    }) => {
      if (!token) throw new Error('Authentication required');
      return submitSteelman(debateId, { roundNumber, targetArgumentId, content }, token);
    },
    onSuccess: (_, { debateId, roundNumber }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.steelman.status(debateId, roundNumber) });
      queryClient.invalidateQueries({ queryKey: queryKeys.steelman.pending(debateId) });
    },
  });
}

/**
 * Review (approve/reject) a steelman.
 */
export function useReviewSteelman() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationFn: ({ steelmanId, approved, rejectionReason }: {
      steelmanId: string;
      approved: boolean;
      rejectionReason?: string;
    }) => {
      if (!token) throw new Error('Authentication required');
      return reviewSteelman(steelmanId, { approved, rejectionReason }, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['steelman'] });
    },
  });
}

/**
 * Delete a rejected steelman to resubmit.
 */
export function useDeleteSteelman() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationFn: (steelmanId: string) => {
      if (!token) throw new Error('Authentication required');
      return deleteSteelman(steelmanId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['steelman'] });
    },
  });
}
