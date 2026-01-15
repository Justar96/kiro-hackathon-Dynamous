/**
 * Property-based tests for TrendingRail component.
 * 
 * Feature: reddit-style-feed
 * Property 6: Trending Section Data
 * 
 * Validates: Requirements 4.2, 4.3, 4.4
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, cleanup } from '@testing-library/react';
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

// Generate debate with market price
interface DebateWithMarket {
  debate: Debate;
  marketPrice: MarketPrice | null;
}

const debateWithMarketArb: fc.Arbitrary<DebateWithMarket> = fc.record({
  debate: debateArb,
  marketPrice: fc.option(marketPriceArb, { nil: null }),
});

// Generate array of debates
const debatesArrayArb = (minLength: number, maxLength: number) =>
  fc.array(debateWithMarketArb, { minLength, maxLength });

describe('TrendingRail Property Tests - Trending Section Data', () => {
  /**
   * Property 6: Trending Section Data
   * For any set of debates:
   * - Trending section SHALL display in compact list format (not cards)
   * - Each item SHALL show resolution, support %, and mind changes
   * - Items SHALL be sorted by activity (mind changes, then recency)
   * - Maximum 5 items SHALL be displayed
   * 
   * Validates: Requirements 4.2, 4.3, 4.4
   */

  it('Property 6.1: Trending section displays in compact list format (Requirement 4.2)', () => {
    fc.assert(
      fc.property(
        debatesArrayArb(1, 10).filter(debates => debates.some(d => d.debate.status === 'active')),
        (debates) => {
          const { container } = render(<TrendingRail debates={debates} />);

          // Should have trending rail container
          const trendingRail = container.querySelector('[data-testid="trending-rail"]');
          expect(trendingRail).not.toBeNull();

          // Should have a list element (compact format)
          const list = container.querySelector('[data-testid="trending-list"]');
          expect(list).not.toBeNull();
          expect(list?.tagName.toLowerCase()).toBe('ul');

          // Items should be list items, not cards
          const items = container.querySelectorAll('[data-testid="trending-item"]');
          expect(items.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.2: Each item shows resolution (Requirement 4.3)', () => {
    fc.assert(
      fc.property(
        debatesArrayArb(1, 10).filter(debates => debates.some(d => d.debate.status === 'active')),
        (debates) => {
          const { container } = render(<TrendingRail debates={debates} />);

          const resolutions = container.querySelectorAll('[data-testid="trending-resolution"]');
          const items = container.querySelectorAll('[data-testid="trending-item"]');

          // Each item should have a resolution
          expect(resolutions.length).toBe(items.length);

          // Each resolution should have text content
          resolutions.forEach(resolution => {
            expect(resolution.textContent?.trim().length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.3: Each item shows support percentage (Requirement 4.3)', () => {
    fc.assert(
      fc.property(
        debatesArrayArb(1, 10).filter(debates => debates.some(d => d.debate.status === 'active')),
        (debates) => {
          const { container } = render(<TrendingRail debates={debates} />);

          const supportElements = container.querySelectorAll('[data-testid="trending-support"]');
          const items = container.querySelectorAll('[data-testid="trending-item"]');

          // Each item should have support percentage
          expect(supportElements.length).toBe(items.length);

          // Each support element should contain percentage text
          supportElements.forEach(support => {
            expect(support.textContent).toMatch(/\d+%\s*support/i);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.4: Items with mind changes show delta indicator (Requirement 4.3)', () => {
    fc.assert(
      fc.property(
        debatesArrayArb(1, 10).filter(debates => 
          debates.some(d => d.debate.status === 'active' && (d.marketPrice?.mindChangeCount ?? 0) > 0)
        ),
        (debates) => {
          const { container } = render(<TrendingRail debates={debates} />);

          // Get active debates with mind changes
          const activeWithMindChanges = debates.filter(
            d => d.debate.status === 'active' && (d.marketPrice?.mindChangeCount ?? 0) > 0
          );

          if (activeWithMindChanges.length > 0) {
            const mindChangeElements = container.querySelectorAll('[data-testid="trending-mind-changes"]');
            expect(mindChangeElements.length).toBeGreaterThan(0);

            // Each mind change element should contain delta symbol
            mindChangeElements.forEach(element => {
              expect(element.textContent).toContain('Δ');
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.5: Items are sorted by mind changes descending (Requirement 4.4)', () => {
    fc.assert(
      fc.property(
        debatesArrayArb(3, 10).filter(debates => 
          debates.filter(d => d.debate.status === 'active').length >= 2
        ),
        (debates) => {
          const { container } = render(<TrendingRail debates={debates} />);

          // Get the displayed mind change counts in order
          const mindChangeElements = container.querySelectorAll('[data-testid="trending-mind-changes"]');
          const displayedCounts: number[] = [];

          mindChangeElements.forEach(element => {
            const text = element.textContent || '';
            const match = text.match(/(\d+)/);
            if (match) {
              displayedCounts.push(parseInt(match[1], 10));
            }
          });

          // Verify descending order (allowing equal values)
          for (let i = 1; i < displayedCounts.length; i++) {
            expect(displayedCounts[i]).toBeLessThanOrEqual(displayedCounts[i - 1]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.6: Maximum 5 items are displayed by default (Requirement 4.2)', () => {
    fc.assert(
      fc.property(
        debatesArrayArb(6, 15).map(debates => 
          // Ensure all are active to test the limit
          debates.map(d => ({ ...d, debate: { ...d.debate, status: 'active' as const } }))
        ),
        (debates) => {
          const { container } = render(<TrendingRail debates={debates} />);

          const items = container.querySelectorAll('[data-testid="trending-item"]');
          expect(items.length).toBeLessThanOrEqual(5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.7: maxCount prop limits displayed items (Requirement 4.2)', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          debatesArrayArb(5, 15).map(debates => 
            debates.map(d => ({ ...d, debate: { ...d.debate, status: 'active' as const } }))
          ),
          fc.integer({ min: 1, max: 10 })
        ),
        ([debates, maxCount]) => {
          const { container } = render(<TrendingRail debates={debates} maxCount={maxCount} />);

          const items = container.querySelectorAll('[data-testid="trending-item"]');
          expect(items.length).toBeLessThanOrEqual(maxCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.8: Only active debates are shown (Requirement 4.4)', () => {
    fc.assert(
      fc.property(
        debatesArrayArb(1, 10),
        (debates) => {
          const { container } = render(<TrendingRail debates={debates} />);

          const items = container.querySelectorAll('[data-testid="trending-item"]');
          const activeDebates = debates.filter(d => d.debate.status === 'active');

          // Should show at most the number of active debates (capped at 5)
          expect(items.length).toBeLessThanOrEqual(Math.min(activeDebates.length, 5));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.9: Returns null when no active debates (Requirement 4.2)', () => {
    fc.assert(
      fc.property(
        debatesArrayArb(0, 10).map(debates => 
          debates.map(d => ({ ...d, debate: { ...d.debate, status: 'concluded' as const } }))
        ),
        (debates) => {
          const { container } = render(<TrendingRail debates={debates} />);

          const trendingRail = container.querySelector('[data-testid="trending-rail"]');
          expect(trendingRail).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.10: Each item has a rank indicator (Requirement 4.2)', () => {
    fc.assert(
      fc.property(
        debatesArrayArb(1, 10).filter(debates => debates.some(d => d.debate.status === 'active')),
        (debates) => {
          const { container } = render(<TrendingRail debates={debates} />);

          const rankElements = container.querySelectorAll('[data-testid="trending-rank"]');
          const items = container.querySelectorAll('[data-testid="trending-item"]');

          // Each item should have a rank
          expect(rankElements.length).toBe(items.length);

          // Ranks should be sequential starting from 1
          rankElements.forEach((rank, index) => {
            expect(rank.textContent).toBe(String(index + 1));
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.11: Trending indicator is visible (Requirement 4.2)', () => {
    fc.assert(
      fc.property(
        debatesArrayArb(1, 10).filter(debates => debates.some(d => d.debate.status === 'active')),
        (debates) => {
          const { container } = render(<TrendingRail debates={debates} />);

          const indicator = container.querySelector('[data-testid="trending-indicator"]');
          expect(indicator).not.toBeNull();
          
          // Should have pulse animation class
          expect(indicator?.classList.contains('animate-pulse')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
