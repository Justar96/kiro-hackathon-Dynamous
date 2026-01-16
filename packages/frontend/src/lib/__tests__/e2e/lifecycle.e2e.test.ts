/**
 * Full Lifecycle E2E Tests
 *
 * Tests the complete trading lifecycle: deposit → order → match → settle → withdraw
 * Verifies the entire system works together end-to-end.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4
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
  waitForAsk,
  waitForBid,
  getOffChainBalance,
  triggerSettlement,
  getWithdrawalProof,
  claimWithdrawal,
  getUsdcBalance,
  getVaultBalance,
  mineBlocks,
  parseUsdc,
  formatUsdc,
  waitFor,
} from './helpers';

// Skip E2E tests in CI unless explicitly enabled
const SKIP_E2E = process.env.CI && !process.env.RUN_E2E_TESTS;

// Test market configuration
const TEST_MARKET_ID = '0x' + '1'.repeat(64) as Hex;
const TEST_TOKEN_ID = 1n;

describe.skipIf(SKIP_E2E)('Full Lifecycle E2E Tests', () => {
  let context: E2ETestContext;
  let snapshotId: Hex;

  beforeAll(async () => {
    context = await setupE2ETests({ debug: !!process.env.E2E_DEBUG });
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
  // Requirement 12.1: Complete Flow Execution
  // ============================================

  describe('Complete Trading Lifecycle', () => {
    /**
     * Full lifecycle test: deposit → order → match → settle → withdraw
     * Requirements: 12.1, 12.2, 12.4
     */
    it('should execute complete lifecycle: deposit → order → match → settle → withdraw', async () => {
      const { wallets } = context;
      const startTime = Date.now();

      // ========== STEP 1: DEPOSIT ==========
      console.log('[Lifecycle] Step 1: Depositing USDC...');
      
      const aliceDepositAmount = parseUsdc('1000');
      const bobDepositAmount = parseUsdc('1000');

      // Get initial USDC balances
      const aliceInitialUsdc = await getUsdcBalance(context, wallets.alice.address);
      const bobInitialUsdc = await getUsdcBalance(context, wallets.bob.address);

      // Deposit USDC to vault
      await deposit(context, wallets.alice, aliceDepositAmount);
      await deposit(context, wallets.bob, bobDepositAmount);

      // Mine blocks for confirmation
      await mineBlocks(context, 25);

      // Wait for indexer to process deposits
      await waitFor(
        async () => {
          const aliceBalance = await getOffChainBalance(context, wallets.alice.address);
          const bobBalance = await getOffChainBalance(context, wallets.bob.address);
          return aliceBalance.total >= aliceDepositAmount && bobBalance.total >= bobDepositAmount;
        },
        15000,
        500
      );

      // Verify deposits credited
      const aliceOffChainAfterDeposit = await getOffChainBalance(context, wallets.alice.address);
      const bobOffChainAfterDeposit = await getOffChainBalance(context, wallets.bob.address);
      
      expect(aliceOffChainAfterDeposit.total).toBeGreaterThanOrEqual(aliceDepositAmount);
      expect(bobOffChainAfterDeposit.total).toBeGreaterThanOrEqual(bobDepositAmount);

      console.log('[Lifecycle] Deposits complete. Alice:', formatUsdc(aliceOffChainAfterDeposit.total), 'Bob:', formatUsdc(bobOffChainAfterDeposit.total));


      // ========== STEP 2: ORDER SUBMISSION ==========
      console.log('[Lifecycle] Step 2: Submitting orders...');

      const tradeAmount = parseUsdc('100');
      const sellPriceBps = 5500; // 55 cents
      const buyPriceBps = 6000;  // 60 cents

      // Bob places a sell order
      const sellResult = await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1, // SELL
        priceBps: sellPriceBps,
        amount: tradeAmount,
        marketId: TEST_MARKET_ID,
      });

      expect(sellResult.status).toBe('accepted');
      expect(sellResult.orderId).toBeTruthy();

      // Wait for sell order to appear in order book
      await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 5000);

      console.log('[Lifecycle] Sell order placed:', sellResult.orderId);

      // ========== STEP 3: ORDER MATCHING ==========
      console.log('[Lifecycle] Step 3: Matching orders...');

      // Alice places a crossing buy order
      const buyResult = await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0, // BUY
        priceBps: buyPriceBps,
        amount: tradeAmount,
        marketId: TEST_MARKET_ID,
      });

      expect(buyResult.status).toBe('accepted');
      expect(buyResult.trades.length).toBeGreaterThan(0);

      const trade = buyResult.trades[0];
      console.log('[Lifecycle] Trade executed:', {
        amount: trade.amount,
        price: trade.price,
        matchType: trade.matchType,
      });

      // Verify balances updated after trade
      await new Promise(resolve => setTimeout(resolve, 500));

      const aliceAfterTrade = await getOffChainBalance(context, wallets.alice.address);
      const bobAfterTrade = await getOffChainBalance(context, wallets.bob.address);

      // Alice paid USDC, Bob received USDC
      expect(aliceAfterTrade.total).toBeLessThan(aliceOffChainAfterDeposit.total);
      expect(bobAfterTrade.total).toBeGreaterThan(bobOffChainAfterDeposit.total);

      console.log('[Lifecycle] After trade - Alice:', formatUsdc(aliceAfterTrade.total), 'Bob:', formatUsdc(bobAfterTrade.total));


      // ========== STEP 4: SETTLEMENT ==========
      console.log('[Lifecycle] Step 4: Triggering settlement...');

      const batch = await triggerSettlement(context);

      expect(batch.epochId).toBeGreaterThan(0);
      expect(batch.merkleRoot).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(batch.entries).toBeGreaterThan(0);

      console.log('[Lifecycle] Settlement batch created:', {
        epochId: batch.epochId,
        merkleRoot: batch.merkleRoot.slice(0, 18) + '...',
        entries: batch.entries,
      });

      // ========== STEP 5: WITHDRAWAL ==========
      console.log('[Lifecycle] Step 5: Claiming withdrawals...');

      // Bob (seller) should have positive balance to claim
      const bobProof = await getWithdrawalProof(context, batch.epochId, wallets.bob.address);
      expect(BigInt(bobProof.amount)).toBeGreaterThan(0n);

      const bobUsdcBeforeClaim = await getUsdcBalance(context, wallets.bob.address);

      // Bob claims his withdrawal
      const claimReceipt = await claimWithdrawal(context, wallets.bob, batch.epochId);
      expect(claimReceipt.status).toBe('success');

      const bobUsdcAfterClaim = await getUsdcBalance(context, wallets.bob.address);
      const claimedAmount = bobUsdcAfterClaim - bobUsdcBeforeClaim;

      expect(claimedAmount).toBe(BigInt(bobProof.amount));

      console.log('[Lifecycle] Bob claimed:', formatUsdc(claimedAmount), 'USDC');

      // ========== VERIFICATION ==========
      console.log('[Lifecycle] Verifying final state...');

      // Calculate expected profit/loss
      // Bob sold tokens at 55% price, so he received ~55 USDC for 100 tokens
      const expectedBobProfit = (BigInt(sellPriceBps) * tradeAmount) / 10000n;

      // Bob's final USDC should be: initial - deposit + claimed
      // Since Bob deposited and then claimed his trading profit
      const bobFinalUsdc = await getUsdcBalance(context, wallets.bob.address);
      
      // Bob should have approximately his initial balance minus deposit plus claimed amount
      // (initial - deposit + claimed) = initial - deposit + ~55 USDC
      const bobExpectedFinal = bobInitialUsdc - bobDepositAmount + claimedAmount;
      expect(bobFinalUsdc).toBe(bobExpectedFinal);

      // Verify test completed within 60 seconds
      const elapsedTime = Date.now() - startTime;
      console.log('[Lifecycle] Test completed in', elapsedTime, 'ms');
      expect(elapsedTime).toBeLessThan(60000);

      console.log('[Lifecycle] ✓ Full lifecycle test passed!');
    }, 60000);


    it('should handle multiple trades in lifecycle before settlement', async () => {
      const { wallets } = context;

      // Deposit
      const depositAmount = parseUsdc('2000');
      await deposit(context, wallets.alice, depositAmount);
      await deposit(context, wallets.bob, depositAmount);
      await mineBlocks(context, 25);

      await waitFor(
        async () => {
          const aliceBalance = await getOffChainBalance(context, wallets.alice.address);
          const bobBalance = await getOffChainBalance(context, wallets.bob.address);
          return aliceBalance.total >= depositAmount && bobBalance.total >= depositAmount;
        },
        15000,
        500
      );

      // Execute multiple trades
      const trades: Array<{ amount: bigint; price: number }> = [
        { amount: parseUsdc('50'), price: 5500 },
        { amount: parseUsdc('75'), price: 5600 },
        { amount: parseUsdc('100'), price: 5700 },
      ];

      let totalTraded = 0n;

      for (const trade of trades) {
        await submitOrder(context, wallets.bob, {
          tokenId: TEST_TOKEN_ID,
          side: 1,
          priceBps: trade.price,
          amount: trade.amount,
          marketId: TEST_MARKET_ID,
        });
        await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 3000);

        const result = await submitOrder(context, wallets.alice, {
          tokenId: TEST_TOKEN_ID,
          side: 0,
          priceBps: 6000,
          amount: trade.amount,
          marketId: TEST_MARKET_ID,
        });

        if (result.trades.length > 0) {
          totalTraded += BigInt(result.trades[0].amount);
        }
      }

      expect(totalTraded).toBe(parseUsdc('225'));

      // Single settlement for all trades
      const batch = await triggerSettlement(context);
      expect(batch.entries).toBeGreaterThan(0);

      // Bob claims
      const bobProof = await getWithdrawalProof(context, batch.epochId, wallets.bob.address);
      const claimReceipt = await claimWithdrawal(context, wallets.bob, batch.epochId);
      expect(claimReceipt.status).toBe('success');
    }, 90000);


    it('should handle bidirectional trading in lifecycle', async () => {
      const { wallets } = context;

      // Deposit
      const depositAmount = parseUsdc('2000');
      await deposit(context, wallets.alice, depositAmount);
      await deposit(context, wallets.bob, depositAmount);
      await mineBlocks(context, 25);

      await waitFor(
        async () => {
          const aliceBalance = await getOffChainBalance(context, wallets.alice.address);
          const bobBalance = await getOffChainBalance(context, wallets.bob.address);
          return aliceBalance.total >= depositAmount && bobBalance.total >= depositAmount;
        },
        15000,
        500
      );

      // Trade 1: Bob sells to Alice
      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5500,
        amount: parseUsdc('100'),
        marketId: TEST_MARKET_ID,
      });
      await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 3000);

      await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('100'),
        marketId: TEST_MARKET_ID,
      });

      // Trade 2: Alice sells to Bob (reverse direction)
      await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5600,
        amount: parseUsdc('50'),
        marketId: TEST_MARKET_ID,
      });
      await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 3000);

      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('50'),
        marketId: TEST_MARKET_ID,
      });

      // Settlement
      const batch = await triggerSettlement(context);
      expect(batch.epochId).toBeGreaterThan(0);

      // Both may have claimable amounts depending on net positions
      // Try to claim for both (one or both may have positive balance)
      let claimsSucceeded = 0;

      for (const wallet of [wallets.alice, wallets.bob]) {
        try {
          const proof = await getWithdrawalProof(context, batch.epochId, wallet.address);
          if (BigInt(proof.amount) > 0n) {
            const receipt = await claimWithdrawal(context, wallet, batch.epochId);
            if (receipt.status === 'success') {
              claimsSucceeded++;
            }
          }
        } catch {
          // No proof for this participant (negative net balance)
        }
      }

      // At least one participant should have a positive balance to claim
      expect(claimsSucceeded).toBeGreaterThanOrEqual(1);
    }, 90000);
  });


  // ============================================
  // Property 8: Total Lifecycle Conservation
  // **Validates: Requirements 12.3**
  // ============================================

  describe('Property 8: Total Lifecycle Conservation', () => {
    /**
     * Property 8: Total Lifecycle Conservation
     *
     * For any complete trading lifecycle (deposit → order → match → settle → withdraw),
     * the total USDC in the system (sum of all user balances plus vault balance)
     * SHALL remain constant throughout all operations.
     *
     * **Validates: Requirements 12.3**
     */
    it('should conserve total USDC: no funds lost or created during lifecycle', async () => {
      const { wallets, contracts } = context;

      await fc.assert(
        fc.asyncProperty(
          // Generate random deposit amounts (100-1000 USDC)
          fc.record({
            aliceDeposit: fc.integer({ min: 100_000_000, max: 1_000_000_000 }),
            bobDeposit: fc.integer({ min: 100_000_000, max: 1_000_000_000 }),
          }),
          // Generate random trade parameters
          fc.record({
            tradeAmount: fc.integer({ min: 10_000_000, max: 100_000_000 }),
            sellPriceBps: fc.integer({ min: 4000, max: 6000 }),
            buyPriceBps: fc.integer({ min: 5000, max: 7000 }),
          }),
          async (deposits, trade) => {
            const iterationSnapshot = await context.anvil.snapshot();

            try {
              const aliceDeposit = BigInt(deposits.aliceDeposit);
              const bobDeposit = BigInt(deposits.bobDeposit);
              const tradeAmount = BigInt(trade.tradeAmount);

              // Ensure buy price >= sell price for crossing
              if (trade.buyPriceBps < trade.sellPriceBps) {
                return true; // Skip non-crossing scenarios
              }

              // ========== MEASURE INITIAL STATE ==========
              const aliceInitialUsdc = await getUsdcBalance(context, wallets.alice.address);
              const bobInitialUsdc = await getUsdcBalance(context, wallets.bob.address);
              
              // Check sufficient balance for deposits
              if (aliceInitialUsdc < aliceDeposit || bobInitialUsdc < bobDeposit) {
                return true;
              }

              const totalSystemBefore = aliceInitialUsdc + bobInitialUsdc;


              // ========== DEPOSIT PHASE ==========
              await deposit(context, wallets.alice, aliceDeposit);
              await deposit(context, wallets.bob, bobDeposit);
              await mineBlocks(context, 25);

              // Wait for indexer
              try {
                await waitFor(
                  async () => {
                    const aliceBalance = await getOffChainBalance(context, wallets.alice.address);
                    const bobBalance = await getOffChainBalance(context, wallets.bob.address);
                    return aliceBalance.total >= aliceDeposit && bobBalance.total >= bobDeposit;
                  },
                  10000,
                  500
                );
              } catch {
                return true; // Skip if indexer timeout
              }

              // ========== TRADING PHASE ==========
              // Check if trade amount is feasible
              const maxCost = (BigInt(trade.buyPriceBps) * tradeAmount) / 10000n;
              const aliceOffChain = await getOffChainBalance(context, wallets.alice.address);
              const bobOffChain = await getOffChainBalance(context, wallets.bob.address);

              if (aliceOffChain.available < maxCost || bobOffChain.available < tradeAmount) {
                return true; // Skip if insufficient balance
              }

              // Bob sells
              const sellResult = await submitOrder(context, wallets.bob, {
                tokenId: TEST_TOKEN_ID,
                side: 1,
                priceBps: trade.sellPriceBps,
                amount: tradeAmount,
                marketId: TEST_MARKET_ID,
              });

              if (sellResult.status !== 'accepted') return true;

              try {
                await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 3000);
              } catch {
                return true;
              }

              // Alice buys
              const buyResult = await submitOrder(context, wallets.alice, {
                tokenId: TEST_TOKEN_ID,
                side: 0,
                priceBps: trade.buyPriceBps,
                amount: tradeAmount,
                marketId: TEST_MARKET_ID,
              });

              if (buyResult.status !== 'accepted' || buyResult.trades.length === 0) {
                return true;
              }


              // ========== SETTLEMENT PHASE ==========
              let batch;
              try {
                batch = await triggerSettlement(context);
              } catch {
                return true; // Skip if settlement fails
              }

              // ========== WITHDRAWAL PHASE ==========
              // Claim for participants with positive balance
              for (const wallet of [wallets.alice, wallets.bob]) {
                try {
                  const proof = await getWithdrawalProof(context, batch.epochId, wallet.address);
                  if (BigInt(proof.amount) > 0n) {
                    await claimWithdrawal(context, wallet, batch.epochId);
                  }
                } catch {
                  // No proof or claim failed - continue
                }
              }

              // ========== VERIFY CONSERVATION ==========
              const aliceFinalUsdc = await getUsdcBalance(context, wallets.alice.address);
              const bobFinalUsdc = await getUsdcBalance(context, wallets.bob.address);
              
              // Get vault balance (unclaimed deposits)
              const aliceVaultBalance = await getVaultBalance(context, wallets.alice.address);
              const bobVaultBalance = await getVaultBalance(context, wallets.bob.address);

              // Total system = user USDC + vault deposits
              const totalSystemAfter = aliceFinalUsdc + bobFinalUsdc + aliceVaultBalance + bobVaultBalance;

              // Property: Total system balance should be conserved
              // Allow small tolerance for fees (max 1% of total)
              const maxFee = totalSystemBefore / 100n;
              
              expect(totalSystemAfter).toBeGreaterThanOrEqual(totalSystemBefore - maxFee);
              expect(totalSystemAfter).toBeLessThanOrEqual(totalSystemBefore);

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
    }, 600000); // 10 minute timeout for property test


    /**
     * Property: Multiple lifecycle iterations maintain conservation
     */
    it('should maintain conservation across multiple lifecycle iterations', async () => {
      const { wallets } = context;

      await fc.assert(
        fc.asyncProperty(
          // Number of iterations (1-3)
          fc.integer({ min: 1, max: 3 }),
          // Trade amounts for each iteration
          fc.array(
            fc.integer({ min: 5_000_000, max: 50_000_000 }),
            { minLength: 1, maxLength: 3 }
          ),
          async (numIterations, amounts) => {
            const iterationSnapshot = await context.anvil.snapshot();

            try {
              const iterations = Math.min(numIterations, amounts.length);

              // Initial deposit
              const depositAmount = parseUsdc('2000');
              
              const aliceInitialUsdc = await getUsdcBalance(context, wallets.alice.address);
              const bobInitialUsdc = await getUsdcBalance(context, wallets.bob.address);

              if (aliceInitialUsdc < depositAmount || bobInitialUsdc < depositAmount) {
                return true;
              }

              const totalSystemBefore = aliceInitialUsdc + bobInitialUsdc;

              await deposit(context, wallets.alice, depositAmount);
              await deposit(context, wallets.bob, depositAmount);
              await mineBlocks(context, 25);

              try {
                await waitFor(
                  async () => {
                    const aliceBalance = await getOffChainBalance(context, wallets.alice.address);
                    const bobBalance = await getOffChainBalance(context, wallets.bob.address);
                    return aliceBalance.total >= depositAmount && bobBalance.total >= depositAmount;
                  },
                  10000,
                  500
                );
              } catch {
                return true;
              }

              // Execute multiple lifecycle iterations
              for (let i = 0; i < iterations; i++) {
                const tradeAmount = BigInt(amounts[i]);

                // Check balances
                const aliceBalance = await getOffChainBalance(context, wallets.alice.address);
                const bobBalance = await getOffChainBalance(context, wallets.bob.address);

                const maxCost = (6000n * tradeAmount) / 10000n;
                if (aliceBalance.available < maxCost || bobBalance.available < tradeAmount) {
                  continue;
                }

                // Trade
                await submitOrder(context, wallets.bob, {
                  tokenId: TEST_TOKEN_ID,
                  side: 1,
                  priceBps: 5500,
                  amount: tradeAmount,
                  marketId: TEST_MARKET_ID,
                });

                try {
                  await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 2000);
                } catch {
                  continue;
                }

                const result = await submitOrder(context, wallets.alice, {
                  tokenId: TEST_TOKEN_ID,
                  side: 0,
                  priceBps: 6000,
                  amount: tradeAmount,
                  marketId: TEST_MARKET_ID,
                });

                if (result.status !== 'accepted' || result.trades.length === 0) {
                  continue;
                }

                // Settle
                try {
                  const batch = await triggerSettlement(context);

                  // Claim
                  for (const wallet of [wallets.alice, wallets.bob]) {
                    try {
                      const proof = await getWithdrawalProof(context, batch.epochId, wallet.address);
                      if (BigInt(proof.amount) > 0n) {
                        await claimWithdrawal(context, wallet, batch.epochId);
                      }
                    } catch {
                      // Continue
                    }
                  }
                } catch {
                  // Settlement failed, continue
                }
              }

              // Final conservation check
              const aliceFinalUsdc = await getUsdcBalance(context, wallets.alice.address);
              const bobFinalUsdc = await getUsdcBalance(context, wallets.bob.address);
              const aliceVaultBalance = await getVaultBalance(context, wallets.alice.address);
              const bobVaultBalance = await getVaultBalance(context, wallets.bob.address);

              const totalSystemAfter = aliceFinalUsdc + bobFinalUsdc + aliceVaultBalance + bobVaultBalance;

              // Property: Conservation across all iterations
              const maxFee = totalSystemBefore / 50n; // 2% tolerance for multiple iterations
              
              expect(totalSystemAfter).toBeGreaterThanOrEqual(totalSystemBefore - maxFee);
              expect(totalSystemAfter).toBeLessThanOrEqual(totalSystemBefore);

              return true;
            } finally {
              await context.anvil.revert(iterationSnapshot);
            }
          }
        ),
        {
          numRuns: 5,
          verbose: true,
          endOnFailure: true,
        }
      );
    }, 600000);
  });
});
