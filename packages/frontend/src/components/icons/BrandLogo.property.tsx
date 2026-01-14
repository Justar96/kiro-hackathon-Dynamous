import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { BrandLogo, _testUtils } from './BrandLogo';
import { SIZE_MAP, type IconSize } from './types';

/**
 * Feature: animated-icons, Property Tests for BrandLogo
 * Validates: Requirements 6.1, 6.4, 9.4
 */

// Arbitraries for property-based testing
const sizeArbitrary = fc.constantFrom<IconSize>('xs', 'sm', 'md', 'lg', 'xl');
const variantArbitrary = fc.constantFrom<'light' | 'dark'>('light', 'dark');
const logoNameArbitrary = fc.constantFrom('react', 'typescript', 'javascript', 'nodejs', 'python');
const fallbackArbitrary = fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0);

describe('BrandLogo Property Tests', () => {
  beforeEach(() => {
    cleanup();
    _testUtils.clearCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 8: Logo Cache Consistency
   * For any brand logo name, fetching the logo twice SHALL return the same
   * SVG content from cache without making a second network request.
   * Validates: Requirements 6.1
   */
  it('Property 8: Logo cache should return same content without duplicate requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        logoNameArbitrary,
        variantArbitrary,
        async (name, variant) => {
          cleanup();
          _testUtils.clearCache();
          
          const mockSvgContent = `<svg data-name="${name}"><path d="M0 0"/></svg>`;
          let fetchCount = 0;
          
          // Mock fetch to track calls
          const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
            fetchCount++;
            return new Response(JSON.stringify({
              route: variant === 'dark' 
                ? { light: mockSvgContent, dark: mockSvgContent }
                : mockSvgContent
            }), { status: 200 });
          });
          
          // First render - should fetch
          const { unmount: unmount1 } = render(
            <BrandLogo name={name} variant={variant} data-testid="logo-1" />
          );
          
          await waitFor(() => {
            const cache = _testUtils.getCache();
            return cache.has(`${name}-${variant}`);
          }, { timeout: 1000 });
          
          const firstFetchCount = fetchCount;
          expect(firstFetchCount).toBe(1);
          
          unmount1();
          cleanup();
          
          // Second render - should use cache
          render(
            <BrandLogo name={name} variant={variant} data-testid="logo-2" />
          );
          
          // Wait a tick to ensure any fetch would have been triggered
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Fetch count should not have increased
          expect(fetchCount).toBe(firstFetchCount);
          
          // Cache should contain the content
          const cache = _testUtils.getCache();
          expect(cache.has(`${name}-${variant}`)).toBe(true);
          
          fetchSpy.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9: Fallback Rendering
   * For any icon or logo that fails to load, the component SHALL render
   * a fallback element without throwing an error.
   * Validates: Requirements 6.4, 9.4
   */
  it('Property 9: Failed logo loads should render fallback without errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        logoNameArbitrary,
        sizeArbitrary,
        fallbackArbitrary,
        async (name, size, fallback) => {
          cleanup();
          _testUtils.clearCache();
          
          // Mock fetch to fail
          const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
            return new Response(null, { status: 404, statusText: 'Not Found' });
          });
          
          // Should not throw when rendering
          expect(() => {
            render(
              <BrandLogo 
                name={name} 
                size={size} 
                fallback={fallback}
                data-testid="logo-fallback"
              />
            );
          }).not.toThrow();
          
          // Wait for fetch to complete and error state to be set
          await waitFor(() => {
            const failedFetches = _testUtils.getFailedFetches();
            return failedFetches.has(`${name}-light`);
          }, { timeout: 1000 });
          
          // Fallback should be rendered
          const element = screen.getByTestId('logo-fallback');
          expect(element).toBeInTheDocument();
          expect(element.textContent).toBe(fallback);
          
          // Should have correct size class
          const expectedSizeClass = SIZE_MAP[size];
          expectedSizeClass.split(' ').forEach(cls => {
            expect(element.className).toContain(cls);
          });
          
          fetchSpy.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional Property: Placeholder rendering when no fallback provided
   * For any logo that fails to load without a fallback prop, the component
   * SHALL render a neutral placeholder element.
   * Validates: Requirements 6.4
   */
  it('Property 9b: Failed logo without fallback should render placeholder', async () => {
    await fc.assert(
      fc.asyncProperty(
        logoNameArbitrary,
        sizeArbitrary,
        async (name, size) => {
          cleanup();
          _testUtils.clearCache();
          
          // Mock fetch to fail
          const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
            return new Response(null, { status: 404, statusText: 'Not Found' });
          });
          
          // Should not throw when rendering without fallback
          expect(() => {
            render(
              <BrandLogo 
                name={name} 
                size={size}
                data-testid="logo-placeholder"
              />
            );
          }).not.toThrow();
          
          // Wait for fetch to complete
          await waitFor(() => {
            const failedFetches = _testUtils.getFailedFetches();
            return failedFetches.has(`${name}-light`);
          }, { timeout: 1000 });
          
          // Placeholder should be rendered
          const element = screen.getByTestId('logo-placeholder');
          expect(element).toBeInTheDocument();
          
          // Should have correct size class
          const expectedSizeClass = SIZE_MAP[size];
          expectedSizeClass.split(' ').forEach(cls => {
            expect(element.className).toContain(cls);
          });
          
          // Should have placeholder styling (bg-gray-100)
          expect(element.className).toContain('bg-gray-100');
          
          fetchSpy.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });
});
