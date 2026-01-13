import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';
import { HorizontalDivider, SPACING_VALUES, DividerSpacing } from './HorizontalDivider';

/**
 * Feature: debate-page-paper-polish
 * Property 1: Horizontal Divider Spacing Consistency
 * 
 * For any HorizontalDivider component rendered with a spacing variant ('sm', 'md', 'lg'),
 * the computed margin above and below SHALL match the specified spacing value for that variant.
 * 
 * Validates: Requirements 3.4
 */

// Arbitrary for spacing variants
const spacingArbitrary = fc.constantFrom<DividerSpacing>('sm', 'md', 'lg');

// Arbitrary for decorative boolean
const decorativeArbitrary = fc.boolean();

// Expected Tailwind margin classes for each spacing variant
const EXPECTED_MARGIN_CLASSES: Record<DividerSpacing, string> = {
  sm: 'my-4',   // 16px (1rem)
  md: 'my-6',   // 24px (1.5rem)
  lg: 'my-8',   // 32px (2rem)
};

describe('HorizontalDivider Property Tests', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 1: Horizontal Divider Spacing Consistency
   * Validates: Requirements 3.4
   */
  describe('Property 1: Horizontal Divider Spacing Consistency', () => {
    it('All spacing variants should render with correct margin classes', () => {
      fc.assert(
        fc.property(spacingArbitrary, (spacing) => {
          cleanup();
          
          render(
            <HorizontalDivider 
              spacing={spacing} 
              data-testid="divider-test"
            />
          );
          
          const divider = screen.getByTestId('divider-test');
          expect(divider).toBeInTheDocument();
          
          // Should have the correct margin class for the spacing variant
          const expectedClass = EXPECTED_MARGIN_CLASSES[spacing];
          expect(divider.className).toContain(expectedClass);
          
          // Should have the data-spacing attribute matching the variant
          expect(divider).toHaveAttribute('data-spacing', spacing);
        }),
        { numRuns: 100 }
      );
    });

    it('Spacing values should match expected pixel values', () => {
      fc.assert(
        fc.property(spacingArbitrary, (spacing) => {
          // Verify the exported SPACING_VALUES constant matches expected values
          const expectedValues: Record<DividerSpacing, number> = {
            sm: 16,
            md: 24,
            lg: 32,
          };
          
          expect(SPACING_VALUES[spacing]).toBe(expectedValues[spacing]);
        }),
        { numRuns: 100 }
      );
    });

    it('Divider should render with separator role for accessibility', () => {
      fc.assert(
        fc.property(spacingArbitrary, decorativeArbitrary, (spacing, decorative) => {
          cleanup();
          
          render(
            <HorizontalDivider 
              spacing={spacing}
              decorative={decorative}
              data-testid="divider-a11y"
            />
          );
          
          const divider = screen.getByTestId('divider-a11y');
          
          // Should have separator role
          expect(divider).toHaveAttribute('role', 'separator');
          
          // Should have horizontal orientation
          expect(divider).toHaveAttribute('aria-orientation', 'horizontal');
        }),
        { numRuns: 100 }
      );
    });

    it('Decorative variant should render with data-decorative attribute', () => {
      fc.assert(
        fc.property(spacingArbitrary, decorativeArbitrary, (spacing, decorative) => {
          cleanup();
          
          render(
            <HorizontalDivider 
              spacing={spacing}
              decorative={decorative}
              data-testid="divider-decorative"
            />
          );
          
          const divider = screen.getByTestId('divider-decorative');
          
          // Should have data-decorative attribute matching the prop
          expect(divider).toHaveAttribute('data-decorative', String(decorative));
        }),
        { numRuns: 100 }
      );
    });

    it('Standard divider should use horizontal-rule utility class', () => {
      fc.assert(
        fc.property(spacingArbitrary, (spacing) => {
          cleanup();
          
          render(
            <HorizontalDivider 
              spacing={spacing}
              decorative={false}
              data-testid="divider-standard"
            />
          );
          
          const divider = screen.getByTestId('divider-standard');
          
          // Standard (non-decorative) divider should have horizontal-rule class
          expect(divider.className).toContain('horizontal-rule');
        }),
        { numRuns: 100 }
      );
    });

    it('Decorative divider should have centered short line', () => {
      fc.assert(
        fc.property(spacingArbitrary, (spacing) => {
          cleanup();
          
          const { container } = render(
            <HorizontalDivider 
              spacing={spacing}
              decorative={true}
              data-testid="divider-decorative-line"
            />
          );
          
          const divider = screen.getByTestId('divider-decorative-line');
          
          // Decorative divider should have flex justify-center for centering
          expect(divider.className).toContain('flex');
          expect(divider.className).toContain('justify-center');
          
          // Should contain a short line element with w-16 class
          const shortLine = container.querySelector('.w-16');
          expect(shortLine).toBeInTheDocument();
          expect(shortLine?.className).toContain('bg-divider');
        }),
        { numRuns: 100 }
      );
    });

    it('Custom className should be applied to divider', () => {
      fc.assert(
        fc.property(
          spacingArbitrary,
          fc.constantFrom('custom-class', 'test-divider', 'my-divider'),
          (spacing, customClass) => {
            cleanup();
            
            render(
              <HorizontalDivider 
                spacing={spacing}
                className={customClass}
                data-testid="divider-custom"
              />
            );
            
            const divider = screen.getByTestId('divider-custom');
            expect(divider.className).toContain(customClass);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Default spacing should be md when not specified', () => {
      fc.assert(
        fc.property(decorativeArbitrary, (decorative) => {
          cleanup();
          
          render(
            <HorizontalDivider 
              decorative={decorative}
              data-testid="divider-default"
            />
          );
          
          const divider = screen.getByTestId('divider-default');
          
          // Default spacing should be 'md'
          expect(divider).toHaveAttribute('data-spacing', 'md');
          expect(divider.className).toContain('my-6');
        }),
        { numRuns: 100 }
      );
    });
  });
});
