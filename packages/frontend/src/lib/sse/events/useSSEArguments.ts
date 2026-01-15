/**
 * useSSEArguments Hook
 * 
 * Subscribes to real-time argument submission updates via SSE and syncs with TanStack Query cache.
 * Handles deduplication for argument authors who see their own optimistic updates.
 * 
 * Requirements: 3.3, 3.4, 3.5
 */

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSSE } from '../useSSE';
import { queryKeys } from '../../api/queryKeys';
import type { ArgumentEventData, Side, RoundNumber, Argument, Round } from '@debate-platform/shared';

interface DebateDetailResponse {
  debate: {
    id: string;
    resolution: string;
    status: 'active' | 'concluded';
    currentRound: RoundNumber;
    currentTurn: Side;
    supportDebaterId: string;
    opposeDebaterId: string | null;
    createdAt: Date;
    concludedAt: Date | null;
  };
  rounds: (Round & {
    supportArgument: Argument | null;
    opposeArgument: Argument | null;
  })[];
  debaters?: {
    support: unknown | null;
    oppose: unknown | null;
  };
  market?: {
    marketPrice: unknown;
    history: unknown[];
    spikes: unknown[];
  } | null;
  marketBlocked?: boolean;
}

/**
 * Check if an argument ID is an optimistic ID (starts with 'optimistic-')
 * Used for deduplication (Requirement 3.5)
 */
function isOptimisticId(id: string): boolean {
  return id.startsWith('optimistic-');
}

/**
 * Hook for subscribing to real-time argument submission updates.
 * Updates the TanStack Query cache when argument events are received.
 * Handles deduplication for the argument author's optimistic updates.
 * 
 * @param debateId - The debate ID to subscribe to argument updates for
 * @param currentUserId - Optional current user ID for deduplication
 * @param token - Optional auth token (used for query key differentiation)
 * @returns Object with connection status and new argument ID
 * 
 * @example
 * ```tsx
 * const { isConnected, newArgumentId } = useSSEArguments(debateId, userId, token);
 * ```
 */
export function useSSEArguments(
  debateId: string,
  currentUserId?: string,
  token?: string
) {
  const queryClient = useQueryClient();
  const [newArgumentId, setNewArgumentId] = useState<string | null>(null);

  // Handle incoming argument events
  const handleArgumentEvent = useCallback((eventData: ArgumentEventData) => {
    // Use the auth-aware query key to match debateFullQueryOptions
    const queryKey = [...queryKeys.debates.full(debateId), token ? 'auth' : 'anon'] as const;

    queryClient.setQueryData<DebateDetailResponse | null>(queryKey, (oldData) => {
      if (!oldData) return oldData;

      // Find the round to update
      const roundIndex = oldData.rounds.findIndex(
        (r) => r.roundNumber === eventData.roundNumber
      );

      if (roundIndex === -1) return oldData;

      const round = oldData.rounds[roundIndex];
      const argumentKey = eventData.side === 'support' ? 'supportArgument' : 'opposeArgument';
      const existingArgument = round[argumentKey];

      // Deduplication check (Requirement 3.5):
      // If current user is the author and there's an optimistic argument, replace it
      const isAuthor = currentUserId === eventData.debaterId;
      const hasOptimisticArgument = existingArgument && isOptimisticId(existingArgument.id);

      // Skip if argument already exists with same ID (not optimistic)
      if (existingArgument && !hasOptimisticArgument && existingArgument.id === eventData.argumentId) {
        return oldData;
      }

      // If author has optimistic update, replace it; otherwise add new argument
      if (isAuthor && hasOptimisticArgument) {
        // Replace optimistic argument with real one
      } else if (existingArgument && !hasOptimisticArgument) {
        // Argument already exists and is not optimistic, skip
        return oldData;
      }

      // Create the new argument object
      const newArgument: Argument = {
        id: eventData.argumentId,
        roundId: round.id,
        debaterId: eventData.debaterId,
        side: eventData.side,
        content: eventData.content,
        impactScore: 0,
        createdAt: new Date(eventData.createdAt),
      };

      // Update the rounds array with the new argument
      const updatedRounds = [...oldData.rounds];
      updatedRounds[roundIndex] = {
        ...round,
        [argumentKey]: newArgument,
      };

      return {
        ...oldData,
        rounds: updatedRounds,
      };
    });

    // Track the new argument ID for highlight animation (Requirement 3.6)
    setNewArgumentId(eventData.argumentId);

    // Clear the new argument ID after animation duration
    setTimeout(() => {
      setNewArgumentId((current) => 
        current === eventData.argumentId ? null : current
      );
    }, 3000);
  }, [debateId, currentUserId, token, queryClient]);

  // Subscribe to argument events
  const { isConnected, connectionStatus } = useSSE<ArgumentEventData>(
    'argument',
    handleArgumentEvent,
    [debateId, currentUserId, token]
  );

  return {
    isConnected,
    connectionStatus,
    newArgumentId,
  };
}
