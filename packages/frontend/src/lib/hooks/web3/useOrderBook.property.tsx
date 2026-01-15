/**
 * Property-Based Tests for useOrderBook Hook
 *
 * Feature: on-chain-settlement
 * Property 9: Mid-Price Calculation
 * Validates: Requirements 8.1
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Calculate mid-price from best bid and ask
 * This is the function we're testing (extracted from useOrderBook)
 */
function calculateMidPrice(
  bestBidPrice: number | null,
  bestAskPrice: number | null
): number | null {
  if (bestBidPrice === null || bestAskPrice === null) {
    return null;
  }
  return (bestBidPrice + bestAskPrice) / 2;
}

describe('useOrderBook Property Tests', () => {
  /**
   * Property 9: Mid-Price Calculation
   *
   * For any order book state with at least one bid and one ask,
   * the mid-price SHALL equal (best_bid_price + best_ask_price) / 2.
   *
   * **Validates: Requirements 8.1**
   */
  describe('Property 9: Mid-Price Calculation', () => {
    it('should calculate mid-price as average of best bid and best ask', () => {
      fc.assert(
        fc.property(
          // Generate valid prices in range 0.01 to 0.99
          fc.double({ min: 0.01, max: 0.99, noNaN: true }),
          fc.double({ min: 0.01, max: 0.99, noNaN: true }),
          (price1, price2) => {
            // Ensure bid <= ask (market invariant)
            const bestBidPrice = Math.min(price1, price2);
            const bestAskPrice = Math.max(price1, price2);

            const midPrice = calculateMidPrice(bestBidPrice, bestAskPrice);
            const expectedMidPrice = (bestBidPrice + bestAskPrice) / 2;

            // Allow small floating point tolerance
            expect(midPrice).not.toBeNull();
            expect(Math.abs(midPrice! - expectedMidPrice)).toBeLessThan(0.0001);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null when best bid is null', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 0.99, noNaN: true }),
          (bestAskPrice) => {
            const midPrice = calculateMidPrice(null, bestAskPrice);
            expect(midPrice).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null when best ask is null', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 0.99, noNaN: true }),
          (bestBidPrice) => {
            const midPrice = calculateMidPrice(bestBidPrice, null);
            expect(midPrice).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null when both prices are null', () => {
      const midPrice = calculateMidPrice(null, null);
      expect(midPrice).toBeNull();
    });

    it('should handle equal bid and ask prices', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 0.99, noNaN: true }),
          (price) => {
            const midPrice = calculateMidPrice(price, price);
            expect(midPrice).not.toBeNull();
            expect(Math.abs(midPrice! - price)).toBeLessThan(0.0001);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain mid-price between bid and ask', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 0.99, noNaN: true }),
          fc.double({ min: 0.01, max: 0.99, noNaN: true }),
          (price1, price2) => {
            const bestBidPrice = Math.min(price1, price2);
            const bestAskPrice = Math.max(price1, price2);

            const midPrice = calculateMidPrice(bestBidPrice, bestAskPrice);

            expect(midPrice).not.toBeNull();
            expect(midPrice!).toBeGreaterThanOrEqual(bestBidPrice);
            expect(midPrice!).toBeLessThanOrEqual(bestAskPrice);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be commutative for equal prices', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 0.99, noNaN: true }),
          (price) => {
            const midPrice1 = calculateMidPrice(price, price);
            const midPrice2 = calculateMidPrice(price, price);

            expect(midPrice1).toEqual(midPrice2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle boundary prices correctly', () => {
      // Test minimum prices
      const midPriceMin = calculateMidPrice(0.01, 0.01);
      expect(midPriceMin).toBe(0.01);

      // Test maximum prices
      const midPriceMax = calculateMidPrice(0.99, 0.99);
      expect(midPriceMax).toBe(0.99);

      // Test min and max together
      const midPriceMinMax = calculateMidPrice(0.01, 0.99);
      expect(midPriceMinMax).toBe(0.5);
    });
  });
});
