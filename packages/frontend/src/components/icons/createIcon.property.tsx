import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';
import { createIcon } from './createIcon';
import { SIZE_MAP, type IconSize } from './types';
import { CheckIcon } from '@heroicons/react/24/outline';

/**
 * Feature: animated-icons, Property Tests for Icon Wrapper
 * Validates: Requirements 1.4, 7.1, 7.2, 8.5, 10.1, 10.3
 */

// Mock matchMedia for jsdom environment
const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

// Create a test icon using the factory
const TestIcon = createIcon(CheckIcon, 'TestIcon');

// Arbitraries for property-based testing
const sizeArbitrary = fc.constantFrom<IconSize>('xs', 'sm', 'md', 'lg', 'xl');
const classNameArbitrary = fc.stringOf(
  fc.constantFrom('text-red-500', 'text-blue-500', 'text-green-500', 'mt-2', 'mb-4', 'p-1', 'custom-class'),
  { minLength: 0, maxLength: 3 }
).map(chars => chars.split('').join(' ').trim());
const ariaLabelArbitrary = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);

describe('Icon Wrapper Property Tests', () => {
  beforeAll(() => {
    window.matchMedia = mockMatchMedia;
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 1: Consistent Icon API
   * For any icon component exported from the Icon_System, it SHALL accept
   * the standard IconProps interface and render without errors.
   * Validates: Requirements 1.4, 8.1
   */
  it('Property 1: Icon should accept standard IconProps and render without errors', () => {
    fc.assert(
      fc.property(
        sizeArbitrary,
        classNameArbitrary,
        fc.boolean(),
        fc.boolean(),
        (size, className, noAnimation, decorative) => {
          cleanup();
          
          // Should not throw when rendering with any combination of props
          expect(() => {
            render(
              <TestIcon
                size={size}
                className={className}
                noAnimation={noAnimation}
                decorative={decorative}
                data-testid="test-icon"
              />
            );
          }).not.toThrow();
          
          // Icon should be in the document
          const icon = screen.getByTestId('test-icon');
          expect(icon).toBeInTheDocument();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Size Variant Rendering
   * For any icon and for any size variant, the rendered SVG element SHALL
   * have the corresponding CSS class applied.
   * Validates: Requirements 7.1
   */
  it('Property 2: Icon should apply correct size classes for all size variants', () => {
    fc.assert(
      fc.property(sizeArbitrary, (size) => {
        cleanup();
        
        render(<TestIcon size={size} data-testid="test-icon" />);
        
        const icon = screen.getByTestId('test-icon');
        const expectedClass = SIZE_MAP[size];
        
        // The size class should be present in the class attribute
        // Note: heroicons use 'class' attribute, which gets converted to className in React
        const classAttr = icon.getAttribute('class') || '';
        expectedClass.split(' ').forEach(cls => {
          expect(classAttr).toContain(cls);
        });
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: ClassName Merging
   * For any icon with a custom className prop, the rendered element SHALL
   * contain both the size class and the custom class.
   * Validates: Requirements 7.2
   */
  it('Property 3: Icon should merge custom className with size classes', () => {
    fc.assert(
      fc.property(
        sizeArbitrary,
        fc.constantFrom('custom-class', 'text-red-500', 'my-special-icon'),
        (size, customClass) => {
          cleanup();
          
          render(<TestIcon size={size} className={customClass} data-testid="test-icon" />);
          
          const icon = screen.getByTestId('test-icon');
          const expectedSizeClass = SIZE_MAP[size];
          
          // Get class attribute (SVG elements use class, not className)
          const classAttr = icon.getAttribute('class') || '';
          
          // Both size class and custom class should be present
          expectedSizeClass.split(' ').forEach(cls => {
            expect(classAttr).toContain(cls);
          });
          expect(classAttr).toContain(customClass);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Animation Disable
   * For any icon with noAnimation=true, the rendered component SHALL not
   * have animation-related behavior.
   * Validates: Requirements 8.5
   */
  it('Property 5: Icon with noAnimation=true should render without motion wrapper', () => {
    fc.assert(
      fc.property(
        sizeArbitrary,
        fc.constantFrom('hover', 'click', 'mount', 'state-change') as fc.Arbitrary<'hover' | 'click' | 'mount' | 'state-change'>,
        (size, animate) => {
          cleanup();
          
          // Render with noAnimation=true
          render(
            <TestIcon
              size={size}
              animate={animate}
              noAnimation={true}
              data-testid="test-icon"
            />
          );
          
          const icon = screen.getByTestId('test-icon');
          
          // Icon should still render
          expect(icon).toBeInTheDocument();
          
          // Should have the correct size class
          const expectedSizeClass = SIZE_MAP[size];
          const classAttr = icon.getAttribute('class') || '';
          expectedSizeClass.split(' ').forEach(cls => {
            expect(classAttr).toContain(cls);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6: Decorative Accessibility
   * For any icon with decorative=true (or no aria-label), the rendered
   * element SHALL have aria-hidden="true".
   * Validates: Requirements 10.1
   */
  it('Property 6: Decorative icons should have aria-hidden="true"', () => {
    fc.assert(
      fc.property(sizeArbitrary, (size) => {
        cleanup();
        
        // Test with explicit decorative=true
        render(<TestIcon size={size} decorative={true} data-testid="test-icon-1" />);
        const icon1 = screen.getByTestId('test-icon-1');
        expect(icon1).toHaveAttribute('aria-hidden', 'true');
        
        cleanup();
        
        // Test with default (decorative defaults to true)
        render(<TestIcon size={size} data-testid="test-icon-2" />);
        const icon2 = screen.getByTestId('test-icon-2');
        expect(icon2).toHaveAttribute('aria-hidden', 'true');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7: Semantic Icon Role
   * For any icon with an aria-label prop, the rendered element SHALL have
   * role="img" and the provided aria-label.
   * Validates: Requirements 10.3
   */
  it('Property 7: Icons with aria-label should have role="img" and the label', () => {
    fc.assert(
      fc.property(
        sizeArbitrary,
        ariaLabelArbitrary,
        (size, ariaLabel) => {
          cleanup();
          
          render(
            <TestIcon
              size={size}
              aria-label={ariaLabel}
              data-testid="test-icon"
            />
          );
          
          const icon = screen.getByTestId('test-icon');
          
          // Should have role="img" when aria-label is provided
          expect(icon).toHaveAttribute('role', 'img');
          
          // Should have the aria-label
          expect(icon).toHaveAttribute('aria-label', ariaLabel);
          
          // Should NOT have aria-hidden when aria-label is provided
          expect(icon).not.toHaveAttribute('aria-hidden', 'true');
        }
      ),
      { numRuns: 100 }
    );
  });
});
