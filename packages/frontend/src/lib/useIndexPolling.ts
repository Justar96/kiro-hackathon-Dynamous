/**
 * useIndexPolling Hook
 * 
 * Provides polling functionality for the index page debate list.
 * Uses TanStack Query's refetchInterval with tab visibility detection.
 * 
 * Requirements: 7.1, 7.2, 7.6
 */

import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queries';

// Default polling interval: 15 seconds (Requirement 7.1)
const DEFAULT_POLLING_INTERVAL = 15000;

export interface UseIndexPollingOptions {
  /** Polling interval in milliseconds (default: 15000) */
  interval?: number;
  /** Whether polling is enabled (default: true) */
  enabled?: boolean;
}

export interface UseIndexPollingResult {
  /** Whether the tab is currently visible */
  isTabVisible: boolean;
  /** Whether polling is currently active */
  isPolling: boolean;
  /** Timestamp of the last successful refresh */
  lastRefresh: Date | null;
  /** Whether a refresh is currently in progress */
  isRefreshing: boolean;
  /** Manually trigger a refresh */
  refresh: () => Promise<void>;
  /** Pause polling */
  pause: () => void;
  /** Resume polling */
  resume: () => void;
}

/**
 * Hook for polling the index page debate list.
 * Automatically pauses when tab is hidden and resumes when visible.
 * 
 * @param options - Configuration options
 * @returns Polling state and controls
 * 
 * @example
 * ```tsx
 * const { isRefreshing, lastRefresh, refresh } = useIndexPolling();
 * 
 * return (
 *   <button onClick={refresh} disabled={isRefreshing}>
 *     {isRefreshing ? 'Refreshing...' : 'Refresh'}
 *   </button>
 * );
 * ```
 */
export function useIndexPolling(options: UseIndexPollingOptions = {}): UseIndexPollingResult {
  const { interval = DEFAULT_POLLING_INTERVAL, enabled = true } = options;
  
  const queryClient = useQueryClient();
  const [isTabVisible, setIsTabVisible] = useState(() => 
    typeof document !== 'undefined' ? document.visibilityState === 'visible' : true
  );
  const [isPaused, setIsPaused] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track tab visibility (Requirement 7.6)
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      setIsTabVisible(visible);
      
      // Immediately refresh when tab becomes visible after being hidden
      if (visible && enabled && !isPaused) {
        queryClient.invalidateQueries({ queryKey: queryKeys.debates.withMarket() });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [queryClient, enabled, isPaused]);

  // Polling interval (Requirement 7.1)
  useEffect(() => {
    if (!enabled || isPaused || !isTabVisible) return;

    const pollInterval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.withMarket() })
        .then(() => setLastRefresh(new Date()));
    }, interval);

    return () => clearInterval(pollInterval);
  }, [queryClient, interval, enabled, isPaused, isTabVisible]);

  // Manual refresh function (Requirement 7.5)
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: queryKeys.debates.withMarket() });
      setLastRefresh(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  // Pause/resume controls
  const pause = useCallback(() => setIsPaused(true), []);
  const resume = useCallback(() => setIsPaused(false), []);

  // Determine if polling is active
  const isPolling = enabled && !isPaused && isTabVisible;

  return {
    isTabVisible,
    isPolling,
    lastRefresh,
    isRefreshing,
    refresh,
    pause,
    resume,
  };
}

// Export constants for testing
export const POLLING_CONSTANTS = {
  DEFAULT_POLLING_INTERVAL,
};
