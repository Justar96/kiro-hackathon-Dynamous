import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, act, cleanup } from '@testing-library/react';

/**
 * Feature: uiux-improvements
 * Property 29: Deep Link Navigation
 * 
 * For any URL with a hash fragment (e.g., #round-2), the page SHALL scroll 
 * to the corresponding section on load.
 * 
 * Validates: Requirements 10.2
 */

// Mock location state
let mockHash = '';
let mockPathname = '/test';
let mockSearch = '';

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({
    hash: mockHash,
    pathname: mockPathname,
    search: mockSearch,
  }),
}));

// Import after mocking
import { useDeepLink } from '../hooks/navigation/useDeepLink';

// Arbitrary for valid element IDs (alphanumeric with hyphens)
const elementIdArbitrary = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9-]*$/)
  .filter(s => s.length >= 1 && s.length <= 50);

// Arbitrary for scroll offset values
const offsetArbitrary = fc.integer({ min: 0, max: 200 });

// Mock element positions
const mockElements: Map<string, { top: number; height: number }> = new Map();

// Mock scroll position
let mockScrollY = 0;

describe('useDeepLink Property Tests', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockHash = '';
    mockPathname = '/test';
    mockSearch = '';
    mockScrollY = 0;
    mockElements.clear();
    
    // Mock window.scrollY
    Object.defineProperty(window, 'scrollY', {
      get: () => mockScrollY,
      configurable: true,
    });
    
    // Mock window.scrollTo
    (window.scrollTo as unknown) = vi.fn((options: ScrollToOptions | number, y?: number) => {
      if (typeof options === 'object') {
        mockScrollY = options.top ?? 0;
      } else {
        mockScrollY = y ?? options;
      }
    });
    
    // Mock document.getElementById
    vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
      const elementData = mockElements.get(id);
      if (!elementData) return null;
      
      return {
        id,
        getBoundingClientRect: () => ({
          top: elementData.top - mockScrollY,
          bottom: elementData.top + elementData.height - mockScrollY,
          left: 0,
          right: 100,
          width: 100,
          height: elementData.height,
          x: 0,
          y: elementData.top - mockScrollY,
          toJSON: () => ({}),
        }),
      } as unknown as HTMLElement;
    });
    
    // Mock history.replaceState
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /**
   * Property 29: Deep Link Navigation
   * Validates: Requirements 10.2
   */
  describe('Property 29: Deep Link Navigation', () => {
    it('scrollToElement should scroll to element position minus offset for any valid element', () => {
      fc.assert(
        fc.property(
          elementIdArbitrary,
          fc.integer({ min: 100, max: 5000 }),
          offsetArbitrary,
          (elementId, elementTop, offset) => {
            cleanup();
            vi.useFakeTimers();
            mockScrollY = 0;
            mockElements.clear();
            
            // Set up mock element
            mockElements.set(elementId, { top: elementTop, height: 100 });
            
            const { result } = renderHook(() => useDeepLink({ offset }));
            
            // Scroll to element
            act(() => {
              result.current.scrollToElement(elementId);
            });
            
            // Verify scrollTo was called with correct position
            const expectedPosition = elementTop - offset;
            expect(window.scrollTo).toHaveBeenCalledWith({
              top: expectedPosition,
              behavior: 'smooth',
            });
            
            vi.useRealTimers();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('scrollToHash should scroll to element matching hash for any valid hash', () => {
      fc.assert(
        fc.property(
          elementIdArbitrary,
          fc.integer({ min: 100, max: 5000 }),
          (elementId, elementTop) => {
            cleanup();
            vi.useFakeTimers();
            mockScrollY = 0;
            mockElements.clear();
            mockHash = `#${elementId}`;
            
            // Set up mock element
            mockElements.set(elementId, { top: elementTop, height: 100 });
            
            const { result } = renderHook(() => useDeepLink());
            
            // Scroll to hash
            act(() => {
              result.current.scrollToHash();
            });
            
            // Verify scrollTo was called
            expect(window.scrollTo).toHaveBeenCalled();
            
            vi.useRealTimers();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('scrollToHash should return false for non-existent elements', () => {
      fc.assert(
        fc.property(elementIdArbitrary, (elementId) => {
          cleanup();
          vi.useFakeTimers();
          mockElements.clear(); // No elements registered
          mockHash = `#${elementId}`;
          
          const { result } = renderHook(() => useDeepLink());
          
          let success: boolean = false;
          act(() => {
            success = result.current.scrollToHash();
          });
          
          // Should return false for non-existent element
          expect(success).toBe(false);
          
          vi.useRealTimers();
        }),
        { numRuns: 100 }
      );
    });

    it('scrollToHash should return true for existing elements', () => {
      fc.assert(
        fc.property(
          elementIdArbitrary,
          fc.integer({ min: 100, max: 5000 }),
          (elementId, elementTop) => {
            cleanup();
            vi.useFakeTimers();
            mockElements.clear();
            mockElements.set(elementId, { top: elementTop, height: 100 });
            mockHash = `#${elementId}`;
            
            const { result } = renderHook(() => useDeepLink());
            
            let success: boolean = false;
            act(() => {
              success = result.current.scrollToHash();
            });
            
            // Should return true for existing element
            expect(success).toBe(true);
            
            vi.useRealTimers();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('scrollToHash should handle hash with or without # prefix', () => {
      fc.assert(
        fc.property(
          elementIdArbitrary,
          fc.integer({ min: 100, max: 5000 }),
          fc.boolean(),
          (elementId, elementTop, includeHash) => {
            cleanup();
            vi.useFakeTimers();
            mockElements.clear();
            mockElements.set(elementId, { top: elementTop, height: 100 });
            mockHash = '';
            
            const { result } = renderHook(() => useDeepLink());
            
            // Pass hash with or without # prefix
            const hashArg = includeHash ? `#${elementId}` : elementId;
            
            let success: boolean = false;
            act(() => {
              success = result.current.scrollToHash(hashArg);
            });
            
            // Should work either way
            expect(success).toBe(true);
            expect(window.scrollTo).toHaveBeenCalled();
            
            vi.useRealTimers();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('updateHash should update URL without navigation', () => {
      fc.assert(
        fc.property(elementIdArbitrary, (elementId) => {
          cleanup();
          vi.useFakeTimers();
          mockHash = '';
          
          const { result } = renderHook(() => useDeepLink());
          
          act(() => {
            result.current.updateHash(elementId);
          });
          
          // Verify replaceState was called
          expect(window.history.replaceState).toHaveBeenCalledWith(
            window.history.state,
            '',
            expect.stringContaining(`#${elementId}`)
          );
          
          vi.useRealTimers();
        }),
        { numRuns: 100 }
      );
    });

    it('clearHash should remove hash from URL', () => {
      fc.assert(
        fc.property(elementIdArbitrary, (elementId) => {
          cleanup();
          vi.useFakeTimers();
          mockHash = `#${elementId}`;
          
          const { result } = renderHook(() => useDeepLink());
          
          act(() => {
            result.current.clearHash();
          });
          
          // Verify replaceState was called without hash
          expect(window.history.replaceState).toHaveBeenCalledWith(
            window.history.state,
            '',
            `${mockPathname}${mockSearch}`
          );
          
          vi.useRealTimers();
        }),
        { numRuns: 100 }
      );
    });

    it('currentHash should reflect location hash', () => {
      fc.assert(
        fc.property(elementIdArbitrary, (elementId) => {
          cleanup();
          vi.useFakeTimers();
          mockHash = `#${elementId}`;
          
          const { result } = renderHook(() => useDeepLink());
          
          expect(result.current.currentHash).toBe(`#${elementId}`);
          
          vi.useRealTimers();
        }),
        { numRuns: 100 }
      );
    });

    it('empty hash should not trigger scroll', () => {
      fc.assert(
        fc.property(fc.boolean(), () => {
          cleanup();
          vi.useFakeTimers();
          mockHash = '';
          
          const { result } = renderHook(() => useDeepLink());
          
          let success: boolean = false;
          act(() => {
            success = result.current.scrollToHash();
          });
          
          expect(success).toBe(false);
          expect(window.scrollTo).not.toHaveBeenCalled();
          
          vi.useRealTimers();
        }),
        { numRuns: 100 }
      );
    });
  });
});
