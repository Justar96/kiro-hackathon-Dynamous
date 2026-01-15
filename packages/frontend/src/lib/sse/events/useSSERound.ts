/**
 * useSSERound Hook
 * 
 * Subscribes to real-time round transition updates via SSE and syncs with TanStack Query cache.
 * Triggers toast notifications on round transitions.
 * 
 * Requirements: 5.3, 5.4, 5.6
 */

import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSSE } from '../useSSE';
import { queryKeys } from '../../api/queryKeys';
import { useToast } from '../../../components/common/Toast';
import type { RoundEventData, Debate, Round, Argument } from '@debate-platform/shared';

interface DebateDetailResponse {
  debate: Debate;
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

interface RoundTransition {
  from: number;
  to: number;
}

/**
 * Hook for subscribing to real-time round transition updates.
 * Updates the TanStack Query cache when round events are received.
 * Triggers toast notifications on round transitions (Requirement 5.4).
 * 
 * @param debateId - The debate ID to subscribe to round updates for
 * @param token - Optional auth token (used for query key differentiation)
 * @returns Object with connection status and round transition info
 * 
 * @example
 * ```tsx
 * const { isConnected, roundTransition } = useSSERound(debateId, token);
 * ```
 */
export function useSSERound(debateId: string, token?: string) {
  const queryClient = useQueryClient();
  const [roundTransition, setRoundTransition] = useState<RoundTransition | null>(null);
  
  // Use ref to track if toast context is available
  const toastRef = useRef<ReturnType<typeof useToast> | null>(null);
  
  // Try to get toast context (may not be available in all contexts)
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    toastRef.current = useToast();
  } catch {
    // Toast context not available, notifications will be skipped
    toastRef.current = null;
  }

  // Handle incoming round events
  const handleRoundEvent = useCallback((eventData: RoundEventData) => {
    // Use the auth-aware query key to match debateFullQueryOptions
    const queryKey = [...queryKeys.debates.full(debateId), token ? 'auth' : 'anon'] as const;

    queryClient.setQueryData<DebateDetailResponse | null>(queryKey, (oldData) => {
      if (!oldData) return oldData;

      const previousRound = oldData.debate.currentRound;

      // Update debate state with new round info
      const updatedDebate: Debate = {
        ...oldData.debate,
        currentRound: eventData.newRoundNumber,
        currentTurn: eventData.currentTurn,
        status: eventData.status === 'concluded' ? 'concluded' : 'active',
        concludedAt: eventData.status === 'concluded' ? new Date() : oldData.debate.concludedAt,
      };

      // Track round transition for UI feedback
      if (previousRound !== eventData.newRoundNumber) {
        setRoundTransition({
          from: previousRound,
          to: eventData.newRoundNumber,
        });

        // Clear transition after animation duration
        setTimeout(() => {
          setRoundTransition(null);
        }, 3000);
      }

      return {
        ...oldData,
        debate: updatedDebate,
      };
    });

    // Show toast notification (Requirement 5.4)
    if (toastRef.current) {
      if (eventData.status === 'concluded') {
        // Debate concluded notification (Requirement 5.6)
        toastRef.current.showToast({
          type: 'info',
          message: 'The debate has concluded. View the final results.',
          duration: 5000,
        });
      } else {
        // Round transition notification (Requirement 5.4)
        toastRef.current.showToast({
          type: 'info',
          message: `Round ${eventData.newRoundNumber} has begun`,
          duration: 3000,
        });
      }
    }
  }, [debateId, token, queryClient]);

  // Subscribe to round events
  const { isConnected, connectionStatus } = useSSE<RoundEventData>(
    'round',
    handleRoundEvent,
    [debateId, token]
  );

  return {
    isConnected,
    connectionStatus,
    roundTransition,
  };
}
