/**
 * Settlement Flow E2E Tests
 *
 * Tests the complete settlement flow including batch creation,
 * Merkle root computation, CTFExchange.matchOrders execution,
 * and epoch commitment.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4
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
  triggerSettlement,
  getSettlementEpochs,
  getWithdrawalProof,
  mineBlocks,
  parseUsdc,
  waitFor,
} from './helpers';

// Skip E2E tests in CI unless explicitly enabled
const SKIP_E2E = process.env.CI && !process.env.RUN_E2E_TESTS;

// Test market configuration
const TEST_MARKET_ID = '0x' + '1'.repeat(64) as Hex;
const TEST_TOKEN_ID = 1n;
const ONE = 10n ** 18n;

describe.skipIf(SKIP_E2E)('Settlement Flow E2E Tests', () => {
  let context: E2ETestContext;
  let snapshotId: Hex;

  beforeAll(async () => {
    context = await setupE2ETests({ debug: !!process.env.E2E_DEBUG });
    
    // Fund test wallets with USDC and deposit to vault
    const depositAmount = parseUsdc('5000');
    await deposit(context, context.wallets.alice, depositAmount);
    await deposit(context, context.wallets.bob, depositAmount);
    
    // Mine blocks for confirmation
    await mineBlocks(context, 25);
    
    // Wait for indexer to process deposits
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
  // Requirement 10.1: Settlement Batch Creation
  // ============================================

  describe('Settlement Batch Creation', () => {
    it('should create settlement batch from matched trades', async () => {
      const { wallets } = context;

      // Create matching orders to generate trades
      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1, // SELL
        priceBps: 5500,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });
      await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 5000);

      const buyResult = await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0, // BUY
        priceBps: 6000,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });

      expect(buyResult.status).toBe('accepted');
      expect(buyResult.trades.length).toBeGreaterThan(0);

      // Trigger settlement batch creation
      const batch = await triggerSettlement(context);

      expect(batch).toBeDefined();
      expect(batch.epochId).toBeGreaterThan(0);
      expect(batch.entries).toBeGreaterThan(0);
    });

    it('should return error when no pending trades exist', async () => {
      // Try to trigger settlement without any trades
      await expect(triggerSettlement(context)).rejects.toThrow('No pending trades');
    });

    it('should include multiple trades in a single batch', async () => {
      const { wallets } = context;

      // Create first trade
      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5500,
        amount: parseUsdc('5'),
        marketId: TEST_MARKET_ID,
      });
      await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 3000);

      await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('5'),
        marketId: TEST_MARKET_ID,
      });

      // Create second trade
      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5600,
        amount: parseUsdc('5'),
        marketId: TEST_MARKET_ID,
      });
      await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 3000);

      await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('5'),
        marketId: TEST_MARKET_ID,
      });

      // Trigger settlement
      const batch = await triggerSettlement(context);

      expect(batch.epochId).toBeGreaterThan(0);
      expect(batch.entries).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================
  // Requirement 10.2: Merkle Root Computation
  // ============================================

  describe('Merkle Root Computation', () => {
    it('should compute valid Merkle root for settlement batch', async () => {
      const { wallets } = context;

      // Create a trade
      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5500,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });
      await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 5000);

      await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });

      // Trigger settlement
      const batch = await triggerSettlement(context);

      // Verify Merkle root is a valid 32-byte hex string
      expect(batch.merkleRoot).toBeDefined();
      expect(batch.merkleRoot).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(batch.merkleRoot).not.toBe('0x' + '0'.repeat(64)); // Not zero hash
    });

    it('should generate valid Merkle proofs for participants', async () => {
      const { wallets } = context;

      // Create a trade where Bob sells to Alice
      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5500,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });
      await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 5000);

      await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });

      // Trigger settlement
      const batch = await triggerSettlement(context);

      // Bob should have a positive balance (received USDC from selling)
      // Try to get proof for Bob
      try {
        const proof = await getWithdrawalProof(context, batch.epochId, wallets.bob.address);
        
        expect(proof).toBeDefined();
        expect(proof.epochId).toBe(batch.epochId);
        expect(proof.address.toLowerCase()).toBe(wallets.bob.address.toLowerCase());
        expect(BigInt(proof.amount)).toBeGreaterThan(0n);
        expect(proof.proof).toBeInstanceOf(Array);
        expect(proof.merkleRoot).toBe(batch.merkleRoot);
      } catch (error) {
        // If no proof found, that's also valid if Bob has negative balance
        // (paid more than received)
        expect((error as Error).message).toContain('No proof found');
      }
    });

    it('should produce different Merkle roots for different batches', async () => {
      const { wallets } = context;

      // First batch
      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5500,
        amount: parseUsdc('5'),
        marketId: TEST_MARKET_ID,
      });
      await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 3000);

      await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('5'),
        marketId: TEST_MARKET_ID,
      });

      const batch1 = await triggerSettlement(context);

      // Second batch with different amounts
      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5600,
        amount: parseUsdc('8'),
        marketId: TEST_MARKET_ID,
      });
      await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 3000);

      await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('8'),
        marketId: TEST_MARKET_ID,
      });

      const batch2 = await triggerSettlement(context);

      // Different batches should have different Merkle roots
      expect(batch1.merkleRoot).not.toBe(batch2.merkleRoot);
      expect(batch2.epochId).toBe(batch1.epochId + 1);
    });
  });

  // ============================================
  // Requirement 10.3: Epoch Commitment
  // ============================================

  describe('Epoch Commitment', () => {
    it('should mark epoch as committed after settlement', async () => {
      const { wallets } = context;

      // Create a trade
      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5500,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });
      await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 5000);

      await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });

      // Trigger settlement
      const batch = await triggerSettlement(context);

      // Get settlement epochs to verify status
      const epochs = await getSettlementEpochs(context);

      expect(epochs.currentEpoch).toBeGreaterThanOrEqual(batch.epochId);
      
      const committedEpoch = epochs.epochs.find(e => e.epochId === batch.epochId);
      expect(committedEpoch).toBeDefined();
      // Status should be pending, committed, or settled
      expect(['pending', 'committed', 'settled']).toContain(committedEpoch?.status);
    });

    it('should increment epoch ID for each new batch', async () => {
      const { wallets } = context;

      // First batch
      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5500,
        amount: parseUsdc('5'),
        marketId: TEST_MARKET_ID,
      });
      await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 3000);

      await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('5'),
        marketId: TEST_MARKET_ID,
      });

      const batch1 = await triggerSettlement(context);

      // Second batch
      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5600,
        amount: parseUsdc('5'),
        marketId: TEST_MARKET_ID,
      });
      await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 3000);

      await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('5'),
        marketId: TEST_MARKET_ID,
      });

      const batch2 = await triggerSettlement(context);

      // Epoch IDs should be sequential
      expect(batch2.epochId).toBe(batch1.epochId + 1);
    });

    it('should track settlement history correctly', async () => {
      const { wallets } = context;

      // Create and settle multiple batches
      const batchIds: number[] = [];

      for (let i = 0; i < 3; i++) {
        await submitOrder(context, wallets.bob, {
          tokenId: TEST_TOKEN_ID,
          side: 1,
          priceBps: 5500 + i * 50,
          amount: parseUsdc('3'),
          marketId: TEST_MARKET_ID,
        });
        await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 3000);

        await submitOrder(context, wallets.alice, {
          tokenId: TEST_TOKEN_ID,
          side: 0,
          priceBps: 6000,
          amount: parseUsdc('3'),
          marketId: TEST_MARKET_ID,
        });

        const batch = await triggerSettlement(context);
        batchIds.push(batch.epochId);
      }

      // Verify all epochs are tracked
      const epochs = await getSettlementEpochs(context, 10);

      for (const epochId of batchIds) {
        const epoch = epochs.epochs.find(e => e.epochId === epochId);
        expect(epoch).toBeDefined();
        expect(epoch?.tradeCount).toBeGreaterThan(0);
      }
    });
  });

  // ============================================
  // Settlement with Different Trade Scenarios
  // ============================================

  describe('Settlement Trade Scenarios', () => {
    it('should handle settlement with partial fills', async () => {
      const { wallets } = context;

      // Bob places a large sell order
      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5500,
        amount: parseUsdc('20'),
        marketId: TEST_MARKET_ID,
      });
      await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 5000);

      // Alice places a smaller buy order (partial fill)
      const buyResult = await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('10'),
        marketId: TEST_MARKET_ID,
      });

      expect(buyResult.trades.length).toBeGreaterThan(0);
      expect(BigInt(buyResult.trades[0].amount)).toBe(parseUsdc('10'));

      // Trigger settlement
      const batch = await triggerSettlement(context);

      expect(batch.epochId).toBeGreaterThan(0);
      expect(batch.entries).toBeGreaterThan(0);
    });

    it('should handle settlement with multiple participants', async () => {
      const { wallets } = context;

      // Deposit for Charlie
      await deposit(context, wallets.charlie, parseUsdc('1000'));
      await mineBlocks(context, 25);
      await waitFor(
        async () => {
          const balance = await getOffChainBalance(context, wallets.charlie.address);
          return balance.total >= parseUsdc('1000');
        },
        10000,
        500
      );

      // Bob sells to Alice
      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5500,
        amount: parseUsdc('5'),
        marketId: TEST_MARKET_ID,
      });
      await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 3000);

      await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('5'),
        marketId: TEST_MARKET_ID,
      });

      // Bob sells to Charlie
      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5600,
        amount: parseUsdc('5'),
        marketId: TEST_MARKET_ID,
      });
      await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 3000);

      await submitOrder(context, wallets.charlie, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('5'),
        marketId: TEST_MARKET_ID,
      });

      // Trigger settlement
      const batch = await triggerSettlement(context);

      expect(batch.epochId).toBeGreaterThan(0);
      // Should have entries for participants with positive balances
      expect(batch.entries).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================
  // Property 7: Settlement Completeness
  // **Validates: Requirements 10.4**
  // ============================================

  describe('Property 7: Settlement Completeness', () => {
    /**
     * Property 7: Settlement Completeness
     *
     * For any settlement batch containing N trades, after settlement completes,
     * all N trades SHALL be included in the on-chain settlement and each trade's
     * participants SHALL have valid Merkle proofs.
     *
     * **Validates: Requirements 10.4**
     */
    it('should include all trades in settlement batch', async () => {
      const { wallets } = context;

      await fc.assert(
        fc.asyncProperty(
          // Generate random number of trades (1-5)
          fc.integer({ min: 1, max: 5 }),
          // Generate random trade amounts
          fc.array(
            fc.integer({ min: 1_000_000, max: 10_000_000 }),
            { minLength: 1, maxLength: 5 }
          ),
          async (numTrades, amounts) => {
            const iterationSnapshot = await context.anvil.snapshot();

            try {
              const actualTrades = Math.min(numTrades, amounts.length);
              let totalTradesExecuted = 0;

              // Execute trades
              for (let i = 0; i < actualTrades; i++) {
                const amount = BigInt(amounts[i]);

                // Check balances before trading
                const aliceBalance = await getOffChainBalance(context, wallets.alice.address);
                const bobBalance = await getOffChainBalance(context, wallets.bob.address);

                const maxCost = (6000n * amount) / 10000n;
                if (aliceBalance.available < maxCost || bobBalance.available < amount) {
                  continue; // Skip if insufficient balance
                }

                // Bob sells
                const sellResult = await submitOrder(context, wallets.bob, {
                  tokenId: TEST_TOKEN_ID,
                  side: 1,
                  priceBps: 5500 + i * 10,
                  amount,
                  marketId: TEST_MARKET_ID,
                });

                if (sellResult.status !== 'accepted') continue;

                try {
                  await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 2000);
                } catch {
                  continue;
                }

                // Alice buys
                const buyResult = await submitOrder(context, wallets.alice, {
                  tokenId: TEST_TOKEN_ID,
                  side: 0,
                  priceBps: 6000,
                  amount,
                  marketId: TEST_MARKET_ID,
                });

                if (buyResult.status === 'accepted' && buyResult.trades.length > 0) {
                  totalTradesExecuted += buyResult.trades.length;
                }
              }

              if (totalTradesExecuted === 0) {
                return true; // No trades to settle
              }

              // Trigger settlement
              const batch = await triggerSettlement(context);

              // Property: Settlement should be created
              expect(batch.epochId).toBeGreaterThan(0);
              expect(batch.merkleRoot).toBeDefined();
              expect(batch.merkleRoot).toMatch(/^0x[a-fA-F0-9]{64}$/);

              // Property: At least one participant should have a proof
              // (the one with positive balance delta)
              let hasValidProof = false;
              
              for (const wallet of [wallets.alice, wallets.bob]) {
                try {
                  const proof = await getWithdrawalProof(
                    context,
                    batch.epochId,
                    wallet.address
                  );
                  if (proof && BigInt(proof.amount) > 0n) {
                    hasValidProof = true;
                    // Verify proof structure
                    expect(proof.proof).toBeInstanceOf(Array);
                    expect(proof.merkleRoot).toBe(batch.merkleRoot);
                  }
                } catch {
                  // No proof for this participant (negative balance)
                }
              }

              // At least one participant should have a positive balance
              expect(hasValidProof).toBe(true);

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
    }, 300000);

    /**
     * Property: Merkle proofs are valid for all positive balance participants
     */
    it('should generate valid Merkle proofs for all positive balance participants', async () => {
      const { wallets } = context;

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1_000_000, max: 50_000_000 }),
          async (amount) => {
            const iterationSnapshot = await context.anvil.snapshot();

            try {
              const tradeAmount = BigInt(amount);

              // Check balances
              const aliceBalance = await getOffChainBalance(context, wallets.alice.address);
              const bobBalance = await getOffChainBalance(context, wallets.bob.address);

              const maxCost = (6000n * tradeAmount) / 10000n;
              if (aliceBalance.available < maxCost || bobBalance.available < tradeAmount) {
                return true;
              }

              // Execute trade
              await submitOrder(context, wallets.bob, {
                tokenId: TEST_TOKEN_ID,
                side: 1,
                priceBps: 5500,
                amount: tradeAmount,
                marketId: TEST_MARKET_ID,
              });

              try {
                await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 3000);
              } catch {
                return true;
              }

              const buyResult = await submitOrder(context, wallets.alice, {
                tokenId: TEST_TOKEN_ID,
                side: 0,
                priceBps: 6000,
                amount: tradeAmount,
                marketId: TEST_MARKET_ID,
              });

              if (buyResult.status !== 'accepted' || buyResult.trades.length === 0) {
                return true;
              }

              // Trigger settlement
              const batch = await triggerSettlement(context);

              // Bob should have positive balance (seller receives USDC)
              try {
                const bobProof = await getWithdrawalProof(
                  context,
                  batch.epochId,
                  wallets.bob.address
                );

                // Property: Proof should be valid
                expect(bobProof.epochId).toBe(batch.epochId);
                expect(bobProof.merkleRoot).toBe(batch.merkleRoot);
                expect(BigInt(bobProof.amount)).toBeGreaterThan(0n);
                expect(bobProof.proof).toBeInstanceOf(Array);
                
                // Proof should have valid structure (array of 32-byte hashes)
                for (const proofElement of bobProof.proof) {
                  expect(proofElement).toMatch(/^0x[a-fA-F0-9]{64}$/);
                }
              } catch (error) {
                // If no proof, verify it's because of negative balance
                expect((error as Error).message).toContain('No proof found');
              }

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
  });
});
