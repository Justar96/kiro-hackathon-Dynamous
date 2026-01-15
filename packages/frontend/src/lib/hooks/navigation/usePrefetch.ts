/**
 * Prefetch Hook
 * 
 * Generic hook for prefetching any query on hover.
 * Prefetches data after a configurable delay to avoid unnecessary requests.
 * 
 * Requirements: 10.3
 */

import { useCallback, useRef, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { debateFullQueryOptions } from '../../api';

/**
 * Options for prefetch behavior
 */
export interface UsePrefetchOptions {
  /**
   * Delay in milliseconds before prefetching starts (default: 100ms)
   */
  delay?: number;

  /**
   * How long the prefetched data should be considered fresh (default: 5 minutes)
   */
  staleTime?: number;
}

/**
 * Default options for prefetch
 */
const DEFAULT_OPTIONS: Required<UsePrefetchOptions> = {
  delay: 100,
  staleTime: 1000 * 60 * 5, // 5 minutes
};

/**
 * Hook specifically for prefetching debate data on hover.
 * Prefetches full debate details (including debaters and market) after 100ms hover delay.
 *
 * @param debateId - The ID of the debate to prefetch
 * @param options - Configuration options for prefetch behavior
 * @returns Object with prefetch trigger functions and state
 */
export function usePrefetchDebate(debateId: string, options: UsePrefetchOptions = {}) {
  const queryClient = useQueryClient();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPrefetched, setIsPrefetched] = useState(false);
  const [isPrefetching, setIsPrefetching] = useState(false);

  // Use refs for state checks inside callbacks to avoid dependency changes
  const isPrefetchedRef = useRef(isPrefetched);
  const isPrefetchingRef = useRef(isPrefetching);
  isPrefetchedRef.current = isPrefetched;
  isPrefetchingRef.current = isPrefetching;

  // Memoize options to prevent object recreation on every render
  const mergedOptions = useMemo(() => ({ ...DEFAULT_OPTIONS, ...options }), [options.delay, options.staleTime]);

  // Memoize query options to prevent object recreation on every render
  const queryOptions = useMemo(() => debateFullQueryOptions(debateId), [debateId]);

  // Memoize query key for stable reference
  const queryKey = queryOptions.queryKey;

  /**
   * Start prefetching after delay
   */
  const prefetch = useCallback(() => {
    // Don't prefetch if already prefetched or prefetching (using refs for current value)
    if (isPrefetchedRef.current || isPrefetchingRef.current) {
      return;
    }

    // Check if data is already in cache and fresh
    const existingData = queryClient.getQueryData(queryKey);
    if (existingData) {
      setIsPrefetched(true);
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Start prefetch after delay
    timeoutRef.current = setTimeout(async () => {
      setIsPrefetching(true);

      try {
        await queryClient.prefetchQuery({
          ...queryOptions,
          staleTime: mergedOptions.staleTime,
        });
        setIsPrefetched(true);
      } catch {
        // Silently fail - prefetch is best-effort
      } finally {
        setIsPrefetching(false);
      }
    }, mergedOptions.delay);
  }, [queryClient, queryKey, queryOptions, mergedOptions.delay, mergedOptions.staleTime]);
  
  /**
   * Cancel pending prefetch
   */
  const cancelPrefetch = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  
  /**
   * Reset prefetch state (useful when query key changes)
   */
  const reset = useCallback(() => {
    cancelPrefetch();
    setIsPrefetched(false);
    setIsPrefetching(false);
  }, [cancelPrefetch]);
  
  /**
   * Event handlers for hover-based prefetching
   */
  const prefetchHandlers = {
    onMouseEnter: prefetch,
    onMouseLeave: cancelPrefetch,
    onFocus: prefetch,
    onBlur: cancelPrefetch,
  };
  
  return {
    prefetch,
    cancelPrefetch,
    reset,
    isPrefetched,
    isPrefetching,
    prefetchHandlers,
  };
}

/**
 * Generic hook for prefetching any query on hover.
 * Prefetches data after a configurable delay to avoid unnecessary requests.
 * 
 * @param prefetchFn - Function that performs the prefetch
 * @param options - Configuration options for prefetch behavior
 * @returns Object with prefetch trigger functions and state
 */
export function usePrefetch(
  prefetchFn: () => Promise<void>,
  options: UsePrefetchOptions = {}
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPrefetched, setIsPrefetched] = useState(false);
  const [isPrefetching, setIsPrefetching] = useState(false);
  
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  /**
   * Start prefetching after delay
   */
  const prefetch = useCallback(() => {
    // Don't prefetch if already prefetched or prefetching
    if (isPrefetched || isPrefetching) {
      return;
    }
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Start prefetch after delay
    timeoutRef.current = setTimeout(async () => {
      setIsPrefetching(true);
      
      try {
        await prefetchFn();
        setIsPrefetched(true);
      } catch {
        // Silently fail - prefetch is best-effort
      } finally {
        setIsPrefetching(false);
      }
    }, mergedOptions.delay);
  }, [prefetchFn, mergedOptions.delay, isPrefetched, isPrefetching]);
  
  /**
   * Cancel pending prefetch
   */
  const cancelPrefetch = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  
  /**
   * Reset prefetch state
   */
  const reset = useCallback(() => {
    cancelPrefetch();
    setIsPrefetched(false);
    setIsPrefetching(false);
  }, [cancelPrefetch]);
  
  /**
   * Event handlers for hover-based prefetching
   */
  const prefetchHandlers = {
    onMouseEnter: prefetch,
    onMouseLeave: cancelPrefetch,
    onFocus: prefetch,
    onBlur: cancelPrefetch,
  };
  
  return {
    prefetch,
    cancelPrefetch,
    reset,
    isPrefetched,
    isPrefetching,
    prefetchHandlers,
  };
}

/**
 * Hook that returns props to spread on a link element for prefetch on hover.
 * 
 * @param debateId - The ID of the debate to prefetch
 * @param options - Configuration options for prefetch behavior
 * @returns Props object to spread on link element
 */
export function useDebateLinkPrefetch(debateId: string, options: UsePrefetchOptions = {}) {
  const { prefetchHandlers, isPrefetched, isPrefetching } = usePrefetchDebate(debateId, options);
  
  return {
    ...prefetchHandlers,
    'data-prefetched': isPrefetched ? 'true' : undefined,
    'data-prefetching': isPrefetching ? 'true' : undefined,
  };
}
