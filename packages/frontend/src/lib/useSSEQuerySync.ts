/**
 * useSSEQuerySync Hook
 * 
 * Generic hook for syncing SSE events with TanStack Query cache.
 * Provides a unified way to handle cache updates from SSE events.
 * 
 * Requirements: 9.1, 9.6
 */

import { useCallback, useRef, useState } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useSSE, type SSEConnectionStatus } from './useSSE';
import type { SSEEventType } from '@debate-platform/shared';

// ============================================================================
// Types
// ============================================================================

export interface UseSSEQuerySyncOptions<TData, TEventData = unknown> {
  /**
   * The SSE event type to subscribe to
   */
  eventType: SSEEventType;
  
  /**
   * The TanStack Query key to update
   */
  queryKey: QueryKey;
  
  /**
   * Function to update the cache data with the event data
   * @param oldData - Current cached data (may be undefined)
   * @param eventData - Data from the SSE event
   * @returns Updated data to store in cache
   */
  updateFn: (oldData: TData | undefined, eventData: TEventData) => TData;
  
  /**
   * Optional predicate to determine if the cache should be updated
   * @param eventData - Data from the SSE event
   * @param currentData - Current cached data
   * @returns true if cache should be updated
   */
  shouldUpdate?: (eventData: TEventData, currentData: TData | undefined) => boolean;
  
  /**
   * Optional callback fired after a successful cache update
   * @param eventData - Data from the SSE event
   */
  onUpdate?: (eventData: TEventData) => void;
  
  /**
   * Optional callback fired when an error occurs during cache update
   * @param error - The error that occurred
   * @param eventData - Data from the SSE event
   */
  onError?: (error: Error, eventData: TEventData) => void;
}

export interface UseSSEQuerySyncResult {
  /**
   * Whether the SSE connection is currently connected
   */
  isConnected: boolean;
  
  /**
   * Current connection status
   */
  connectionStatus: SSEConnectionStatus;
  
  /**
   * Timestamp of the last successful cache update
   */
  lastUpdate: Date | null;
  
  /**
   * Number of updates received
   */
  updateCount: number;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for syncing SSE events with TanStack Query cache.
 * 
 * @example
 * ```tsx
 * const { isConnected, lastUpdate } = useSSEQuerySync({
 *   eventType: 'market',
 *   queryKey: queryKeys.market.byDebate(debateId),
 *   updateFn: (oldData, eventData) => ({
 *     ...oldData,
 *     marketPrice: eventData,
 *   }),
 *   shouldUpdate: (eventData) => eventData.totalVotes > 0,
 * });
 * ```
 */
export function useSSEQuerySync<TData, TEventData = unknown>(
  options: UseSSEQuerySyncOptions<TData, TEventData>
): UseSSEQuerySyncResult {
  const { eventType, queryKey, updateFn, shouldUpdate, onUpdate, onError } = options;
  
  const queryClient = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [updateCount, setUpdateCount] = useState(0);
  
  // Use refs to avoid stale closures in the event handler
  const updateFnRef = useRef(updateFn);
  const shouldUpdateRef = useRef(shouldUpdate);
  const onUpdateRef = useRef(onUpdate);
  const onErrorRef = useRef(onError);
  
  // Keep refs up to date
  updateFnRef.current = updateFn;
  shouldUpdateRef.current = shouldUpdate;
  onUpdateRef.current = onUpdate;
  onErrorRef.current = onError;
  
  // Handle incoming SSE events
  const handleEvent = useCallback((eventData: TEventData) => {
    try {
      // Get current cached data
      const currentData = queryClient.getQueryData<TData>(queryKey);
      
      // Check if we should update (if predicate provided)
      if (shouldUpdateRef.current && !shouldUpdateRef.current(eventData, currentData)) {
        return;
      }
      
      // Update the cache using setQueryData (Requirement 9.1)
      queryClient.setQueryData<TData>(queryKey, (oldData) => {
        return updateFnRef.current(oldData, eventData);
      });
      
      // Update state
      setLastUpdate(new Date());
      setUpdateCount((count) => count + 1);
      
      // Fire callback if provided
      onUpdateRef.current?.(eventData);
    } catch (error) {
      // Handle cache update failures (Requirement 12.2)
      console.error(`[useSSEQuerySync] Cache update failed for ${eventType}:`, error);
      
      // Fire error callback if provided
      if (onErrorRef.current && error instanceof Error) {
        onErrorRef.current(error, eventData);
      }
      
      // Trigger full query invalidation as fallback
      queryClient.invalidateQueries({ queryKey });
    }
  }, [queryClient, queryKey, eventType]);
  
  // Subscribe to SSE events
  const { isConnected, connectionStatus } = useSSE<TEventData>(
    eventType,
    handleEvent,
    [queryKey.join(',')]
  );
  
  return {
    isConnected,
    connectionStatus,
    lastUpdate,
    updateCount,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Helper to create a shallow merge update function
 * Preserves existing fields not present in the event data (Requirement 9.3)
 */
export function createShallowMergeUpdater<TData extends object>() {
  return (oldData: TData | undefined, eventData: Partial<TData>): TData => {
    if (!oldData) {
      return eventData as TData;
    }
    return { ...oldData, ...eventData };
  };
}

/**
 * Helper to create a deep merge update function for nested objects
 * Preserves nested fields not present in the event data (Requirement 9.3)
 */
export function createDeepMergeUpdater<TData extends Record<string, unknown>>(
  path: string[]
) {
  return (oldData: TData | undefined, eventData: unknown): TData => {
    if (!oldData) {
      // Can't deep merge without existing data
      return oldData as unknown as TData;
    }
    
    // Navigate to the nested path and update
    const result = { ...oldData } as Record<string, unknown>;
    let current: Record<string, unknown> = result;
    
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      current[key] = { ...(current[key] as object) };
      current = current[key] as Record<string, unknown>;
    }
    
    const lastKey = path[path.length - 1];
    if (typeof current[lastKey] === 'object' && current[lastKey] !== null) {
      current[lastKey] = { ...(current[lastKey] as object), ...(eventData as object) };
    } else {
      current[lastKey] = eventData;
    }
    
    return result as TData;
  };
}

/**
 * Helper to check if data has changed (for shouldUpdate predicate)
 * Uses shallow comparison to prevent unnecessary updates (Requirement 9.4)
 */
export function hasDataChanged<T extends object>(
  eventData: T,
  currentData: T | undefined,
  keys?: (keyof T)[]
): boolean {
  if (!currentData) return true;
  
  const keysToCheck = keys || (Object.keys(eventData) as (keyof T)[]);
  
  return keysToCheck.some((key) => eventData[key] !== currentData[key]);
}
