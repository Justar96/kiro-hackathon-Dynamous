import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast, ToastType } from './Toast';
import React from 'react';

/**
 * Feature: uiux-improvements
 * Toast Notification System Property Tests
 */

// Test component that exposes toast functions
function TestToastConsumer({ 
  onReady 
}: { 
  onReady: (fns: ReturnType<typeof useToast>) => void;
}) {
  const toastFns = useToast();
  // Call onReady once on mount
  React.useEffect(() => {
    onReady(toastFns);
  }, []);
  return null;
}

// Helper to render toast provider with consumer
function renderWithToastProvider() {
  let toastFns: ReturnType<typeof useToast> | null = null;
  
  const result = render(
    <ToastProvider>
      <TestToastConsumer onReady={(fns) => { toastFns = fns; }} />
    </ToastProvider>
  );
  
  return { ...result, getToastFns: () => toastFns! };
}

// Arbitrary for generating non-empty, non-whitespace toast messages
const messageArbitrary = fc.string({ minLength: 1, maxLength: 200 })
  .filter(s => s.trim().length > 0);

describe('Toast Property Tests', () => {
  beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  /**
   * Property 17: Success Toast Auto-Dismiss
   * For any success toast, it SHALL auto-dismiss after 3000ms (±100ms tolerance).
   * Validates: Requirements 6.2
   */
  describe('Property 17: Success Toast Auto-Dismiss', () => {
    it('Success toasts should auto-dismiss after 3000ms', () => {
      fc.assert(
        fc.property(messageArbitrary, (message) => {
          cleanup();
          vi.useFakeTimers();
          
          const { getToastFns } = renderWithToastProvider();
          const toastFns = getToastFns();
          
          // Show a success toast
          act(() => {
            toastFns.showToast({ type: 'success', message });
          });
          
          // Toast should be visible
          expect(screen.getByRole('alert')).toBeInTheDocument();
          
          // Advance time by 2900ms - toast should still be visible
          act(() => {
            vi.advanceTimersByTime(2900);
          });
          expect(screen.queryByRole('alert')).toBeInTheDocument();
          
          // Advance time to 3200ms (3000ms + 200ms for exit animation)
          act(() => {
            vi.advanceTimersByTime(300);
          });
          
          // Toast should be dismissed (or in exit animation)
          // After exit animation completes
          act(() => {
            vi.advanceTimersByTime(200);
          });
          
          expect(screen.queryByRole('alert')).not.toBeInTheDocument();
          
          vi.useRealTimers();
        }),
        { numRuns: 100 }
      );
    });

    it('Success toasts should dismiss at approximately 3000ms', () => {
      const { getToastFns } = renderWithToastProvider();
      const toastFns = getToastFns();
      
      act(() => {
        toastFns.showToast({ type: 'success', message: 'Test success' });
      });
      
      expect(screen.getByRole('alert')).toBeInTheDocument();
      
      // At 2999ms, toast should still be visible
      act(() => {
        vi.advanceTimersByTime(2999);
      });
      expect(screen.getByRole('alert')).toBeInTheDocument();
      
      // At 3000ms + animation time, toast should be gone
      act(() => {
        vi.advanceTimersByTime(201);
      });
      
      // Wait for exit animation
      act(() => {
        vi.advanceTimersByTime(200);
      });
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  /**
   * Property 18: Error Toast Persistence
   * For any error toast, it SHALL NOT auto-dismiss and SHALL remain visible 
   * until explicitly dismissed by the user.
   * Validates: Requirements 6.3
   */
  describe('Property 18: Error Toast Persistence', () => {
    it('Error toasts should NOT auto-dismiss', () => {
      fc.assert(
        fc.property(messageArbitrary, (message) => {
          cleanup();
          vi.useFakeTimers();
          
          const { getToastFns } = renderWithToastProvider();
          const toastFns = getToastFns();
          
          // Show an error toast
          act(() => {
            toastFns.showToast({ type: 'error', message });
          });
          
          // Toast should be visible
          expect(screen.getByRole('alert')).toBeInTheDocument();
          
          // Advance time significantly (10 seconds)
          act(() => {
            vi.advanceTimersByTime(10000);
          });
          
          // Error toast should STILL be visible
          expect(screen.getByRole('alert')).toBeInTheDocument();
          
          // Advance even more (1 minute)
          act(() => {
            vi.advanceTimersByTime(60000);
          });
          
          // Error toast should STILL be visible
          expect(screen.getByRole('alert')).toBeInTheDocument();
          
          vi.useRealTimers();
        }),
        { numRuns: 100 }
      );
    });

    it('Error toasts should only dismiss when explicitly dismissed', async () => {
      vi.useRealTimers(); // Use real timers for user interaction
      const user = userEvent.setup();
      
      const { getToastFns } = renderWithToastProvider();
      const toastFns = getToastFns();
      
      act(() => {
        toastFns.showToast({ type: 'error', message: 'Error message' });
      });
      
      expect(screen.getByRole('alert')).toBeInTheDocument();
      
      // Click dismiss button
      const dismissButton = screen.getByLabelText('Dismiss notification');
      await user.click(dismissButton);
      
      // Wait for exit animation
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  /**
   * Property 19: Toast Stack Limit
   * For any number of queued toasts, at most 3 SHALL be visible simultaneously,
   * with older toasts being dismissed first.
   * Validates: Requirements 6.4
   */
  describe('Property 19: Toast Stack Limit', () => {
    it('Should never show more than 3 toasts simultaneously', () => {
      fc.assert(
        fc.property(
          fc.array(messageArbitrary, { minLength: 1, maxLength: 10 }),
          (messages) => {
            cleanup();
            vi.useFakeTimers();
            
            const { getToastFns } = renderWithToastProvider();
            const toastFns = getToastFns();
            
            // Add all toasts
            act(() => {
              messages.forEach((message, index) => {
                toastFns.showToast({ 
                  type: 'error', // Use error so they don't auto-dismiss
                  message: `${message}-${index}` // Make unique
                });
              });
            });
            
            // Count visible toasts
            const alerts = screen.queryAllByRole('alert');
            
            // Should never exceed 3
            expect(alerts.length).toBeLessThanOrEqual(3);
            
            vi.useRealTimers();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Should remove oldest toasts when limit is exceeded (FIFO)', () => {
      const { getToastFns } = renderWithToastProvider();
      const toastFns = getToastFns();
      
      // Add 5 error toasts (they persist)
      act(() => {
        toastFns.showToast({ type: 'error', message: 'Toast 1' });
        toastFns.showToast({ type: 'error', message: 'Toast 2' });
        toastFns.showToast({ type: 'error', message: 'Toast 3' });
        toastFns.showToast({ type: 'error', message: 'Toast 4' });
        toastFns.showToast({ type: 'error', message: 'Toast 5' });
      });
      
      // Should only show 3 toasts
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBe(3);
      
      // Should show the 3 most recent (Toast 3, 4, 5)
      expect(screen.queryByText('Toast 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Toast 2')).not.toBeInTheDocument();
      expect(screen.getByText('Toast 3')).toBeInTheDocument();
      expect(screen.getByText('Toast 4')).toBeInTheDocument();
      expect(screen.getByText('Toast 5')).toBeInTheDocument();
    });

    it('Should maintain max 3 toasts across different types', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              message: messageArbitrary,
              type: fc.constantFrom('success', 'error', 'info') as fc.Arbitrary<ToastType>
            }),
            { minLength: 4, maxLength: 10 }
          ),
          (toasts) => {
            cleanup();
            vi.useFakeTimers();
            
            const { getToastFns } = renderWithToastProvider();
            const toastFns = getToastFns();
            
            // Add all toasts
            act(() => {
              toasts.forEach((toast, index) => {
                toastFns.showToast({ 
                  type: toast.type,
                  message: `${toast.message}-${index}`,
                  duration: null // Prevent auto-dismiss for this test
                });
              });
            });
            
            // Count visible toasts
            const alerts = screen.queryAllByRole('alert');
            
            // Should never exceed 3
            expect(alerts.length).toBeLessThanOrEqual(3);
            
            vi.useRealTimers();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
