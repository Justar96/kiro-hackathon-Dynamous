import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, cleanup } from '@testing-library/react';

/**
 * Feature: uiux-improvements
 * Property 32: Modal URL Sync
 * 
 * For any modal open/close action, the URL SHALL update to reflect the modal 
 * state (e.g., ?modal=auth-sign-in).
 * 
 * Validates: Requirements 10.5
 */

// Mock location state
let mockPathname = '/test';
let mockSearch = '';

// Mock navigate function
const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({
    pathname: mockPathname,
    search: mockSearch,
  }),
  useNavigate: () => mockNavigate,
}));

// Import after mocking
import { useModalUrlState } from './useModalUrlSync';

// Arbitrary for modal IDs (alphanumeric)
const modalIdArbitrary = fc.stringMatching(/^[a-z][a-z0-9]*$/)
  .filter(s => s.length >= 2 && s.length <= 20);

// Arbitrary for sub-states
const subStateArbitrary = fc.stringMatching(/^[a-z][a-z0-9-]*$/)
  .filter(s => s.length >= 2 && s.length <= 20);

describe('useModalUrlSync Property Tests', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockPathname = '/test';
    mockSearch = '';
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 32: Modal URL Sync
   * Validates: Requirements 10.5
   */
  describe('Property 32: Modal URL Sync', () => {
    it('getUrlState should return isOpen: false when no modal param exists', () => {
      fc.assert(
        fc.property(modalIdArbitrary, (modalId) => {
          mockSearch = '';
          
          const { result, unmount } = renderHook(() => useModalUrlState(modalId));
          
          const state = result.current.getUrlState();
          
          expect(state.isOpen).toBe(false);
          expect(state.subState).toBeUndefined();
          
          unmount();
        }),
        { numRuns: 100 }
      );
    });

    it('getUrlState should return isOpen: true when modal param matches', () => {
      fc.assert(
        fc.property(modalIdArbitrary, (modalId) => {
          mockSearch = `?modal=${modalId}`;
          
          const { result, unmount } = renderHook(() => useModalUrlState(modalId));
          
          const state = result.current.getUrlState();
          
          expect(state.isOpen).toBe(true);
          
          unmount();
        }),
        { numRuns: 100 }
      );
    });

    it('getUrlState should return isOpen: false when modal param does not match', () => {
      fc.assert(
        fc.property(
          modalIdArbitrary,
          modalIdArbitrary.filter(s => s !== 'other'),
          (modalId, otherId) => {
            // Ensure they're different
            if (modalId === otherId) return;
            
            mockSearch = `?modal=${otherId}`;
            
            const { result, unmount } = renderHook(() => useModalUrlState(modalId));
            
            const state = result.current.getUrlState();
            
            expect(state.isOpen).toBe(false);
            
            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getUrlState should parse subState correctly', () => {
      fc.assert(
        fc.property(modalIdArbitrary, subStateArbitrary, (modalId, subState) => {
          mockSearch = `?modal=${modalId}-${subState}`;
          
          const { result, unmount } = renderHook(() => useModalUrlState(modalId));
          
          const state = result.current.getUrlState();
          
          expect(state.isOpen).toBe(true);
          expect(state.subState).toBe(subState);
          
          unmount();
        }),
        { numRuns: 100 }
      );
    });

    it('setUrlState should call navigate with modal param when opening', () => {
      fc.assert(
        fc.property(modalIdArbitrary, (modalId) => {
          mockSearch = '';
          mockNavigate.mockClear();
          
          const { result, unmount } = renderHook(() => useModalUrlState(modalId));
          
          result.current.setUrlState(true);
          
          expect(mockNavigate).toHaveBeenCalledWith({
            to: expect.stringContaining(`modal=${modalId}`),
            replace: true,
          });
          
          unmount();
        }),
        { numRuns: 100 }
      );
    });

    it('setUrlState should include subState in URL when provided', () => {
      fc.assert(
        fc.property(modalIdArbitrary, subStateArbitrary, (modalId, subState) => {
          mockSearch = '';
          mockNavigate.mockClear();
          
          const { result, unmount } = renderHook(() => useModalUrlState(modalId));
          
          result.current.setUrlState(true, subState);
          
          expect(mockNavigate).toHaveBeenCalledWith({
            to: expect.stringContaining(`modal=${modalId}-${subState}`),
            replace: true,
          });
          
          unmount();
        }),
        { numRuns: 100 }
      );
    });

    it('setUrlState should remove modal param when closing', () => {
      fc.assert(
        fc.property(modalIdArbitrary, (modalId) => {
          mockSearch = `?modal=${modalId}`;
          mockNavigate.mockClear();
          
          const { result, unmount } = renderHook(() => useModalUrlState(modalId));
          
          result.current.setUrlState(false);
          
          expect(mockNavigate).toHaveBeenCalledWith({
            to: mockPathname,
            replace: true,
          });
          
          unmount();
        }),
        { numRuns: 100 }
      );
    });

    it('clearUrlState should remove modal param', () => {
      fc.assert(
        fc.property(modalIdArbitrary, (modalId) => {
          mockSearch = `?modal=${modalId}`;
          mockNavigate.mockClear();
          
          const { result, unmount } = renderHook(() => useModalUrlState(modalId));
          
          result.current.clearUrlState();
          
          expect(mockNavigate).toHaveBeenCalledWith({
            to: mockPathname,
            replace: true,
          });
          
          unmount();
        }),
        { numRuns: 100 }
      );
    });

    it('setUrlState should preserve other query params', () => {
      fc.assert(
        fc.property(modalIdArbitrary, (modalId) => {
          mockSearch = '?other=value';
          mockNavigate.mockClear();
          
          const { result, unmount } = renderHook(() => useModalUrlState(modalId));
          
          result.current.setUrlState(true);
          
          // Should contain both the modal param and the other param
          const navigateCall = mockNavigate.mock.calls[0][0];
          expect(navigateCall.to).toContain(`modal=${modalId}`);
          expect(navigateCall.to).toContain('other=value');
          
          unmount();
        }),
        { numRuns: 100 }
      );
    });

    it('setUrlState should use pushState when replace is false', () => {
      fc.assert(
        fc.property(modalIdArbitrary, (modalId) => {
          mockSearch = '';
          mockNavigate.mockClear();
          
          const { result, unmount } = renderHook(() => useModalUrlState(modalId));
          
          result.current.setUrlState(true, undefined, false);
          
          expect(mockNavigate).toHaveBeenCalledWith({
            to: expect.any(String),
            replace: false,
          });
          
          unmount();
        }),
        { numRuns: 100 }
      );
    });
  });
});
