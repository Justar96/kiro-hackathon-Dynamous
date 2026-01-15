import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, act, cleanup } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Feature: uiux-improvements
 * Property 30: Data Prefetch on Hover
 * 
 * For any debate link hovered for more than 100ms, the debate data SHALL be 
 * prefetched into the query cache.
 * 
 * Validates: Requirements 10.3
 */

// Import the hook
import { usePrefetch } from '../hooks/navigation/usePrefetch';

// Arbitrary for delay values (50ms to 500ms)
const delayArbitrary = fc.integer({ min: 50, max: 500 });

// Create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    ),
  };
}

describe('usePrefetch Property Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  /**
   * Property 30: Data Prefetch on Hover
   * Validates: Requirements 10.3
   */
  describe('Property 30: Data Prefetch on Hover', () => {
    it('prefetch should not start immediately for any delay value', () => {
      fc.assert(
        fc.property(delayArbitrary, (delay) => {
          const { queryClient, wrapper } = createWrapper();
          const mockPrefetchFn = vi.fn().mockResolvedValue(undefined);
          
          const { result, unmount } = renderHook(
            () => usePrefetch(mockPrefetchFn, { delay }),
            { wrapper }
          );
          
          // Trigger prefetch
          act(() => {
            result.current.prefetch();
          });
          
          // Should not have called prefetch yet
          expect(mockPrefetchFn).not.toHaveBeenCalled();
          expect(result.current.isPrefetching).toBe(false);
          
          unmount();
          queryClient.clear();
        }),
        { numRuns: 100 }
      );
    });

    it('prefetch should start after delay for any delay value', () => {
      fc.assert(
        fc.property(delayArbitrary, (delay) => {
          const { queryClient, wrapper } = createWrapper();
          const mockPrefetchFn = vi.fn().mockResolvedValue(undefined);
          
          const { result, unmount } = renderHook(
            () => usePrefetch(mockPrefetchFn, { delay }),
            { wrapper }
          );
          
          // Trigger prefetch
          act(() => {
            result.current.prefetch();
          });
          
          // Advance time past delay
          act(() => {
            vi.advanceTimersByTime(delay + 10);
          });
          
          // Should have called prefetch
          expect(mockPrefetchFn).toHaveBeenCalled();
          
          unmount();
          queryClient.clear();
        }),
        { numRuns: 100 }
      );
    });

    it('cancelPrefetch should prevent prefetch for any delay value', () => {
      fc.assert(
        fc.property(delayArbitrary, (delay) => {
          const { queryClient, wrapper } = createWrapper();
          const mockPrefetchFn = vi.fn().mockResolvedValue(undefined);
          
          const { result, unmount } = renderHook(
            () => usePrefetch(mockPrefetchFn, { delay }),
            { wrapper }
          );
          
          // Trigger prefetch
          act(() => {
            result.current.prefetch();
          });
          
          // Cancel before delay completes
          act(() => {
            vi.advanceTimersByTime(Math.max(1, delay - 10));
            result.current.cancelPrefetch();
          });
          
          // Advance past original delay
          act(() => {
            vi.advanceTimersByTime(20);
          });
          
          // Should NOT have called prefetch
          expect(mockPrefetchFn).not.toHaveBeenCalled();
          
          unmount();
          queryClient.clear();
        }),
        { numRuns: 100 }
      );
    });

    it('prefetchHandlers should trigger prefetch on mouseEnter', () => {
      fc.assert(
        fc.property(delayArbitrary, (delay) => {
          const { queryClient, wrapper } = createWrapper();
          const mockPrefetchFn = vi.fn().mockResolvedValue(undefined);
          
          const { result, unmount } = renderHook(
            () => usePrefetch(mockPrefetchFn, { delay }),
            { wrapper }
          );
          
          // Simulate mouseEnter
          act(() => {
            result.current.prefetchHandlers.onMouseEnter();
          });
          
          // Advance time past delay
          act(() => {
            vi.advanceTimersByTime(delay + 10);
          });
          
          // Should have called prefetch
          expect(mockPrefetchFn).toHaveBeenCalled();
          
          unmount();
          queryClient.clear();
        }),
        { numRuns: 100 }
      );
    });

    it('prefetchHandlers should cancel prefetch on mouseLeave', () => {
      fc.assert(
        fc.property(delayArbitrary, (delay) => {
          const { queryClient, wrapper } = createWrapper();
          const mockPrefetchFn = vi.fn().mockResolvedValue(undefined);
          
          const { result, unmount } = renderHook(
            () => usePrefetch(mockPrefetchFn, { delay }),
            { wrapper }
          );
          
          // Simulate mouseEnter then mouseLeave
          act(() => {
            result.current.prefetchHandlers.onMouseEnter();
          });
          
          act(() => {
            vi.advanceTimersByTime(Math.max(1, delay / 2));
            result.current.prefetchHandlers.onMouseLeave();
          });
          
          // Advance past original delay
          act(() => {
            vi.advanceTimersByTime(delay);
          });
          
          // Should NOT have called prefetch
          expect(mockPrefetchFn).not.toHaveBeenCalled();
          
          unmount();
          queryClient.clear();
        }),
        { numRuns: 100 }
      );
    });

    it('should not prefetch again if already prefetched', () => {
      fc.assert(
        fc.property(delayArbitrary, (delay) => {
          const { queryClient, wrapper } = createWrapper();
          const mockPrefetchFn = vi.fn().mockResolvedValue(undefined);
          
          const { result, unmount } = renderHook(
            () => usePrefetch(mockPrefetchFn, { delay }),
            { wrapper }
          );
          
          // First prefetch
          act(() => {
            result.current.prefetch();
          });
          
          act(() => {
            vi.advanceTimersByTime(delay + 10);
          });
          
          expect(mockPrefetchFn).toHaveBeenCalledTimes(1);
          
          // Try to prefetch again
          act(() => {
            result.current.prefetch();
          });
          
          act(() => {
            vi.advanceTimersByTime(delay + 10);
          });
          
          // Should still only have been called once
          expect(mockPrefetchFn).toHaveBeenCalledTimes(1);
          
          unmount();
          queryClient.clear();
        }),
        { numRuns: 100 }
      );
    });

    it('default delay should be 100ms', () => {
      fc.assert(
        fc.property(fc.boolean(), () => {
          const { queryClient, wrapper } = createWrapper();
          const mockPrefetchFn = vi.fn().mockResolvedValue(undefined);
          
          const { result, unmount } = renderHook(
            () => usePrefetch(mockPrefetchFn), // No options - use default
            { wrapper }
          );
          
          // Trigger prefetch
          act(() => {
            result.current.prefetch();
          });
          
          // At 99ms, should not have prefetched
          act(() => {
            vi.advanceTimersByTime(99);
          });
          expect(mockPrefetchFn).not.toHaveBeenCalled();
          
          // At 101ms, should have prefetched
          act(() => {
            vi.advanceTimersByTime(2);
          });
          expect(mockPrefetchFn).toHaveBeenCalled();
          
          unmount();
          queryClient.clear();
        }),
        { numRuns: 100 }
      );
    });
  });
});
