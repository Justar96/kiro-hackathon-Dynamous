import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useMinimumLoading } from '../hooks/ui/useMinimumLoading';

/**
 * Feature: uiux-improvements
 * Property 14: Minimum Loading Duration
 * 
 * For any loading state, the skeleton/loading indicator SHALL be displayed 
 * for at least 200ms, even if data arrives sooner.
 * 
 * Validates: Requirements 4.6
 */

// Arbitrary for minimum duration values (50ms to 500ms)
const durationArbitrary = fc.integer({ min: 50, max: 500 });

// Arbitrary for time elapsed before loading completes (0ms to 1000ms)
const elapsedTimeArbitrary = fc.integer({ min: 0, max: 1000 });

describe('useMinimumLoading Property Tests', () => {
  beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  /**
   * Property 14: Minimum Loading Duration
   * Validates: Requirements 4.6
   */
  describe('Property 14: Minimum Loading Duration', () => {
    it('Loading state should show for at least the minimum duration', () => {
      fc.assert(
        fc.property(durationArbitrary, (minimumDuration) => {
          cleanup();
          vi.useFakeTimers();
          
          // Start with loading = true
          const { result, rerender } = renderHook(
            ({ isLoading }) => useMinimumLoading(isLoading, minimumDuration),
            { initialProps: { isLoading: true } }
          );
          
          // Should show loading initially
          expect(result.current.showLoading).toBe(true);
          
          // Complete loading immediately (0ms elapsed)
          rerender({ isLoading: false });
          
          // Should STILL show loading (minimum duration not reached)
          expect(result.current.showLoading).toBe(true);
          
          // Advance time to just before minimum duration
          act(() => {
            vi.advanceTimersByTime(minimumDuration - 1);
          });
          
          // Should STILL show loading
          expect(result.current.showLoading).toBe(true);
          
          // Advance past minimum duration
          act(() => {
            vi.advanceTimersByTime(2);
          });
          
          // Now should NOT show loading
          expect(result.current.showLoading).toBe(false);
          
          vi.useRealTimers();
        }),
        { numRuns: 100 }
      );
    });

    it('Loading state should hide immediately if minimum duration already passed', () => {
      fc.assert(
        fc.property(
          durationArbitrary,
          elapsedTimeArbitrary,
          (minimumDuration, elapsedTime) => {
            cleanup();
            vi.useFakeTimers();
            
            // Start with loading = true
            const { result, rerender } = renderHook(
              ({ isLoading }) => useMinimumLoading(isLoading, minimumDuration),
              { initialProps: { isLoading: true } }
            );
            
            // Should show loading initially
            expect(result.current.showLoading).toBe(true);
            
            // Advance time while still loading
            act(() => {
              vi.advanceTimersByTime(elapsedTime);
            });
            
            // Complete loading
            rerender({ isLoading: false });
            
            if (elapsedTime >= minimumDuration) {
              // If minimum duration already passed, should hide immediately
              expect(result.current.showLoading).toBe(false);
            } else {
              // If minimum duration not passed, should still show loading
              expect(result.current.showLoading).toBe(true);
              
              // Advance remaining time
              const remaining = minimumDuration - elapsedTime;
              act(() => {
                vi.advanceTimersByTime(remaining + 1);
              });
              
              // Now should hide
              expect(result.current.showLoading).toBe(false);
            }
            
            vi.useRealTimers();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Default minimum duration should be 200ms', () => {
      fc.assert(
        fc.property(fc.boolean(), () => {
          cleanup();
          vi.useFakeTimers();
          
          // Use default duration (200ms)
          const { result, rerender } = renderHook(
            ({ isLoading }) => useMinimumLoading(isLoading),
            { initialProps: { isLoading: true } }
          );
          
          // Complete loading immediately
          rerender({ isLoading: false });
          
          // Should still show loading
          expect(result.current.showLoading).toBe(true);
          
          // Advance to 199ms
          act(() => {
            vi.advanceTimersByTime(199);
          });
          expect(result.current.showLoading).toBe(true);
          
          // Advance past 200ms
          act(() => {
            vi.advanceTimersByTime(2);
          });
          expect(result.current.showLoading).toBe(false);
          
          vi.useRealTimers();
        }),
        { numRuns: 100 }
      );
    });

    it('Should track loading state correctly when loading starts false', () => {
      fc.assert(
        fc.property(durationArbitrary, (minimumDuration) => {
          cleanup();
          vi.useFakeTimers();
          
          // Start with loading = false
          const { result, rerender } = renderHook(
            ({ isLoading }) => useMinimumLoading(isLoading, minimumDuration),
            { initialProps: { isLoading: false } }
          );
          
          // Should NOT show loading initially
          expect(result.current.showLoading).toBe(false);
          
          // Start loading
          rerender({ isLoading: true });
          
          // Should show loading
          expect(result.current.showLoading).toBe(true);
          
          // Complete loading immediately
          rerender({ isLoading: false });
          
          // Should still show loading (minimum duration)
          expect(result.current.showLoading).toBe(true);
          
          // Advance past minimum duration
          act(() => {
            vi.advanceTimersByTime(minimumDuration + 1);
          });
          
          // Now should hide
          expect(result.current.showLoading).toBe(false);
          
          vi.useRealTimers();
        }),
        { numRuns: 100 }
      );
    });

    it('Reset function should clear loading state immediately', () => {
      fc.assert(
        fc.property(durationArbitrary, (minimumDuration) => {
          cleanup();
          vi.useFakeTimers();
          
          const { result, rerender } = renderHook(
            ({ isLoading }) => useMinimumLoading(isLoading, minimumDuration),
            { initialProps: { isLoading: true } }
          );
          
          // Complete loading
          rerender({ isLoading: false });
          
          // Should still show loading
          expect(result.current.showLoading).toBe(true);
          
          // Call reset
          act(() => {
            result.current.reset();
          });
          
          // Should immediately hide loading
          expect(result.current.showLoading).toBe(false);
          
          vi.useRealTimers();
        }),
        { numRuns: 100 }
      );
    });

    it('Multiple loading cycles should each respect minimum duration', () => {
      fc.assert(
        fc.property(
          durationArbitrary,
          fc.integer({ min: 2, max: 5 }),
          (minimumDuration, cycles) => {
            cleanup();
            vi.useFakeTimers();
            
            const { result, rerender } = renderHook(
              ({ isLoading }) => useMinimumLoading(isLoading, minimumDuration),
              { initialProps: { isLoading: false } }
            );
            
            for (let i = 0; i < cycles; i++) {
              // Reset for new cycle
              act(() => {
                result.current.reset();
              });
              
              // Start loading
              rerender({ isLoading: true });
              expect(result.current.showLoading).toBe(true);
              
              // Complete loading immediately
              rerender({ isLoading: false });
              
              // Should still show loading
              expect(result.current.showLoading).toBe(true);
              
              // Advance past minimum duration
              act(() => {
                vi.advanceTimersByTime(minimumDuration + 1);
              });
              
              // Should hide
              expect(result.current.showLoading).toBe(false);
            }
            
            vi.useRealTimers();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
