/**
 * useSSESteelman Hook
 * 
 * Subscribes to real-time steelman status updates via SSE and syncs with TanStack Query cache.
 * Updates steelman status for the author when their steelman is reviewed.
 * 
 * Requirements: 10.4, 10.5, 10.6
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSSE } from '../useSSE';
import { queryKeys } from '../../api/queryKeys';
import type { SteelmanStatus } from '../../api/types';
import type { SteelmanEventData } from '@debate-platform/shared';

/**
 * Hook for subscribing to real-time steelman status updates.
 * Updates the TanStack Query cache when steelman events are received.
 * 
 * @param debateId - The debate ID to subscribe to steelman updates for
 * @param roundNumber - The round number to track steelman status for
 * @param currentUserId - Optional current user ID to filter relevant updates
 * @param token - Optional auth token (used for query key differentiation)
 * @returns Object with connection status
 * 
 * @example
 * ```tsx
 * const { isConnected } = useSSESteelman(debateId, roundNumber, userId, token);
 * ```
 */
export function useSSESteelman(
  debateId: string,
  roundNumber: number,
  currentUserId?: string,
  token?: string
) {
  const queryClient = useQueryClient();

  // Handle incoming steelman events
  const handleSteelmanEvent = useCallback((eventData: SteelmanEventData) => {
    // Only process events for the current round
    if (eventData.roundNumber !== roundNumber) return;

    // Update steelman status cache
    const queryKey = queryKeys.steelman.status(debateId, roundNumber);

    queryClient.setQueryData<SteelmanStatus>(queryKey, (oldData) => {
      if (!oldData) {
        // Create new status based on event
        return {
          canSubmit: eventData.status === 'approved',
          requiresSteelman: true,
          steelmanStatus: eventData.status,
          reason: eventData.status === 'rejected' ? eventData.rejectionReason : undefined,
          steelman: {
            id: eventData.steelmanId,
            content: '', // Content not included in event
            status: eventData.status,
            rejectionReason: eventData.rejectionReason || null,
          },
        };
      }

      // Update existing status
      const newStatus: SteelmanStatus = {
        ...oldData,
        steelmanStatus: eventData.status,
        // Enable argument submission when steelman is approved (Requirement 10.5)
        canSubmit: eventData.status === 'approved',
        // Include rejection reason if rejected (Requirement 10.6)
        reason: eventData.status === 'rejected' ? eventData.rejectionReason : oldData.reason,
        steelman: oldData.steelman ? {
          ...oldData.steelman,
          status: eventData.status,
          rejectionReason: eventData.rejectionReason || null,
        } : {
          id: eventData.steelmanId,
          content: '',
          status: eventData.status,
          rejectionReason: eventData.rejectionReason || null,
        },
      };

      return newStatus;
    });

    // Also invalidate pending steelmans query if this was a review action
    if (eventData.status === 'approved' || eventData.status === 'rejected') {
      queryClient.invalidateQueries({
        queryKey: queryKeys.steelman.pending(debateId),
      });
    }
  }, [debateId, roundNumber, queryClient]);

  // Subscribe to steelman events
  const { isConnected, connectionStatus } = useSSE<SteelmanEventData>(
    'steelman',
    handleSteelmanEvent,
    [debateId, roundNumber, currentUserId, token]
  );

  return {
    isConnected,
    connectionStatus,
  };
}
