import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, cleanup } from '@testing-library/react';

/**
 * Feature: uiux-improvements
 * Property 31: Unsaved Changes Warning
 * 
 * For any navigation attempt from a form with unsaved changes, a confirmation 
 * dialog SHALL appear before navigation proceeds.
 * 
 * Validates: Requirements 10.4
 */

// Mock TanStack Router's useBlocker
vi.mock('@tanstack/react-router', () => ({
  useBlocker: () => ({}),
}));

// Import after mocking
import { useUnsavedChangesControl } from './useUnsavedChanges';

// Arbitrary for custom messages
const messageArbitrary = fc.string({ minLength: 1, maxLength: 200 })
  .filter(s => !s.includes('\0')); // Filter out null characters

describe('useUnsavedChanges Property Tests', () => {
  let originalConfirm: typeof window.confirm;
  let mockConfirm: ReturnType<typeof vi.fn>;
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;
  
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    
    // Mock window.confirm
    originalConfirm = window.confirm;
    mockConfirm = vi.fn();
    window.confirm = mockConfirm;
    
    // Spy on addEventListener/removeEventListener
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    cleanup();
    window.confirm = originalConfirm;
    vi.restoreAllMocks();
  });

  /**
   * Property 31: Unsaved Changes Warning
   * Validates: Requirements 10.4
   */
  describe('Property 31: Unsaved Changes Warning', () => {
    it('confirmNavigation should return true when no changes exist', () => {
      fc.assert(
        fc.property(fc.boolean(), () => {
          const { result, unmount } = renderHook(() => 
            useUnsavedChangesControl(false)
          );
          
          const shouldProceed = result.current.confirmNavigation();
          
          // Should allow navigation without confirmation
          expect(shouldProceed).toBe(true);
          expect(mockConfirm).not.toHaveBeenCalled();
          
          unmount();
        }),
        { numRuns: 100 }
      );
    });

    it('confirmNavigation should show confirm dialog when changes exist', () => {
      fc.assert(
        fc.property(fc.boolean(), (confirmResult) => {
          mockConfirm.mockReturnValue(confirmResult);
          
          const { result, unmount } = renderHook(() => 
            useUnsavedChangesControl(true)
          );
          
          const shouldProceed = result.current.confirmNavigation();
          
          // Should show confirmation dialog
          expect(mockConfirm).toHaveBeenCalled();
          // Result should match user's choice
          expect(shouldProceed).toBe(confirmResult);
          
          unmount();
          mockConfirm.mockReset();
        }),
        { numRuns: 100 }
      );
    });

    it('should use custom message when provided', () => {
      fc.assert(
        fc.property(messageArbitrary, (customMessage) => {
          mockConfirm.mockReturnValue(true);
          
          const { result, unmount } = renderHook(() => 
            useUnsavedChangesControl(true, { message: customMessage })
          );
          
          result.current.confirmNavigation();
          
          // Should use custom message
          expect(mockConfirm).toHaveBeenCalledWith(customMessage);
          expect(result.current.message).toBe(customMessage);
          
          unmount();
          mockConfirm.mockReset();
        }),
        { numRuns: 100 }
      );
    });

    it('should register beforeunload handler when warnOnUnload is true', () => {
      fc.assert(
        fc.property(fc.boolean(), () => {
          addEventListenerSpy.mockClear();
          
          const { unmount } = renderHook(() => 
            useUnsavedChangesControl(true, { warnOnUnload: true })
          );
          
          // Should have registered beforeunload handler
          expect(addEventListenerSpy).toHaveBeenCalledWith(
            'beforeunload',
            expect.any(Function)
          );
          
          unmount();
        }),
        { numRuns: 100 }
      );
    });

    it('should not register beforeunload handler when warnOnUnload is false', () => {
      fc.assert(
        fc.property(fc.boolean(), () => {
          addEventListenerSpy.mockClear();
          
          const { unmount } = renderHook(() => 
            useUnsavedChangesControl(true, { warnOnUnload: false })
          );
          
          // Should NOT have registered beforeunload handler
          const beforeUnloadCalls = addEventListenerSpy.mock.calls.filter(
            call => call[0] === 'beforeunload'
          );
          expect(beforeUnloadCalls.length).toBe(0);
          
          unmount();
        }),
        { numRuns: 100 }
      );
    });

    it('should cleanup beforeunload handler on unmount', () => {
      fc.assert(
        fc.property(fc.boolean(), () => {
          removeEventListenerSpy.mockClear();
          
          const { unmount } = renderHook(() => 
            useUnsavedChangesControl(true, { warnOnUnload: true })
          );
          
          unmount();
          
          // Should have removed beforeunload handler
          expect(removeEventListenerSpy).toHaveBeenCalledWith(
            'beforeunload',
            expect.any(Function)
          );
        }),
        { numRuns: 100 }
      );
    });

    it('hasChanges should reflect the input value', () => {
      fc.assert(
        fc.property(fc.boolean(), (hasChanges) => {
          const { result, unmount } = renderHook(() => 
            useUnsavedChangesControl(hasChanges)
          );
          
          expect(result.current.hasChanges).toBe(hasChanges);
          
          unmount();
        }),
        { numRuns: 100 }
      );
    });

    it('should update hasChanges when prop changes', () => {
      fc.assert(
        fc.property(fc.boolean(), fc.boolean(), (initial, updated) => {
          const { result, rerender, unmount } = renderHook(
            ({ hasChanges }) => useUnsavedChangesControl(hasChanges),
            { initialProps: { hasChanges: initial } }
          );
          
          expect(result.current.hasChanges).toBe(initial);
          
          rerender({ hasChanges: updated });
          
          expect(result.current.hasChanges).toBe(updated);
          
          unmount();
        }),
        { numRuns: 100 }
      );
    });
  });
});
