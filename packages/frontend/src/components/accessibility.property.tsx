/**
 * Property-based tests for accessibility requirements.
 * 
 * Feature: debate-lifecycle-ux
 * Tests touch target minimum sizes and accessibility compliance.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Constants
// ============================================================================

/**
 * Minimum touch target size in pixels per WCAG 2.1 AA guidelines.
 * Requirement 8.3: THE Debate_Platform SHALL maintain minimum 44px touch targets on mobile devices
 */
const MIN_TOUCH_TARGET_SIZE = 44;

// ============================================================================
// Touch Target Validation Utilities
// ============================================================================

/**
 * Represents the dimensions of an interactive element.
 */
interface ElementDimensions {
  width: number;
  height: number;
}

/**
 * Validates that an element meets the minimum touch target size requirement.
 * Per WCAG 2.1 AA, interactive elements should be at least 44x44 pixels.
 * 
 * @param dimensions - The width and height of the element
 * @returns true if the element meets the minimum size requirement
 */
function meetsMinimumTouchTargetSize(dimensions: ElementDimensions): boolean {
  return dimensions.width >= MIN_TOUCH_TARGET_SIZE && dimensions.height >= MIN_TOUCH_TARGET_SIZE;
}

/**
 * Calculates the effective touch target area.
 * 
 * @param dimensions - The width and height of the element
 * @returns The area in square pixels
 */
function calculateTouchTargetArea(dimensions: ElementDimensions): number {
  return dimensions.width * dimensions.height;
}

/**
 * Determines if padding should be added to meet touch target requirements.
 * 
 * @param contentDimensions - The dimensions of the content
 * @returns The padding needed on each side to meet minimum requirements
 */
function calculateRequiredPadding(contentDimensions: ElementDimensions): { horizontal: number; vertical: number } {
  const horizontalPadding = Math.max(0, (MIN_TOUCH_TARGET_SIZE - contentDimensions.width) / 2);
  const verticalPadding = Math.max(0, (MIN_TOUCH_TARGET_SIZE - contentDimensions.height) / 2);
  
  return {
    horizontal: Math.ceil(horizontalPadding),
    vertical: Math.ceil(verticalPadding),
  };
}

/**
 * Applies padding to content dimensions to meet touch target requirements.
 * 
 * @param contentDimensions - The original content dimensions
 * @returns The final dimensions after applying necessary padding
 */
function applyTouchTargetPadding(contentDimensions: ElementDimensions): ElementDimensions {
  const padding = calculateRequiredPadding(contentDimensions);
  
  return {
    width: Math.max(MIN_TOUCH_TARGET_SIZE, contentDimensions.width + padding.horizontal * 2),
    height: Math.max(MIN_TOUCH_TARGET_SIZE, contentDimensions.height + padding.vertical * 2),
  };
}

// ============================================================================
// CSS Class Validation
// ============================================================================

/**
 * Checks if a Tailwind CSS class string includes minimum touch target sizing.
 * This validates that min-h-[44px] and min-w-[44px] or equivalent classes are present.
 * 
 * @param classString - The Tailwind CSS class string
 * @returns true if the class string includes touch target sizing
 */
function hasTouchTargetClasses(classString: string): boolean {
  const classes = classString.split(/\s+/);
  
  // Check for explicit min-h and min-w classes
  const hasMinHeight = classes.some(cls => 
    cls === 'min-h-[44px]' || 
    cls === 'min-h-11' || // 44px = 2.75rem = 11 in Tailwind
    cls.match(/^min-h-\[4[4-9]px\]$/) ||
    cls.match(/^min-h-\[[5-9]\dpx\]$/) ||
    cls.match(/^min-h-\[\d{3,}px\]$/)
  );
  
  const hasMinWidth = classes.some(cls => 
    cls === 'min-w-[44px]' || 
    cls === 'min-w-11' ||
    cls.match(/^min-w-\[4[4-9]px\]$/) ||
    cls.match(/^min-w-\[[5-9]\dpx\]$/) ||
    cls.match(/^min-w-\[\d{3,}px\]$/)
  );
  
  // Also check for fixed dimensions that meet the requirement
  const hasFixedHeight = classes.some(cls =>
    cls === 'h-11' ||
    cls === 'h-12' ||
    cls.match(/^h-\[4[4-9]px\]$/) ||
    cls.match(/^h-\[[5-9]\dpx\]$/) ||
    cls.match(/^h-\[\d{3,}px\]$/)
  );
  
  const hasFixedWidth = classes.some(cls =>
    cls === 'w-11' ||
    cls === 'w-12' ||
    cls.match(/^w-\[4[4-9]px\]$/) ||
    cls.match(/^w-\[[5-9]\dpx\]$/) ||
    cls.match(/^w-\[\d{3,}px\]$/)
  );
  
  return (hasMinHeight || hasFixedHeight) && (hasMinWidth || hasFixedWidth);
}

// ============================================================================
// Property 23: Touch Target Minimum Size
// ============================================================================

describe('Accessibility Property Tests - Touch Targets', () => {
  /**
   * Property 23: Touch Target Minimum Size
   * For any interactive element (button, link, input) in the UI,
   * the computed dimensions SHALL be at least 44px × 44px.
   * 
   * **Validates: Requirements 8.3**
   */
  describe('Property 23: Touch Target Minimum Size', () => {
    it('minimum touch target size constant is 44px', () => {
      expect(MIN_TOUCH_TARGET_SIZE).toBe(44);
    });

    it('elements with dimensions >= 44px meet touch target requirements', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 44, max: 500 }),
          fc.integer({ min: 44, max: 500 }),
          (width, height) => {
            const dimensions: ElementDimensions = { width, height };
            expect(meetsMinimumTouchTargetSize(dimensions)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('elements with width < 44px do not meet touch target requirements', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 43 }),
          fc.integer({ min: 44, max: 500 }),
          (width, height) => {
            const dimensions: ElementDimensions = { width, height };
            expect(meetsMinimumTouchTargetSize(dimensions)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('elements with height < 44px do not meet touch target requirements', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 44, max: 500 }),
          fc.integer({ min: 1, max: 43 }),
          (width, height) => {
            const dimensions: ElementDimensions = { width, height };
            expect(meetsMinimumTouchTargetSize(dimensions)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('elements with both dimensions < 44px do not meet touch target requirements', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 43 }),
          fc.integer({ min: 1, max: 43 }),
          (width, height) => {
            const dimensions: ElementDimensions = { width, height };
            expect(meetsMinimumTouchTargetSize(dimensions)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('touch target area is correctly calculated', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 500 }),
          fc.integer({ min: 1, max: 500 }),
          (width, height) => {
            const dimensions: ElementDimensions = { width, height };
            const area = calculateTouchTargetArea(dimensions);
            expect(area).toBe(width * height);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('minimum compliant touch target has area of at least 1936 square pixels (44x44)', () => {
      const minArea = MIN_TOUCH_TARGET_SIZE * MIN_TOUCH_TARGET_SIZE;
      expect(minArea).toBe(1936);
      
      fc.assert(
        fc.property(
          fc.integer({ min: 44, max: 500 }),
          fc.integer({ min: 44, max: 500 }),
          (width, height) => {
            const dimensions: ElementDimensions = { width, height };
            const area = calculateTouchTargetArea(dimensions);
            expect(area).toBeGreaterThanOrEqual(minArea);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('padding calculation ensures minimum touch target size is met', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          (width, height) => {
            const contentDimensions: ElementDimensions = { width, height };
            const finalDimensions = applyTouchTargetPadding(contentDimensions);
            
            // After applying padding, dimensions should meet minimum requirements
            expect(meetsMinimumTouchTargetSize(finalDimensions)).toBe(true);
            expect(finalDimensions.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
            expect(finalDimensions.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('padding is zero when content already meets minimum size', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 44, max: 500 }),
          fc.integer({ min: 44, max: 500 }),
          (width, height) => {
            const contentDimensions: ElementDimensions = { width, height };
            const padding = calculateRequiredPadding(contentDimensions);
            
            expect(padding.horizontal).toBe(0);
            expect(padding.vertical).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('padding is correctly calculated for undersized content', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 43 }),
          fc.integer({ min: 1, max: 43 }),
          (width, height) => {
            const contentDimensions: ElementDimensions = { width, height };
            const padding = calculateRequiredPadding(contentDimensions);
            
            // Padding should be positive
            expect(padding.horizontal).toBeGreaterThan(0);
            expect(padding.vertical).toBeGreaterThan(0);
            
            // Final dimensions should meet minimum
            const finalWidth = width + padding.horizontal * 2;
            const finalHeight = height + padding.vertical * 2;
            expect(finalWidth).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
            expect(finalHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('exactly 44px dimensions meet the minimum requirement', () => {
      const exactMinimum: ElementDimensions = { width: 44, height: 44 };
      expect(meetsMinimumTouchTargetSize(exactMinimum)).toBe(true);
    });

    it('43px dimensions do not meet the minimum requirement', () => {
      const justUnder: ElementDimensions = { width: 43, height: 43 };
      expect(meetsMinimumTouchTargetSize(justUnder)).toBe(false);
    });

    it('asymmetric dimensions are handled correctly', () => {
      // Wide but short
      const wideShort: ElementDimensions = { width: 100, height: 30 };
      expect(meetsMinimumTouchTargetSize(wideShort)).toBe(false);
      
      // Tall but narrow
      const tallNarrow: ElementDimensions = { width: 30, height: 100 };
      expect(meetsMinimumTouchTargetSize(tallNarrow)).toBe(false);
      
      // Both dimensions adequate
      const adequate: ElementDimensions = { width: 100, height: 50 };
      expect(meetsMinimumTouchTargetSize(adequate)).toBe(true);
    });
  });

  describe('Tailwind CSS Touch Target Classes', () => {
    it('recognizes min-h-[44px] and min-w-[44px] classes', () => {
      expect(hasTouchTargetClasses('min-h-[44px] min-w-[44px]')).toBe(true);
    });

    it('recognizes h-11 and w-11 classes (44px equivalent)', () => {
      expect(hasTouchTargetClasses('h-11 w-11')).toBe(true);
    });

    it('recognizes larger minimum sizes', () => {
      expect(hasTouchTargetClasses('min-h-[48px] min-w-[48px]')).toBe(true);
      expect(hasTouchTargetClasses('min-h-[50px] min-w-[50px]')).toBe(true);
      expect(hasTouchTargetClasses('min-h-[100px] min-w-[100px]')).toBe(true);
    });

    it('rejects classes without touch target sizing', () => {
      expect(hasTouchTargetClasses('p-4 bg-white')).toBe(false);
      expect(hasTouchTargetClasses('h-8 w-8')).toBe(false);
      expect(hasTouchTargetClasses('min-h-[32px] min-w-[32px]')).toBe(false);
    });

    it('requires both width and height to be specified', () => {
      expect(hasTouchTargetClasses('min-h-[44px]')).toBe(false);
      expect(hasTouchTargetClasses('min-w-[44px]')).toBe(false);
    });

    it('handles mixed class strings correctly', () => {
      expect(hasTouchTargetClasses('flex items-center min-h-[44px] min-w-[44px] px-4 py-2')).toBe(true);
      expect(hasTouchTargetClasses('flex items-center h-11 w-11 rounded-full')).toBe(true);
    });
  });
});
