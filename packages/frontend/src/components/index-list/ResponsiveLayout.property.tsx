/**
 * Property-based tests for Responsive Layout behavior.
 * 
 * Feature: reddit-style-feed
 * Property 9: Responsive Layout Adaptation
 * 
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 * 
 * Note: Since jsdom doesn't support CSS media queries, these tests verify
 * that the correct responsive CSS classes are applied to elements.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, cleanup } from '@testing-library/react';
import { CompactDebateCard } from './CompactDebateCard';
import { InlineQuickStance } from './InlineQuickStance';
import { TrendingRail } from './TrendingRail';
import type { Debate, MarketPrice } from '@thesis/shared';

// Mock TanStack Router's Link component
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string; [key: string]: unknown }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

// Mock the usePrefetch hook - must match the actual import path
vi.mock('../../lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib')>();
  return {
    ...actual,
    useDebateLinkPrefetch: () => ({}),
  };
});

afterEach(() => {
  cleanup();
});

// Arbitraries for generating test data
const roundNumberArb = fc.constantFrom(1, 2, 3) as fc.Arbitrary<1 | 2 | 3>;
const debateStatusArb = fc.constantFrom('active', 'concluded') as fc.Arbitrary<'active' | 'concluded'>;
const sideArb = fc.constantFrom('support', 'oppose') as fc.Arbitrary<'support' | 'oppose'>;

// Generate a valid debate
const debateArb: fc.Arbitrary<Debate> = fc.record({
  id: fc.uuid(),
  resolution: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
  status: debateStatusArb,
  currentRound: roundNumberArb,
  currentTurn: sideArb,
  supportDebaterId: fc.uuid(),
  opposeDebaterId: fc.option(fc.uuid(), { nil: null }),
  createdAt: fc.date(),
  concludedAt: fc.option(fc.date(), { nil: null }),
});

// Generate market price data
const marketPriceArb: fc.Arbitrary<MarketPrice> = fc.record({
  supportPrice: fc.integer({ min: 0, max: 100 }),
  opposePrice: fc.integer({ min: 0, max: 100 }),
  totalVotes: fc.integer({ min: 0, max: 10000 }),
  mindChangeCount: fc.integer({ min: 0, max: 1000 }),
});

describe('Responsive Layout Property Tests', () => {
  /**
   * Property 9: Responsive Layout Adaptation
   * For any viewport size:
   * - Trending section SHALL be hidden on viewports < 768px (via right rail hiding)
   * - Cards SHALL be full-width on mobile
   * - Touch targets SHALL be at least 44px on mobile
   * - Quick stance buttons SHALL be larger on mobile
   * 
   * Validates: Requirements 6.1, 6.2, 6.3, 6.4
   */

  describe('Property 9.1: Cards have responsive width classes (Requirement 6.2)', () => {
    it('CompactDebateCard renders as block element for mobile', () => {
      fc.assert(
        fc.property(
          debateArb,
          fc.option(marketPriceArb, { nil: null }),
          (debate, marketPrice) => {
            const { container } = render(
              <CompactDebateCard
                debate={debate}
                marketPrice={marketPrice}
              />
            );

            // The Link wrapper should be a block element
            const link = container.querySelector('a');
            expect(link).not.toBeNull();
            expect(link?.classList.contains('block')).toBe(true);
            
            // The article should be present with proper styling
            const article = container.querySelector('[data-testid="compact-debate-card"]');
            expect(article).not.toBeNull();
            // Article uses relative positioning for proper layout
            expect(article?.classList.contains('relative')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 9.2: Quick stance buttons have mobile touch target classes (Requirement 6.3, 6.4)', () => {
    it('Quick stance buttons have min-height and min-width for mobile', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          marketPriceArb,
          (debateId, marketPrice) => {
            const { container } = render(
              <InlineQuickStance
                debateId={debateId}
                marketPrice={marketPrice}
                onStance={vi.fn()}
              />
            );

            const supportButton = container.querySelector('[data-testid="quick-stance-support"]');
            const opposeButton = container.querySelector('[data-testid="quick-stance-oppose"]');

            // Buttons should have mobile touch target classes
            expect(supportButton).not.toBeNull();
            expect(opposeButton).not.toBeNull();

            // Check for min-h-[44px] class (mobile touch target)
            expect(supportButton?.classList.toString()).toContain('min-h-[44px]');
            expect(opposeButton?.classList.toString()).toContain('min-h-[44px]');

            // Check for min-w-[44px] class (mobile touch target)
            expect(supportButton?.classList.toString()).toContain('min-w-[44px]');
            expect(opposeButton?.classList.toString()).toContain('min-w-[44px]');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Quick stance buttons have responsive text size classes', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          marketPriceArb,
          (debateId, marketPrice) => {
            const { container } = render(
              <InlineQuickStance
                debateId={debateId}
                marketPrice={marketPrice}
                onStance={vi.fn()}
              />
            );

            const supportButton = container.querySelector('[data-testid="quick-stance-support"]');
            const opposeButton = container.querySelector('[data-testid="quick-stance-oppose"]');

            // Buttons should have responsive text classes (text-xs on mobile, sm:text-[10px] on desktop)
            expect(supportButton?.classList.toString()).toContain('text-xs');
            expect(opposeButton?.classList.toString()).toContain('text-xs');
            expect(supportButton?.classList.toString()).toContain('sm:text-[10px]');
            expect(opposeButton?.classList.toString()).toContain('sm:text-[10px]');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Quick stance buttons have responsive padding classes', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          marketPriceArb,
          (debateId, marketPrice) => {
            const { container } = render(
              <InlineQuickStance
                debateId={debateId}
                marketPrice={marketPrice}
                onStance={vi.fn()}
              />
            );

            const supportButton = container.querySelector('[data-testid="quick-stance-support"]');
            const opposeButton = container.querySelector('[data-testid="quick-stance-oppose"]');

            // Buttons should have responsive padding (larger on mobile)
            expect(supportButton?.classList.toString()).toContain('px-2');
            expect(supportButton?.classList.toString()).toContain('sm:px-1.5');
            expect(opposeButton?.classList.toString()).toContain('px-2');
            expect(opposeButton?.classList.toString()).toContain('sm:px-1.5');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 9.3: Mini sparkline is hidden on mobile (Requirement 6.2)', () => {
    it('Mini sparkline has hidden sm:block classes for responsive visibility', () => {
      fc.assert(
        fc.property(
          debateArb.map(d => ({ ...d, status: 'active' as const, opposeDebaterId: 'user-2' })),
          marketPriceArb,
          (debate, marketPrice) => {
            const { container } = render(
              <CompactDebateCard
                debate={debate}
                marketPrice={marketPrice}
              />
            );

            // Find the sparkline container
            const sparklineContainer = container.querySelector('[data-testid="mini-sparkline"]')?.parentElement;
            
            if (sparklineContainer) {
              // Should have hidden class for mobile and sm:block for desktop
              expect(sparklineContainer.classList.contains('hidden')).toBe(true);
              expect(sparklineContainer.classList.contains('sm:block')).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 9.4: Quick stance buttons have active state for touch feedback (Requirement 6.3)', () => {
    it('Quick stance buttons have active state classes', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          marketPriceArb,
          (debateId, marketPrice) => {
            const { container } = render(
              <InlineQuickStance
                debateId={debateId}
                marketPrice={marketPrice}
                onStance={vi.fn()}
              />
            );

            const supportButton = container.querySelector('[data-testid="quick-stance-support"]');
            const opposeButton = container.querySelector('[data-testid="quick-stance-oppose"]');

            // Buttons should have active state for touch feedback
            expect(supportButton?.classList.toString()).toContain('active:bg-support/30');
            expect(opposeButton?.classList.toString()).toContain('active:bg-oppose/30');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 9.5: Voted state does not show large buttons (Requirement 6.4)', () => {
    it('Voted state shows compact indicator without large touch targets', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          marketPriceArb,
          fc.integer({ min: 1, max: 100 }),
          (debateId, marketPrice, userStance) => {
            const { container } = render(
              <InlineQuickStance
                debateId={debateId}
                marketPrice={marketPrice}
                userStance={userStance}
                onStance={vi.fn()}
              />
            );

            // When user has voted, should not show large buttons
            const supportButton = container.querySelector('[data-testid="quick-stance-support"]');
            const opposeButton = container.querySelector('[data-testid="quick-stance-oppose"]');

            // Buttons should not be present when user has voted
            expect(supportButton).toBeNull();
            expect(opposeButton).toBeNull();

            // Should show checkmark indicator instead
            expect(container.textContent).toContain('✓');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 9.6: Card has active state for touch feedback (Requirement 6.3)', () => {
    it('CompactDebateCard has active state class for touch feedback', () => {
      fc.assert(
        fc.property(
          debateArb,
          fc.option(marketPriceArb, { nil: null }),
          (debate, marketPrice) => {
            const { container } = render(
              <CompactDebateCard
                debate={debate}
                marketPrice={marketPrice}
              />
            );

            // The article should have active state for touch feedback
            const article = container.querySelector('[data-testid="compact-debate-card"]');
            expect(article).not.toBeNull();
            // Check for active state class (active:bg-page-bg without opacity modifier)
            expect(article?.classList.toString()).toContain('active:bg-page-bg');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 9.7: TrendingRail items have touch-friendly targets (Requirement 6.3)', () => {
    it('TrendingRail items have minimum height for touch targets', () => {
      // Generate active debates for trending
      const activeDebateArb = debateArb.map(d => ({
        ...d,
        status: 'active' as const,
        opposeDebaterId: 'user-2',
      }));

      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              debate: activeDebateArb,
              marketPrice: fc.option(marketPriceArb, { nil: null }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (debates) => {
            const { container } = render(
              <TrendingRail debates={debates} maxCount={5} />
            );

            // Find all trending items
            const trendingItems = container.querySelectorAll('[data-testid="trending-item"]');
            
            // Each item should have min-h-[44px] class for touch targets
            trendingItems.forEach(item => {
              expect(item.classList.toString()).toContain('min-h-[44px]');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('TrendingRail items have active state for touch feedback', () => {
      const activeDebateArb = debateArb.map(d => ({
        ...d,
        status: 'active' as const,
        opposeDebaterId: 'user-2',
      }));

      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              debate: activeDebateArb,
              marketPrice: fc.option(marketPriceArb, { nil: null }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (debates) => {
            const { container } = render(
              <TrendingRail debates={debates} maxCount={5} />
            );

            // Find all trending items
            const trendingItems = container.querySelectorAll('[data-testid="trending-item"]');
            
            // Each item should have active state for touch feedback
            trendingItems.forEach(item => {
              expect(item.classList.toString()).toContain('active:bg-page-bg');
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
