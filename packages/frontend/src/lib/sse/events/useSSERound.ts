/**
 * useSSERound Hook
 * 
 * Subscribes to real-time round transition updates via SSE and syncs with TanStack Query cache.
 * Triggers toast notifications on round transitions.
 * 
 * Requirements: 5.3, 5.4, 5.6
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSSE } from '../useSSE';
import { queryKeys } from '../../api/queryKeys';
import { useToastOptional } from '../../../components/common/Toast';
import type { RoundEventData, Debate, Round, Argument } from '@thesis/shared';

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
  
  // Fix: Add ref for timeout cleanup to prevent memory leaks
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get toast context (returns null if ToastProvider is not present)
  const toast = useToastOptional();

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

        // Fix: Clear any existing timeout before setting new one
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
        }

        // Clear transition after animation duration
        transitionTimeoutRef.current = setTimeout(() => {
          setRoundTransition(null);
        }, 3000);
      }

      return {
        ...oldData,
        debate: updatedDebate,
      };
    });

    // Show toast notification (Requirement 5.4)
    if (toast) {
      if (eventData.status === 'concluded') {
        // Debate concluded notification (Requirement 5.6)
        toast.showToast({
          type: 'info',
          message: 'The debate has concluded. View the final results.',
          duration: 5000,
        });
      } else {
        // Round transition notification (Requirement 5.4)
        toast.showToast({
          type: 'info',
          message: `Round ${eventData.newRoundNumber} has begun`,
          duration: 3000,
        });
      }
    }
  }, [debateId, token, queryClient, toast]);

  // Fix: Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

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
