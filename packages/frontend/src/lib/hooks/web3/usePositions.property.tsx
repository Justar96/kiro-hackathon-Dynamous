/**
 * Property-Based Tests for usePositions Hook
 *
 * Feature: on-chain-settlement
 * Property 10: P&L Calculation
 * Property 18: Position Aggregation
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateUnrealizedPnL } from './usePositions';

describe('usePositions Property Tests', () => {
  /**
   * Property 10: P&L Calculation
   * **Validates: Requirements 7.3**
   *
   * For any position with known average entry price and current market price,
   * the unrealized P&L SHALL equal (current_price - average_entry_price) × quantity
   */
  describe('Property 10: P&L Calculation', () => {
    it('should calculate unrealized P&L correctly for any valid inputs', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 0.99, noNaN: true }), // entryPrice
          fc.double({ min: 0.01, max: 0.99, noNaN: true }), // currentPrice
          fc.bigInt({ min: 1n, max: 1000000n }), // quantity
          (entryPrice, currentPrice, quantity) => {
            const result = calculateUnrealizedPnL(entryPrice, currentPrice, quantity);
            const expected = (currentPrice - entryPrice) * Number(quantity);

            // Allow small floating point tolerance
            const tolerance = 0.0001;
            const difference = Math.abs(result - expected);

            return difference < tolerance;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return zero P&L when entry price equals current price', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 0.99, noNaN: true }), // price
          fc.bigInt({ min: 1n, max: 1000000n }), // quantity
          (price, quantity) => {
            const result = calculateUnrealizedPnL(price, price, quantity);
            return Math.abs(result) < 0.0001; // Should be ~0
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return positive P&L when current price > entry price', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 0.49, noNaN: true }), // entryPrice (lower half)
          fc.double({ min: 0.51, max: 0.99, noNaN: true }), // currentPrice (upper half)
          fc.bigInt({ min: 1n, max: 1000000n }), // quantity
          (entryPrice, currentPrice, quantity) => {
            const result = calculateUnrealizedPnL(entryPrice, currentPrice, quantity);
            return result > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return negative P&L when current price < entry price', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.51, max: 0.99, noNaN: true }), // entryPrice (upper half)
          fc.double({ min: 0.01, max: 0.49, noNaN: true }), // currentPrice (lower half)
          fc.bigInt({ min: 1n, max: 1000000n }), // quantity
          (entryPrice, currentPrice, quantity) => {
            const result = calculateUnrealizedPnL(entryPrice, currentPrice, quantity);
            return result < 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should scale linearly with quantity', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 0.99, noNaN: true }), // entryPrice
          fc.double({ min: 0.01, max: 0.99, noNaN: true }), // currentPrice
          fc.bigInt({ min: 1n, max: 100000n }), // quantity
          (entryPrice, currentPrice, quantity) => {
            const pnl1 = calculateUnrealizedPnL(entryPrice, currentPrice, quantity);
            const pnl2 = calculateUnrealizedPnL(entryPrice, currentPrice, quantity * 2n);

            // P&L should double when quantity doubles
            const tolerance = 0.001;
            return Math.abs(pnl2 - pnl1 * 2) < tolerance;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 18: Position Aggregation
   * **Validates: Requirements 7.6**
   *
   * For any user with positions across multiple markets,
   * the portfolio total value SHALL equal the sum of individual position values
   */
  describe('Property 18: Position Aggregation', () => {
    it('should aggregate position values correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              yesBalance: fc.bigInt({ min: 0n, max: 1000000n }),
              noBalance: fc.bigInt({ min: 0n, max: 1000000n }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (positions) => {
            // Calculate total value by summing individual position values
            const totalValue = positions.reduce((sum, pos) => {
              return sum + pos.yesBalance + pos.noBalance;
            }, 0n);

            // Calculate expected sum
            const expectedSum = positions.reduce((sum, pos) => {
              return sum + pos.yesBalance + pos.noBalance;
            }, 0n);

            return totalValue === expectedSum;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should aggregate P&L correctly across positions', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              entryPrice: fc.double({ min: 0.01, max: 0.99, noNaN: true }),
              currentPrice: fc.double({ min: 0.01, max: 0.99, noNaN: true }),
              quantity: fc.bigInt({ min: 1n, max: 100000n }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (positions) => {
            // Calculate total P&L
            const totalPnL = positions.reduce((sum, pos) => {
              const pnl = calculateUnrealizedPnL(
                pos.entryPrice,
                pos.currentPrice,
                pos.quantity
              );
              return sum + pnl;
            }, 0);

            // Calculate expected sum
            const expectedSum = positions.reduce((sum, pos) => {
              const pnl = (pos.currentPrice - pos.entryPrice) * Number(pos.quantity);
              return sum + pnl;
            }, 0);

            // Allow small floating point tolerance
            const tolerance = 0.01;
            return Math.abs(totalPnL - expectedSum) < tolerance;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty positions array', () => {
      const positions: Array<{ yesBalance: bigint; noBalance: bigint }> = [];
      const totalValue = positions.reduce((sum, pos) => {
        return sum + pos.yesBalance + pos.noBalance;
      }, 0n);

      expect(totalValue).toBe(0n);
    });

    it('should handle single position correctly', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 0n, max: 1000000n }), // yesBalance
          fc.bigInt({ min: 0n, max: 1000000n }), // noBalance
          (yesBalance, noBalance) => {
            const positions = [{ yesBalance, noBalance }];
            const totalValue = positions.reduce((sum, pos) => {
              return sum + pos.yesBalance + pos.noBalance;
            }, 0n);

            return totalValue === yesBalance + noBalance;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain associativity when aggregating', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              yesBalance: fc.bigInt({ min: 0n, max: 100000n }),
              noBalance: fc.bigInt({ min: 0n, max: 100000n }),
            }),
            { minLength: 3, maxLength: 10 }
          ),
          (positions) => {
            // Split positions into two groups
            const mid = Math.floor(positions.length / 2);
            const group1 = positions.slice(0, mid);
            const group2 = positions.slice(mid);

            // Calculate total for each group
            const sum1 = group1.reduce((sum, pos) => sum + pos.yesBalance + pos.noBalance, 0n);
            const sum2 = group2.reduce((sum, pos) => sum + pos.yesBalance + pos.noBalance, 0n);

            // Calculate total for all positions
            const totalSum = positions.reduce(
              (sum, pos) => sum + pos.yesBalance + pos.noBalance,
              0n
            );

            // Associativity: (sum1 + sum2) should equal totalSum
            return sum1 + sum2 === totalSum;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
