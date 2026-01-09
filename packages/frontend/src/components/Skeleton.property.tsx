import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';
import { 
  Skeleton,
  SkeletonLoader,
  SkeletonText,
  SkeletonParagraph,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonCard,
  SkeletonVariant,
} from './Skeleton';

/**
 * Feature: uiux-improvements
 * Property 12: Skeleton Display During Loading
 * 
 * For any data fetch (debates, comments, market data), skeleton loaders 
 * SHALL be displayed while the request is pending.
 * 
 * Validates: Requirements 4.1, 4.3
 */

// Arbitrary for skeleton variants
const variantArbitrary = fc.constantFrom<SkeletonVariant>(
  'text', 'heading', 'paragraph', 'avatar', 'button', 'card'
);

// Arbitrary for avatar sizes
const avatarSizeArbitrary = fc.constantFrom<'sm' | 'md' | 'lg'>('sm', 'md', 'lg');

// Arbitrary for positive dimensions
const dimensionArbitrary = fc.oneof(
  fc.integer({ min: 10, max: 500 }), // number
  fc.constantFrom('100px', '50%', '10rem', 'auto') // string
);

// Arbitrary for line counts
const linesArbitrary = fc.integer({ min: 1, max: 10 });

describe('Skeleton Property Tests', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 12: Skeleton Display During Loading
   * Validates: Requirements 4.1, 4.3
   */
  describe('Property 12: Skeleton Display During Loading', () => {
    it('All skeleton variants should render with data-skeleton attribute', () => {
      fc.assert(
        fc.property(variantArbitrary, (variant) => {
          cleanup();
          
          render(
            <SkeletonLoader 
              variant={variant} 
              data-testid="skeleton-test"
            />
          );
          
          // Skeleton should be rendered
          const skeleton = screen.getByTestId('skeleton-test');
          expect(skeleton).toBeInTheDocument();
          
          // Should have data-skeleton attribute for identification
          expect(skeleton).toHaveAttribute('data-skeleton', 'true');
        }),
        { numRuns: 100 }
      );
    });

    it('Skeletons should be hidden from accessibility tree', () => {
      fc.assert(
        fc.property(variantArbitrary, (variant) => {
          cleanup();
          
          const result = render(
            <SkeletonLoader variant={variant} />
          );
          
          // Find elements with aria-hidden
          const hiddenElements = result.container.querySelectorAll('[aria-hidden="true"]');
          
          // At least one element should be aria-hidden
          expect(hiddenElements.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('Skeletons should have pulse animation class', () => {
      fc.assert(
        fc.property(variantArbitrary, (variant) => {
          cleanup();
          
          const result = render(
            <SkeletonLoader variant={variant} />
          );
          
          // Find elements with animate-pulse class
          const animatedElements = result.container.querySelectorAll('.animate-pulse');
          
          // At least one element should have animation
          expect(animatedElements.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('Skeletons should support custom dimensions', () => {
      fc.assert(
        fc.property(
          variantArbitrary,
          dimensionArbitrary,
          dimensionArbitrary,
          (variant, width, height) => {
            cleanup();
            
            // Skip variants that wrap content in containers (card, paragraph, text)
            // These have special structure where dimensions apply to inner elements
            if (variant === 'card' || variant === 'paragraph' || variant === 'text') return;
            
            render(
              <SkeletonLoader 
                variant={variant}
                width={width}
                height={height}
                data-testid="skeleton-custom"
              />
            );
            
            const skeleton = screen.getByTestId('skeleton-custom');
            expect(skeleton).toBeInTheDocument();
            
            // If numeric width/height, check style
            if (typeof width === 'number') {
              const style = skeleton.getAttribute('style') || '';
              expect(style).toContain(`width: ${width}px`);
            }
            if (typeof height === 'number') {
              const style = skeleton.getAttribute('style') || '';
              expect(style).toContain(`height: ${height}px`);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Paragraph skeleton should render correct number of lines', () => {
      fc.assert(
        fc.property(linesArbitrary, (lines) => {
          cleanup();
          
          render(
            <SkeletonParagraph lines={lines} data-testid="skeleton-paragraph" />
          );
          
          // Count skeleton line elements (direct children with animate-pulse)
          const skeleton = screen.getByTestId('skeleton-paragraph');
          const lineElements = skeleton.querySelectorAll('.animate-pulse');
          
          expect(lineElements.length).toBe(lines);
        }),
        { numRuns: 100 }
      );
    });

    it('Avatar skeleton should render with correct size classes', () => {
      fc.assert(
        fc.property(avatarSizeArbitrary, (size) => {
          cleanup();
          
          render(
            <SkeletonAvatar size={size} data-testid="skeleton-avatar" />
          );
          
          const skeleton = screen.getByTestId('skeleton-avatar');
          
          // Should have rounded-full for circular shape
          expect(skeleton.className).toContain('rounded-full');
          
          // Should have appropriate size class
          const sizeClasses = {
            sm: 'w-8 h-8',
            md: 'w-12 h-12',
            lg: 'w-16 h-16',
          };
          
          const expectedClasses = sizeClasses[size].split(' ');
          expectedClasses.forEach(cls => {
            expect(skeleton.className).toContain(cls);
          });
        }),
        { numRuns: 100 }
      );
    });

    it('Text skeleton should render correct number of lines', () => {
      fc.assert(
        fc.property(linesArbitrary, (lines) => {
          cleanup();
          
          render(
            <SkeletonText lines={lines} data-testid="skeleton-text" />
          );
          
          const skeleton = screen.getByTestId('skeleton-text');
          const lineElements = skeleton.querySelectorAll('.animate-pulse');
          
          expect(lineElements.length).toBe(lines);
        }),
        { numRuns: 100 }
      );
    });

    it('Card skeleton should contain heading and paragraph skeletons', () => {
      fc.assert(
        fc.property(fc.boolean(), () => {
          cleanup();
          
          render(
            <SkeletonCard data-testid="skeleton-card" />
          );
          
          const card = screen.getByTestId('skeleton-card');
          
          // Should have paper styling
          expect(card.className).toContain('bg-paper');
          expect(card.className).toContain('shadow-paper');
          
          // Should contain multiple skeleton elements
          const skeletonElements = card.querySelectorAll('.animate-pulse');
          expect(skeletonElements.length).toBeGreaterThan(1);
        }),
        { numRuns: 100 }
      );
    });

    it('Button skeleton should have button-like dimensions', () => {
      fc.assert(
        fc.property(fc.boolean(), () => {
          cleanup();
          
          render(
            <SkeletonButton data-testid="skeleton-button" />
          );
          
          const skeleton = screen.getByTestId('skeleton-button');
          
          // Should have rounded corners like a button
          expect(skeleton.className).toContain('rounded');
          
          // Should have default height class
          expect(skeleton.className).toContain('h-10');
        }),
        { numRuns: 100 }
      );
    });

    it('Base Skeleton should accept custom className', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('custom-class', 'test-class', 'my-skeleton'),
          (customClass) => {
            cleanup();
            
            render(
              <Skeleton className={customClass} data-testid="skeleton-base" />
            );
            
            const skeleton = screen.getByTestId('skeleton-base');
            expect(skeleton.className).toContain(customClass);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
