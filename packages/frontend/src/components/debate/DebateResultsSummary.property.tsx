/**
 * Property-based tests for DebateResultsSummary component.
 * 
 * Property 16: Results Summary Completeness
 * For any concluded debate, the results summary SHALL contain:
 * finalSupportPrice, finalOpposePrice, totalMindChanges, netPersuasionDelta, and winnerSide.
 * 
 * **Validates: Requirements 5.4**
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, cleanup } from '@testing-library/react';
import {
  DebateResultsSummary,
  deriveWinnerSide,
  calculateNetPersuasionDelta,
  extractResultsData,
  isResultsComplete,
} from './DebateResultsSummary';
import type { Debate, MarketPrice, RoundNumber, Side } from '@thesis/shared';

// ============================================
// Arbitraries
// ============================================

const roundNumberArb = fc.constantFrom(1, 2, 3) as fc.Arbitrary<RoundNumber>;
const sideArb = fc.constantFrom('support', 'oppose') as fc.Arbitrary<Side>;

const concludedDebateArb: fc.Arbitrary<Debate> = fc.record({
  id: fc.uuid(),
  resolution: fc.string({ minLength: 1, maxLength: 500 }),
  status: fc.constant('concluded' as const),
  currentRound: fc.constant(3 as RoundNumber),
  currentTurn: sideArb,
  supportDebaterId: fc.uuid(),
  opposeDebaterId: fc.uuid(),
  createdAt: fc.date(),
  concludedAt: fc.date(),
});

const marketPriceArb: fc.Arbitrary<MarketPrice> = fc.record({
  supportPrice: fc.float({ min: 0, max: 100, noNaN: true }),
  opposePrice: fc.float({ min: 0, max: 100, noNaN: true }),
  totalVotes: fc.integer({ min: 0, max: 10000 }),
  mindChangeCount: fc.integer({ min: 0, max: 1000 }),
}).map(mp => ({
  ...mp,
  opposePrice: 100 - mp.supportPrice, // Ensure they sum to 100
}));

// ============================================
// Property Tests
// ============================================

describe('DebateResultsSummary Property Tests', () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * Property 16: Results Summary Completeness
   * For any concluded debate, the results summary SHALL contain:
   * finalSupportPrice, finalOpposePrice, totalMindChanges, netPersuasionDelta, and winnerSide.
   * **Validates: Requirements 5.4**
   */
  describe('Property 16: Results Summary Completeness', () => {
    it('extractResultsData always returns all required fields', () => {
      fc.assert(
        fc.property(
          fc.option(marketPriceArb, { nil: null }),
          (marketPrice) => {
            const results = extractResultsData(marketPrice);
            
            // Verify all required fields are present
            expect(results).toHaveProperty('finalSupportPrice');
            expect(results).toHaveProperty('finalOpposePrice');
            expect(results).toHaveProperty('totalMindChanges');
            expect(results).toHaveProperty('netPersuasionDelta');
            expect(results).toHaveProperty('winnerSide');
            
            // Verify types
            expect(typeof results.finalSupportPrice).toBe('number');
            expect(typeof results.finalOpposePrice).toBe('number');
            expect(typeof results.totalMindChanges).toBe('number');
            expect(typeof results.netPersuasionDelta).toBe('number');
            expect(['support', 'oppose', 'tie']).toContain(results.winnerSide);
            
            // Verify completeness check passes
            expect(isResultsComplete(results)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rendered component displays all required data elements', () => {
      fc.assert(
        fc.property(
          concludedDebateArb,
          marketPriceArb,
          (debate, marketPrice) => {
            cleanup();
            
            const { getByTestId, queryByTestId } = render(
              <DebateResultsSummary debate={debate} marketPrice={marketPrice} />
            );
            
            // Verify all required elements are rendered
            expect(queryByTestId('debate-results-summary')).not.toBeNull();
            expect(queryByTestId('winner-banner')).not.toBeNull();
            expect(queryByTestId('final-support-price')).not.toBeNull();
            expect(queryByTestId('final-oppose-price')).not.toBeNull();
            expect(queryByTestId('total-mind-changes')).not.toBeNull();
            expect(queryByTestId('net-persuasion-delta')).not.toBeNull();
            expect(queryByTestId('persuasion-bar')).not.toBeNull();
            
            // Verify winner banner has correct winner attribute
            const winnerBanner = getByTestId('winner-banner');
            const expectedWinner = deriveWinnerSide(marketPrice.supportPrice);
            expect(winnerBanner.getAttribute('data-winner')).toBe(expectedWinner);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('does not render for non-concluded debates', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            resolution: fc.string({ minLength: 1, maxLength: 500 }),
            status: fc.constant('active' as const),
            currentRound: roundNumberArb,
            currentTurn: sideArb,
            supportDebaterId: fc.uuid(),
            opposeDebaterId: fc.option(fc.uuid(), { nil: null }),
            createdAt: fc.date(),
            concludedAt: fc.constant(null),
          }),
          marketPriceArb,
          (debate, marketPrice) => {
            cleanup();
            
            const { queryByTestId } = render(
              <DebateResultsSummary debate={debate} marketPrice={marketPrice} />
            );
            
            // Should not render for active debates
            expect(queryByTestId('debate-results-summary')).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================
// Unit Tests for Helper Functions
// ============================================

describe('deriveWinnerSide', () => {
  it('returns support when supportPrice > 50', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(51), max: 100, noNaN: true }),
        (supportPrice) => {
          expect(deriveWinnerSide(supportPrice)).toBe('support');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns oppose when supportPrice < 50', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: Math.fround(49), noNaN: true }),
        (supportPrice) => {
          expect(deriveWinnerSide(supportPrice)).toBe('oppose');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns tie when supportPrice is exactly 50', () => {
    expect(deriveWinnerSide(50)).toBe('tie');
  });
});

describe('calculateNetPersuasionDelta', () => {
  it('returns absolute distance from 50', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100, noNaN: true }),
        (supportPrice) => {
          const delta = calculateNetPersuasionDelta(supportPrice);
          expect(delta).toBe(Math.abs(supportPrice - 50));
          expect(delta).toBeGreaterThanOrEqual(0);
          expect(delta).toBeLessThanOrEqual(50);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns 0 when supportPrice is 50', () => {
    expect(calculateNetPersuasionDelta(50)).toBe(0);
  });

  it('returns 50 when supportPrice is 0 or 100', () => {
    expect(calculateNetPersuasionDelta(0)).toBe(50);
    expect(calculateNetPersuasionDelta(100)).toBe(50);
  });
});

describe('extractResultsData', () => {
  it('handles null marketPrice with defaults', () => {
    const results = extractResultsData(null);
    
    expect(results.finalSupportPrice).toBe(50);
    expect(results.finalOpposePrice).toBe(50);
    expect(results.totalMindChanges).toBe(0);
    expect(results.netPersuasionDelta).toBe(0);
    expect(results.winnerSide).toBe('tie');
  });

  it('extracts correct values from marketPrice', () => {
    fc.assert(
      fc.property(
        marketPriceArb,
        (marketPrice) => {
          const results = extractResultsData(marketPrice);
          
          expect(results.finalSupportPrice).toBe(marketPrice.supportPrice);
          expect(results.finalOpposePrice).toBe(marketPrice.opposePrice);
          expect(results.totalMindChanges).toBe(marketPrice.mindChangeCount);
          expect(results.netPersuasionDelta).toBe(Math.abs(marketPrice.supportPrice - 50));
          expect(results.winnerSide).toBe(deriveWinnerSide(marketPrice.supportPrice));
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('isResultsComplete', () => {
  it('returns true for valid results data', () => {
    fc.assert(
      fc.property(
        fc.option(marketPriceArb, { nil: null }),
        (marketPrice) => {
          const results = extractResultsData(marketPrice);
          expect(isResultsComplete(results)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns false for incomplete results', () => {
    // Missing fields
    expect(isResultsComplete({} as any)).toBe(false);
    
    // Invalid winnerSide
    expect(isResultsComplete({
      finalSupportPrice: 50,
      finalOpposePrice: 50,
      totalMindChanges: 0,
      netPersuasionDelta: 0,
      winnerSide: 'invalid' as any,
    })).toBe(false);
  });
});
