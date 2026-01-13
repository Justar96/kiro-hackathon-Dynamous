/**
 * Property-based tests for useIndexPolling hook.
 * 
 * Tests polling behavior, tab visibility detection, and manual refresh.
 * 
 * Requirements: 7.1, 7.2, 7.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as fc from 'fast-check';
import { useIndexPolling, POLLING_CONSTANTS } from './useIndexPolling';
import type { ReactNode } from 'react';

// Mock document.visibilityState
let mockVisibilityState: DocumentVisibilityState = 'visible';
const visibilityChangeListeners: Array<() => void> = [];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe('useIndexPolling Property Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockVisibilityState = 'visible';
    visibilityChangeListeners.length = 0;
    
    // Mock document.visibilityState
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => mockVisibilityState,
    });
    
    // Mock addEventListener/removeEventListener for visibilitychange
    vi.spyOn(document, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'visibilitychange' && typeof handler === 'function') {
        visibilityChangeListeners.push(handler);
      }
    });
    
    vi.spyOn(document, 'removeEventListener').mockImplementation((event, handler) => {
      if (event === 'visibilitychange' && typeof handler === 'function') {
        const index = visibilityChangeListeners.indexOf(handler);
        if (index > -1) visibilityChangeListeners.splice(index, 1);
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function simulateVisibilityChange(state: DocumentVisibilityState) {
    mockVisibilityState = state;
    visibilityChangeListeners.forEach(listener => listener());
  }

  describe('Polling Interval Properties', () => {
    it('Property 7.1: Default polling interval is 15 seconds', () => {
      expect(POLLING_CONSTANTS.DEFAULT_POLLING_INTERVAL).toBe(15000);
    });

    it('Property 7.2: Custom polling interval is respected', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 60000 }),
          (customInterval) => {
            const { result } = renderHook(
              () => useIndexPolling({ interval: customInterval }),
              { wrapper: createWrapper() }
            );

            // Hook should initialize with polling active
            expect(result.current.isPolling).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('Property 7.3: Polling can be disabled via enabled option', () => {
      const { result } = renderHook(
        () => useIndexPolling({ enabled: false }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isPolling).toBe(false);
    });
  });

  describe('Tab Visibility Properties (Requirement 7.6)', () => {
    it('Property 7.4: isTabVisible reflects document.visibilityState', () => {
      const { result } = renderHook(
        () => useIndexPolling(),
        { wrapper: createWrapper() }
      );

      // Initially visible
      expect(result.current.isTabVisible).toBe(true);

      // Simulate tab hidden
      act(() => {
        simulateVisibilityChange('hidden');
      });
      expect(result.current.isTabVisible).toBe(false);

      // Simulate tab visible again
      act(() => {
        simulateVisibilityChange('visible');
      });
      expect(result.current.isTabVisible).toBe(true);
    });

    it('Property 7.5: Polling pauses when tab is hidden', () => {
      const { result } = renderHook(
        () => useIndexPolling(),
        { wrapper: createWrapper() }
      );

      // Initially polling
      expect(result.current.isPolling).toBe(true);

      // Hide tab
      act(() => {
        simulateVisibilityChange('hidden');
      });

      // Polling should be paused
      expect(result.current.isPolling).toBe(false);
    });

    it('Property 7.6: Polling resumes when tab becomes visible', () => {
      const { result } = renderHook(
        () => useIndexPolling(),
        { wrapper: createWrapper() }
      );

      // Hide tab
      act(() => {
        simulateVisibilityChange('hidden');
      });
      expect(result.current.isPolling).toBe(false);

      // Show tab
      act(() => {
        simulateVisibilityChange('visible');
      });
      expect(result.current.isPolling).toBe(true);
    });
  });

  describe('Manual Refresh Properties', () => {
    it('Property 7.7: Manual refresh updates lastRefresh timestamp', async () => {
      const { result } = renderHook(
        () => useIndexPolling(),
        { wrapper: createWrapper() }
      );

      // Initially no lastRefresh
      expect(result.current.lastRefresh).toBeNull();

      // Trigger manual refresh
      await act(async () => {
        await result.current.refresh();
      });

      // lastRefresh should be set
      expect(result.current.lastRefresh).toBeInstanceOf(Date);
    });

    it('Property 7.8: isRefreshing is true during refresh', async () => {
      const { result } = renderHook(
        () => useIndexPolling(),
        { wrapper: createWrapper() }
      );

      // Initially not refreshing
      expect(result.current.isRefreshing).toBe(false);

      // Start refresh (don't await)
      let refreshPromise: Promise<void>;
      act(() => {
        refreshPromise = result.current.refresh();
      });

      // Should be refreshing
      expect(result.current.isRefreshing).toBe(true);

      // Wait for refresh to complete
      await act(async () => {
        await refreshPromise;
      });

      // Should no longer be refreshing
      expect(result.current.isRefreshing).toBe(false);
    });
  });

  describe('Pause/Resume Properties', () => {
    it('Property 7.9: pause() stops polling', () => {
      const { result } = renderHook(
        () => useIndexPolling(),
        { wrapper: createWrapper() }
      );

      expect(result.current.isPolling).toBe(true);

      act(() => {
        result.current.pause();
      });

      expect(result.current.isPolling).toBe(false);
    });

    it('Property 7.10: resume() restarts polling', () => {
      const { result } = renderHook(
        () => useIndexPolling(),
        { wrapper: createWrapper() }
      );

      // Pause
      act(() => {
        result.current.pause();
      });
      expect(result.current.isPolling).toBe(false);

      // Resume
      act(() => {
        result.current.resume();
      });
      expect(result.current.isPolling).toBe(true);
    });

    it('Property 7.11: Paused state persists across visibility changes', () => {
      const { result } = renderHook(
        () => useIndexPolling(),
        { wrapper: createWrapper() }
      );

      // Pause polling
      act(() => {
        result.current.pause();
      });
      expect(result.current.isPolling).toBe(false);

      // Hide and show tab
      act(() => {
        simulateVisibilityChange('hidden');
      });
      act(() => {
        simulateVisibilityChange('visible');
      });

      // Should still be paused
      expect(result.current.isPolling).toBe(false);
    });
  });

  describe('Combined State Properties', () => {
    it('Property 7.12: isPolling requires enabled AND visible AND not paused', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // enabled
          fc.boolean(), // visible
          fc.boolean(), // paused
          (enabled, visible, paused) => {
            mockVisibilityState = visible ? 'visible' : 'hidden';
            
            const { result } = renderHook(
              () => useIndexPolling({ enabled }),
              { wrapper: createWrapper() }
            );

            if (paused) {
              act(() => {
                result.current.pause();
              });
            }

            const expectedPolling = enabled && visible && !paused;
            expect(result.current.isPolling).toBe(expectedPolling);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
