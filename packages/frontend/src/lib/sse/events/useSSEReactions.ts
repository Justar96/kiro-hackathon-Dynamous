/**
 * useSSEReactions Hook
 * 
 * Subscribes to real-time reaction count updates via SSE and syncs with TanStack Query cache.
 * Only updates aggregate counts, NOT the current user's own reaction state.
 * 
 * Requirements: 4.3, 4.4
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSSE } from '../useSSE';
import { queryKeys } from '../../api/queryKeys';
import type { ReactionEventData, ReactionCounts } from '@debate-platform/shared';

interface ReactionsResponse {
  counts: ReactionCounts;
  userReactions: {
    agree: boolean;
    strongReasoning: boolean;
  } | null;
}

/**
 * Hook for subscribing to real-time reaction count updates.
 * Updates only the aggregate counts in the TanStack Query cache.
 * Does NOT update the current user's own reaction state from broadcasts (Requirement 4.4).
 * 
 * @param argumentId - The argument ID to subscribe to reaction updates for
 * @param token - Optional auth token (used for query key differentiation)
 * @returns Object with connection status
 * 
 * @example
 * ```tsx
 * const { isConnected } = useSSEReactions(argumentId, token);
 * ```
 */
export function useSSEReactions(argumentId: string, token?: string) {
  const queryClient = useQueryClient();

  // Handle incoming reaction events
  const handleReactionEvent = useCallback((eventData: ReactionEventData) => {
    // Only process events for this argument
    if (eventData.argumentId !== argumentId) return;

    // Use the auth-aware query key to match reactionsQueryOptions
    const queryKey = [...queryKeys.arguments.reactions(argumentId), token ? 'auth' : 'anon'] as const;

    queryClient.setQueryData<ReactionsResponse>(queryKey, (oldData) => {
      if (!oldData) {
        // If no existing data, create new with counts only (no user reactions)
        return {
          counts: eventData.counts,
          userReactions: null,
        };
      }

      // Only update counts, preserve userReactions (Requirement 4.4)
      // This ensures the current user's own reaction state is not affected by broadcasts
      return {
        ...oldData,
        counts: eventData.counts,
      };
    });
  }, [argumentId, token, queryClient]);

  // Subscribe to reaction events
  const { isConnected, connectionStatus } = useSSE<ReactionEventData>(
    'reaction',
    handleReactionEvent,
    [argumentId, token]
  );

  return {
    isConnected,
    connectionStatus,
  };
}
