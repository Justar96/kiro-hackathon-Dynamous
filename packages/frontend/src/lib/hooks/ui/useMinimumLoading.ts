/**
 * Minimum Loading Hook
 * 
 * Hook to ensure loading states show for a minimum duration.
 * Prevents flash of loading content when data loads quickly.
 * 
 * Requirements: 4.6 - Show loading states for minimum 200ms
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook to ensure loading states show for a minimum duration.
 * Prevents flash of loading content when data loads quickly.
 * 
 * @param isLoading - The actual loading state from data fetching
 * @param minimumDuration - Minimum time to show loading state (default: 200ms)
 * @returns Object with showLoading state and reset function
 * 
 * @example
 * const { data, isLoading } = useQuery(...);
 * const { showLoading } = useMinimumLoading(isLoading);
 * 
 * if (showLoading) return <Skeleton />;
 * return <Content data={data} />;
 */
export function useMinimumLoading(
  isLoading: boolean,
  minimumDuration: number = 200
): {
  showLoading: boolean;
  reset: () => void;
} {
  // Track whether we should show loading state
  const [showLoading, setShowLoading] = useState(isLoading);
  
  // Track when loading started
  const loadingStartTimeRef = useRef<number | null>(null);
  
  // Track timeout for cleanup
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Track if we've ever started loading (to handle initial state)
  const hasStartedLoadingRef = useRef(false);

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (isLoading) {
      // Loading started
      if (!hasStartedLoadingRef.current) {
        hasStartedLoadingRef.current = true;
      }
      loadingStartTimeRef.current = Date.now();
      setShowLoading(true);
    } else if (hasStartedLoadingRef.current && loadingStartTimeRef.current !== null) {
      // Loading finished - check if minimum duration has passed
      const elapsed = Date.now() - loadingStartTimeRef.current;
      const remaining = minimumDuration - elapsed;

      if (remaining > 0) {
        // Need to wait before hiding loading state
        timeoutRef.current = setTimeout(() => {
          setShowLoading(false);
          loadingStartTimeRef.current = null;
        }, remaining);
      } else {
        // Minimum duration already passed
        setShowLoading(false);
        loadingStartTimeRef.current = null;
      }
    } else {
      // Never started loading or already finished
      setShowLoading(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isLoading, minimumDuration]);

  // Reset function for manual control
  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    loadingStartTimeRef.current = null;
    hasStartedLoadingRef.current = false;
    setShowLoading(false);
  }, []);

  return { showLoading, reset };
}

/**
 * Hook to wrap a query result with minimum loading duration.
 * Convenience wrapper for useMinimumLoading with query results.
 * 
 * Requirements: 4.6
 * 
 * @param queryResult - Result from useQuery hook
 * @param minimumDuration - Minimum time to show loading state (default: 200ms)
 * @returns Query result with showLoading replacing isLoading
 * 
 * @example
 * const query = useQuery(...);
 * const { data, showLoading, error } = useMinimumLoadingQuery(query);
 * 
 * if (showLoading) return <Skeleton />;
 * if (error) return <Error />;
 * return <Content data={data} />;
 */
export function useMinimumLoadingQuery<T extends { isLoading: boolean }>(
  queryResult: T,
  minimumDuration: number = 200
): Omit<T, 'isLoading'> & { showLoading: boolean; isLoading: boolean } {
  const { showLoading } = useMinimumLoading(queryResult.isLoading, minimumDuration);
  
  return {
    ...queryResult,
    showLoading,
    // Keep original isLoading for reference
    isLoading: queryResult.isLoading,
  };
}
