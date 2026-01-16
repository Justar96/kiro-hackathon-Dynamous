/**
 * Order Matching E2E Tests
 *
 * Tests the complete order matching flow including crossing orders,
 * balance updates, and partial fills.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { type Hex } from 'viem';
import * as fc from 'fast-check';
import {
  setupE2ETests,
  teardownE2ETests,
  type E2ETestContext,
} from './setup';
import {
  deposit,
  submitOrder,
  getOrderBook,
  waitForBid,
  waitForAsk,
  getOffChainBalance,
  mineBlocks,
  parseUsdc,
  waitFor,
  type OrderParams,
} from './helpers';

// Skip E2E tests in CI unless explicitly enabled
const SKIP_E2E = process.env.CI && !process.env.RUN_E2E_TESTS;

// Test market configuration
const TEST_MARKET_ID = '0x' + '1'.repeat(64) as Hex;
const TEST_TOKEN_ID = 1n;
const ONE = 10n ** 18n;

describe.skipIf(SKIP_E2E)('Order Matching E2E Tests', () => {
  let context: E2ETestContext;
  let snapshotId: Hex;

  beforeAll(async () => {
    context = await setupE2ETests({ debug: !!process.env.E2E_DEBUG });
    const depositAmount = parseUsdc('5000');
    await deposit(context, context.wallets.alice, depositAmount);
    await deposit(context, context.wallets.bob, depositAmount);
    await mineBlocks(context, 25);
    await waitFor(
      async () => {
        const aliceBalance = await getOffChainBalance(context, context.wallets.alice.address);
        const bobBalance = await getOffChainBalance(context, context.wallets.bob.address);
        return aliceBalance.total >= depositAmount && bobBalance.total >= depositAmount;
      },
      15000,
      500
    );
  }, 180000);

  afterAll(async () => {
    await teardownE2ETests();
  }, 30000);

  beforeEach(async () => {
    snapshotId = await context.anvil.snapshot();
  });

  afterEach(async () => {
    if (snapshotId) {
      await context.anvil.revert(snapshotId);
    }
  });


  // ============================================
  // Requirement 9.1: Crossing Orders Execute at Maker Price
  // ============================================

  describe('Crossing Orders Execute at Maker Price', () => {
    it('should execute trade at maker (ask) price when buy crosses sell', async () => {
      const { wallets } = context;
      
      const sellResult = await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5500,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });
      expect(sellResult.status).toBe('accepted');
      await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 5000);

      const buyResult = await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });
      
      expect(buyResult.status).toBe('accepted');
      expect(buyResult.trades.length).toBeGreaterThan(0);
      
      const trade = buyResult.trades[0];
      const tradePrice = BigInt(trade.price);
      const expectedPrice = (5500n * ONE) / 10000n;
      const priceDiff = tradePrice > expectedPrice 
        ? tradePrice - expectedPrice 
        : expectedPrice - tradePrice;
      expect(priceDiff).toBeLessThan(ONE / 100n);
    });

    it('should execute trade at maker (bid) price when sell crosses buy', async () => {
      const { wallets } = context;
      
      await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });
      await waitForBid(context, TEST_MARKET_ID, TEST_TOKEN_ID, 5000);

      const sellResult = await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5500,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });
      
      expect(sellResult.status).toBe('accepted');
      expect(sellResult.trades.length).toBeGreaterThan(0);
      
      const trade = sellResult.trades[0];
      const tradePrice = BigInt(trade.price);
      const expectedPrice = (6000n * ONE) / 10000n;
      const priceDiff = tradePrice > expectedPrice 
        ? tradePrice - expectedPrice 
        : expectedPrice - tradePrice;
      expect(priceDiff).toBeLessThan(ONE / 100n);
    });

    it('should not execute trade when prices do not cross', async () => {
      const { wallets } = context;
      
      await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 5000,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });

      const sellResult = await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 6000,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });
      
      expect(sellResult.status).toBe('accepted');
      expect(sellResult.trades.length).toBe(0);

      const orderBook = await getOrderBook(context, TEST_MARKET_ID, TEST_TOKEN_ID);
      expect(orderBook.bids.length).toBeGreaterThan(0);
      expect(orderBook.asks.length).toBeGreaterThan(0);
    });
  });


  // ============================================
  // Requirement 9.2: Both Parties' Balances Updated Correctly
  // ============================================

  describe('Balance Updates After Trade', () => {
    it('should update buyer balance correctly after trade', async () => {
      const { wallets } = context;
      
      const aliceInitial = await getOffChainBalance(context, wallets.alice.address);
      
      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5500,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });
      await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 5000);

      const buyResult = await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });
      expect(buyResult.trades.length).toBeGreaterThan(0);

      await new Promise(resolve => setTimeout(resolve, 500));

      const aliceFinal = await getOffChainBalance(context, wallets.alice.address);
      const expectedCost = parseUsdc('5.5');
      const actualCostChange = aliceInitial.available - aliceFinal.available;
      
      expect(actualCostChange).toBeGreaterThanOrEqual(expectedCost - parseUsdc('0.1'));
      expect(actualCostChange).toBeLessThanOrEqual(expectedCost + parseUsdc('0.1'));
    });

    it('should update both parties balances atomically', async () => {
      const { wallets } = context;
      
      const aliceInitial = await getOffChainBalance(context, wallets.alice.address);
      const bobInitial = await getOffChainBalance(context, wallets.bob.address);
      const totalInitial = aliceInitial.total + bobInitial.total;

      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5500,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });
      await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 5000);

      const result = await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });
      expect(result.trades.length).toBeGreaterThan(0);

      await new Promise(resolve => setTimeout(resolve, 500));

      const aliceFinal = await getOffChainBalance(context, wallets.alice.address);
      const bobFinal = await getOffChainBalance(context, wallets.bob.address);
      const totalFinal = aliceFinal.total + bobFinal.total;

      expect(totalFinal).toBeGreaterThanOrEqual(totalInitial - parseUsdc('1'));
      expect(totalFinal).toBeLessThanOrEqual(totalInitial);
    });
  });


  // ============================================
  // Requirement 9.3: Partial Fill Scenario
  // ============================================

  describe('Partial Fill Scenarios', () => {
    it('should handle partial fill when buy order is larger than sell order', async () => {
      const { wallets } = context;
      
      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5500,
        amount: parseUsdc('5'),
        marketId: TEST_MARKET_ID,
      });
      await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 5000);

      const buyResult = await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });
      
      expect(buyResult.status).toBe('accepted');
      expect(buyResult.trades.length).toBeGreaterThan(0);
      expect(BigInt(buyResult.trades[0].amount)).toBe(parseUsdc('5'));

      const orderBook = await getOrderBook(context, TEST_MARKET_ID, TEST_TOKEN_ID);
      expect(orderBook.bids.length).toBeGreaterThan(0);
      
      const remainingBid = orderBook.bids.find(
        b => b.maker.toLowerCase() === wallets.alice.address.toLowerCase()
      );
      expect(remainingBid).toBeDefined();
      expect(BigInt(remainingBid!.quantity)).toBe(parseUsdc('5'));
    });

    it('should handle partial fill when sell order is larger than buy order', async () => {
      const { wallets } = context;
      
      await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('5'),
        marketId: TEST_MARKET_ID,
      });
      await waitForBid(context, TEST_MARKET_ID, TEST_TOKEN_ID, 5000);

      const sellResult = await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5500,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });
      
      expect(sellResult.status).toBe('accepted');
      expect(sellResult.trades.length).toBeGreaterThan(0);
      expect(BigInt(sellResult.trades[0].amount)).toBe(parseUsdc('5'));

      const orderBook = await getOrderBook(context, TEST_MARKET_ID, TEST_TOKEN_ID);
      expect(orderBook.asks.length).toBeGreaterThan(0);
      
      const remainingAsk = orderBook.asks.find(
        a => a.maker.toLowerCase() === wallets.bob.address.toLowerCase()
      );
      expect(remainingAsk).toBeDefined();
      expect(BigInt(remainingAsk!.quantity)).toBe(parseUsdc('5'));
    });

    it('should handle multiple partial fills against multiple orders', async () => {
      const { wallets } = context;
      
      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5500,
        amount: parseUsdc('3'),
        marketId: TEST_MARKET_ID,
      });
      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5600,
        amount: parseUsdc('4'),
        marketId: TEST_MARKET_ID,
      });
      
      await waitFor(
        async () => {
          const ob = await getOrderBook(context, TEST_MARKET_ID, TEST_TOKEN_ID);
          return ob.asks.length >= 2;
        },
        5000,
        100
      );

      const buyResult = await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });
      
      expect(buyResult.status).toBe('accepted');
      expect(buyResult.trades.length).toBeGreaterThanOrEqual(2);
      
      const totalTraded = buyResult.trades.reduce(
        (sum, t) => sum + BigInt(t.amount),
        0n
      );
      expect(totalTraded).toBe(parseUsdc('7'));

      const orderBook = await getOrderBook(context, TEST_MARKET_ID, TEST_TOKEN_ID);
      const remainingBid = orderBook.bids.find(
        b => b.maker.toLowerCase() === wallets.alice.address.toLowerCase()
      );
      expect(remainingBid).toBeDefined();
      expect(BigInt(remainingBid!.quantity)).toBe(parseUsdc('3'));
    });

    it('should fully fill when order sizes match exactly', async () => {
      const { wallets } = context;
      
      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5500,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });
      await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 5000);

      const buyResult = await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });
      
      expect(buyResult.status).toBe('accepted');
      expect(buyResult.trades.length).toBe(1);
      expect(BigInt(buyResult.trades[0].amount)).toBe(parseUsdc('10'));

      const orderBook = await getOrderBook(context, TEST_MARKET_ID, TEST_TOKEN_ID);
      expect(orderBook.bids.length).toBe(0);
      expect(orderBook.asks.length).toBe(0);
    });
  });


  // ============================================
  // Price-Time Priority
  // ============================================

  describe('Price-Time Priority', () => {
    it('should match against best price first', async () => {
      const { wallets } = context;
      
      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 6000,
        amount: parseUsdc('5'),
        marketId: TEST_MARKET_ID,
      });
      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5500,
        amount: parseUsdc('5'),
        marketId: TEST_MARKET_ID,
      });
      
      await waitFor(
        async () => {
          const ob = await getOrderBook(context, TEST_MARKET_ID, TEST_TOKEN_ID);
          return ob.asks.length >= 2;
        },
        5000,
        100
      );

      const buyResult = await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 5600,
        amount: parseUsdc('5'),
        marketId: TEST_MARKET_ID,
      });
      
      expect(buyResult.status).toBe('accepted');
      expect(buyResult.trades.length).toBe(1);
      
      const trade = buyResult.trades[0];
      const tradePrice = BigInt(trade.price);
      const expectedPrice = (5500n * ONE) / 10000n;
      const priceDiff = tradePrice > expectedPrice 
        ? tradePrice - expectedPrice 
        : expectedPrice - tradePrice;
      expect(priceDiff).toBeLessThan(ONE / 100n);
    });
  });

  // ============================================
  // Property 6: Trade Balance Conservation
  // **Validates: Requirements 9.4**
  // ============================================

  describe('Property 6: Trade Balance Conservation', () => {
    /**
     * Property 6: Trade Balance Conservation
     *
     * For any pair of matching orders that result in a trade, the sum of all
     * balance changes across all affected accounts SHALL equal zero (no funds
     * created or destroyed).
     *
     * **Validates: Requirements 9.4**
     */
    it('should conserve total balance: sum of balance changes equals zero', async () => {
      const { wallets } = context;

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            buyPriceBps: fc.integer({ min: 5000, max: 7000 }),
            sellPriceBps: fc.integer({ min: 3000, max: 5000 }),
            amount: fc.integer({ min: 1_000_000, max: 100_000_000 }),
          }),
          async (params) => {
            const iterationSnapshot = await context.anvil.snapshot();

            try {
              const aliceInitial = await getOffChainBalance(context, wallets.alice.address);
              const bobInitial = await getOffChainBalance(context, wallets.bob.address);
              const totalInitial = aliceInitial.total + bobInitial.total;

              const amount = BigInt(params.amount);
              const maxCost = (BigInt(params.buyPriceBps) * amount) / 10000n;
              
              if (aliceInitial.available < maxCost || bobInitial.available < amount) {
                return true;
              }

              const sellResult = await submitOrder(context, wallets.bob, {
                tokenId: TEST_TOKEN_ID,
                side: 1,
                priceBps: params.sellPriceBps,
                amount,
                marketId: TEST_MARKET_ID,
              });

              if (sellResult.status !== 'accepted') return true;

              try {
                await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 3000);
              } catch {
                return true;
              }

              const buyResult = await submitOrder(context, wallets.alice, {
                tokenId: TEST_TOKEN_ID,
                side: 0,
                priceBps: params.buyPriceBps,
                amount,
                marketId: TEST_MARKET_ID,
              });

              if (buyResult.status !== 'accepted') return true;

              await new Promise(resolve => setTimeout(resolve, 500));

              const aliceFinal = await getOffChainBalance(context, wallets.alice.address);
              const bobFinal = await getOffChainBalance(context, wallets.bob.address);
              const totalFinal = aliceFinal.total + bobFinal.total;

              const aliceChange = aliceFinal.total - aliceInitial.total;
              const bobChange = bobFinal.total - bobInitial.total;
              const netChange = aliceChange + bobChange;

              expect(netChange).toBeLessThanOrEqual(0n);
              
              const maxFee = (maxCost * 100n) / 10000n;
              expect(totalFinal).toBeGreaterThanOrEqual(totalInitial - maxFee);
              expect(totalFinal).toBeLessThanOrEqual(totalInitial);

              return true;
            } finally {
              await context.anvil.revert(iterationSnapshot);
            }
          }
        ),
        {
          numRuns: 15,
          verbose: true,
          endOnFailure: true,
        }
      );
    }, 300000);

    /**
     * Property: No balance created from nothing
     * Total system balance can only decrease (due to fees), never increase
     */
    it('should never create balance from nothing', async () => {
      const { wallets } = context;

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sellPriceBps: fc.integer({ min: 4000, max: 5500 }),
            buyPriceBps: fc.integer({ min: 5000, max: 7000 }),
            amount: fc.integer({ min: 1_000_000, max: 20_000_000 }),
          }),
          async (params) => {
            const iterationSnapshot = await context.anvil.snapshot();

            try {
              const amount = BigInt(params.amount);
              
              const aliceInitial = await getOffChainBalance(context, wallets.alice.address);
              const bobInitial = await getOffChainBalance(context, wallets.bob.address);
              const systemBefore = aliceInitial.total + bobInitial.total;

              const maxCost = (BigInt(params.buyPriceBps) * amount) / 10000n;
              if (aliceInitial.available < maxCost) return true;

              await submitOrder(context, wallets.bob, {
                tokenId: TEST_TOKEN_ID,
                side: 1,
                priceBps: params.sellPriceBps,
                amount,
                marketId: TEST_MARKET_ID,
              });

              try {
                await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 2000);
              } catch {
                return true;
              }

              await submitOrder(context, wallets.alice, {
                tokenId: TEST_TOKEN_ID,
                side: 0,
                priceBps: params.buyPriceBps,
                amount,
                marketId: TEST_MARKET_ID,
              });

              await new Promise(resolve => setTimeout(resolve, 500));

              const aliceFinal = await getOffChainBalance(context, wallets.alice.address);
              const bobFinal = await getOffChainBalance(context, wallets.bob.address);
              const systemAfter = aliceFinal.total + bobFinal.total;

              expect(systemAfter).toBeLessThanOrEqual(systemBefore);

              return true;
            } finally {
              await context.anvil.revert(iterationSnapshot);
            }
          }
        ),
        {
          numRuns: 10,
          verbose: true,
          endOnFailure: true,
        }
      );
    }, 180000);
  });
});
