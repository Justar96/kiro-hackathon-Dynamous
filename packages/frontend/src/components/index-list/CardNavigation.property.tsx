/**
 * Property-based tests for Card Navigation.
 * 
 * Feature: reddit-style-feed
 * Property 5: Card Navigation
 * 
 * Validates: Requirements 3.2
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, cleanup } from '@testing-library/react';
import { CompactDebateCard } from './CompactDebateCard';
import type { Debate, MarketPrice } from '@thesis/shared';

// Mock TanStack Router's Link component
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, ...props }: { 
    children: React.ReactNode; 
    to: string; 
    params?: Record<string, string>;
    [key: string]: unknown 
  }) => {
    // Construct the actual URL from to and params
    let href = to;
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        href = href.replace(`$${key}`, value);
      });
    }
    return <a href={href} data-to={to} data-params={JSON.stringify(params)} {...props}>{children}</a>;
  },
}));

// Mock the usePrefetch hook - must match the actual import path
vi.mock('../../lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib')>();
  return {
    ...actual,
    useDebateLinkPrefetch: (debateId: string) => ({
      'data-prefetch-id': debateId,
    }),
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

describe('Card Navigation Property Tests', () => {
  /**
   * Property 5: Card Navigation
   * For any debate card:
   * - Clicking the card SHALL navigate to the debate detail page
   * - The navigation URL SHALL include the correct debate ID
   * - Prefetch SHALL be triggered on hover
   * 
   * Validates: Requirements 3.2
   */

  it('Property 5.1: Card is wrapped in a link to debate detail page (Requirement 3.2)', () => {
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

          // Card should be wrapped in a link
          const link = container.querySelector('a');
          expect(link).not.toBeNull();

          // Link should point to debate detail page
          expect(link?.getAttribute('data-to')).toBe('/debates/$debateId');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.2: Navigation URL includes correct debate ID (Requirement 3.2)', () => {
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

          const link = container.querySelector('a');
          expect(link).not.toBeNull();

          // Check that params include the correct debate ID
          const params = JSON.parse(link?.getAttribute('data-params') || '{}');
          expect(params.debateId).toBe(debate.id);

          // Check that href is constructed correctly
          expect(link?.getAttribute('href')).toBe(`/debates/${debate.id}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.3: Prefetch props are applied to link (Requirement 5.5)', () => {
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

          const link = container.querySelector('a');
          expect(link).not.toBeNull();

          // Prefetch props should be applied
          expect(link?.getAttribute('data-prefetch-id')).toBe(debate.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.4: Card article has correct aria-labelledby for accessibility (Requirement 3.2)', () => {
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

          const article = container.querySelector('article');
          expect(article).not.toBeNull();

          // Article should have aria-labelledby pointing to resolution
          const labelledBy = article?.getAttribute('aria-labelledby');
          expect(labelledBy).toBe(`compact-resolution-${debate.id}`);

          // The referenced element should exist
          const resolution = container.querySelector(`#${labelledBy}`);
          expect(resolution).not.toBeNull();
          expect(resolution?.textContent).toBe(debate.resolution);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.5: Link has group class for hover state propagation (Requirement 3.2)', () => {
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

          const link = container.querySelector('a');
          expect(link).not.toBeNull();

          // Link should have group class for hover state propagation
          expect(link?.classList.contains('group')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.6: Resolution text has group-hover class for visual feedback (Requirement 3.2)', () => {
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

          const resolution = container.querySelector('[data-testid="resolution-text"]');
          expect(resolution).not.toBeNull();

          // Resolution should have group-hover class for visual feedback
          expect(resolution?.classList.toString()).toContain('group-hover:text-accent');
        }
      ),
      { numRuns: 100 }
    );
  });
});
