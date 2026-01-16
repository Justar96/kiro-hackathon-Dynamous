/**
 * Deposit Flow E2E Tests
 *
 * Tests the complete deposit flow from USDC approval through vault deposit
 * to off-chain balance crediting.
 *
 * Requirements: 7.1, 7.2, 7.3
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { type Hex, decodeEventLog } from 'viem';
import * as fc from 'fast-check';
import {
  setupE2ETests,
  teardownE2ETests,
  type E2ETestContext,
} from './setup';
import {
  deposit,
  approveUsdc,
  getUsdcBalance,
  getVaultBalance,
  getOffChainBalance,
  mineBlocks,
  parseUsdc,
  waitFor,
} from './helpers';

// ============================================
// Test Configuration
// ============================================

// Skip E2E tests in CI unless explicitly enabled
const SKIP_E2E = process.env.CI && !process.env.RUN_E2E_TESTS;

// Settlement vault ABI for event decoding
const settlementVaultAbi = [
  {
    type: 'event',
    name: 'Deposit',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ============================================
// Test Suite
// ============================================

describe.skipIf(SKIP_E2E)('Deposit Flow E2E Tests', () => {
  let context: E2ETestContext;
  let snapshotId: Hex;

  beforeAll(async () => {
    // Start E2E infrastructure (Anvil, deploy contracts, start backend)
    context = await setupE2ETests({ debug: !!process.env.E2E_DEBUG });
  }, 120000); // 2 minute timeout for setup

  afterAll(async () => {
    await teardownE2ETests();
  }, 30000);

  beforeEach(async () => {
    // Take snapshot before each test for isolation
    snapshotId = await context.anvil.snapshot();
  });

  afterEach(async () => {
    // Revert to snapshot after each test
    if (snapshotId) {
      await context.anvil.revert(snapshotId);
    }
  });

  // ============================================
  // Requirement 7.1: Deposit Event Verification
  // ============================================

  describe('Deposit Event Emission', () => {
    it('should emit Deposit event when depositing USDC to vault', async () => {
      const { wallets } = context;
      const depositAmount = parseUsdc('100'); // 100 USDC

      // Get initial USDC balance
      const initialUsdcBalance = await getUsdcBalance(context, wallets.alice.address);
      expect(initialUsdcBalance).toBeGreaterThan(depositAmount);

      // Approve USDC spending
      const approvalReceipt = await approveUsdc(context, wallets.alice, depositAmount);
      expect(approvalReceipt.status).toBe('success');

      // Deposit to vault
      const depositReceipt = await deposit(context, wallets.alice, depositAmount);
      expect(depositReceipt.status).toBe('success');

      // Verify Deposit event was emitted
      const depositLog = depositReceipt.logs.find((log) => {
        try {
          const decoded = decodeEventLog({
            abi: settlementVaultAbi,
            data: log.data,
            topics: log.topics,
          });
          return decoded.eventName === 'Deposit';
        } catch {
          return false;
        }
      });

      expect(depositLog).toBeDefined();

      // Decode and verify event data
      const decodedEvent = decodeEventLog({
        abi: settlementVaultAbi,
        data: depositLog!.data,
        topics: depositLog!.topics,
      });

      expect(decodedEvent.eventName).toBe('Deposit');
      expect((decodedEvent.args as { user: string }).user.toLowerCase()).toBe(
        wallets.alice.address.toLowerCase()
      );
      expect((decodedEvent.args as { amount: bigint }).amount).toBe(depositAmount);
    });

    it('should update on-chain vault balance after deposit', async () => {
      const { wallets } = context;
      const depositAmount = parseUsdc('250'); // 250 USDC

      // Get initial vault balance
      const initialVaultBalance = await getVaultBalance(context, wallets.alice.address);

      // Deposit to vault
      await deposit(context, wallets.alice, depositAmount);

      // Verify vault balance increased
      const finalVaultBalance = await getVaultBalance(context, wallets.alice.address);
      expect(finalVaultBalance).toBe(initialVaultBalance + depositAmount);
    });

    it('should decrease USDC balance after deposit', async () => {
      const { wallets } = context;
      const depositAmount = parseUsdc('500'); // 500 USDC

      // Get initial USDC balance
      const initialUsdcBalance = await getUsdcBalance(context, wallets.alice.address);

      // Deposit to vault
      await deposit(context, wallets.alice, depositAmount);

      // Verify USDC balance decreased
      const finalUsdcBalance = await getUsdcBalance(context, wallets.alice.address);
      expect(finalUsdcBalance).toBe(initialUsdcBalance - depositAmount);
    });
  });

  // ============================================
  // Requirement 7.2: Off-chain Balance Crediting
  // ============================================

  describe('Off-chain Balance Crediting', () => {
    it('should credit off-chain balance after indexer processes deposit', async () => {
      const { wallets } = context;
      const depositAmount = parseUsdc('100'); // 100 USDC

      // Get initial off-chain balance
      const initialOffChainBalance = await getOffChainBalance(context, wallets.alice.address);

      // Deposit and wait for indexer to process
      await deposit(context, wallets.alice, depositAmount);

      // Mine blocks to reach confirmation threshold
      await mineBlocks(context, 25);

      // Wait for indexer to process the deposit
      await waitFor(
        async () => {
          const balance = await getOffChainBalance(context, wallets.alice.address);
          return balance.total > initialOffChainBalance.total;
        },
        10000,
        500
      );

      // Verify off-chain balance was credited
      // Note: Due to test isolation limitations (backend state persists across Anvil reverts),
      // we check that the balance increased by at least the deposit amount
      const finalOffChainBalance = await getOffChainBalance(context, wallets.alice.address);
      const balanceIncrease = finalOffChainBalance.total - initialOffChainBalance.total;
      expect(balanceIncrease).toBeGreaterThanOrEqual(depositAmount);
    });

    it('should handle multiple deposits from same user', async () => {
      const { wallets } = context;
      const deposit1Amount = parseUsdc('100');
      const deposit2Amount = parseUsdc('200');
      const totalDeposit = deposit1Amount + deposit2Amount;

      // Get initial balance
      const initialOffChainBalance = await getOffChainBalance(context, wallets.alice.address);

      // First deposit
      await deposit(context, wallets.alice, deposit1Amount);
      await mineBlocks(context, 25);

      // Second deposit
      await deposit(context, wallets.alice, deposit2Amount);
      await mineBlocks(context, 25);

      // Wait for both deposits to be indexed
      await waitFor(
        async () => {
          const balance = await getOffChainBalance(context, wallets.alice.address);
          return balance.total >= initialOffChainBalance.total + totalDeposit;
        },
        15000,
        500
      );

      // Verify total balance
      const finalOffChainBalance = await getOffChainBalance(context, wallets.alice.address);
      expect(finalOffChainBalance.total).toBe(initialOffChainBalance.total + totalDeposit);
    });

    it('should handle deposits from multiple users', async () => {
      const { wallets } = context;
      const aliceDeposit = parseUsdc('150');
      const bobDeposit = parseUsdc('250');

      // Get initial balances
      const initialAliceBalance = await getOffChainBalance(context, wallets.alice.address);
      const initialBobBalance = await getOffChainBalance(context, wallets.bob.address);

      // Both users deposit
      await deposit(context, wallets.alice, aliceDeposit);
      await deposit(context, wallets.bob, bobDeposit);
      await mineBlocks(context, 25);

      // Wait for both deposits to be indexed
      await waitFor(
        async () => {
          const aliceBalance = await getOffChainBalance(context, wallets.alice.address);
          const bobBalance = await getOffChainBalance(context, wallets.bob.address);
          return (
            aliceBalance.total >= initialAliceBalance.total + aliceDeposit &&
            bobBalance.total >= initialBobBalance.total + bobDeposit
          );
        },
        15000,
        500
      );

      // Verify both balances
      const finalAliceBalance = await getOffChainBalance(context, wallets.alice.address);
      const finalBobBalance = await getOffChainBalance(context, wallets.bob.address);

      expect(finalAliceBalance.total).toBe(initialAliceBalance.total + aliceDeposit);
      expect(finalBobBalance.total).toBe(initialBobBalance.total + bobDeposit);
    });
  });

  // ============================================
  // Edge Cases and Error Handling
  // ============================================

  describe('Edge Cases', () => {
    it('should reject deposit without approval', async () => {
      const { wallets, contracts } = context;
      const depositAmount = parseUsdc('100');

      const { encodeFunctionData } = await import('viem');
      
      const vaultAbi = [
        {
          type: 'function',
          name: 'deposit',
          inputs: [{ name: 'amount', type: 'uint256' }],
          outputs: [],
          stateMutability: 'nonpayable',
        },
      ] as const;

      const data = encodeFunctionData({
        abi: vaultAbi,
        functionName: 'deposit',
        args: [depositAmount],
      });

      // This should revert due to insufficient allowance
      await expect(
        wallets.charlie.sendTransaction({
          to: contracts.settlementVault,
          data,
        })
      ).rejects.toThrow();
    });

    it('should handle minimum deposit amount (1 USDC)', async () => {
      const { wallets } = context;
      const minDeposit = parseUsdc('1');

      const initialBalance = await getOffChainBalance(context, wallets.alice.address);

      await deposit(context, wallets.alice, minDeposit);
      await mineBlocks(context, 25);

      await waitFor(
        async () => {
          const balance = await getOffChainBalance(context, wallets.alice.address);
          return balance.total > initialBalance.total;
        },
        10000,
        500
      );

      const finalBalance = await getOffChainBalance(context, wallets.alice.address);
      expect(finalBalance.total).toBe(initialBalance.total + minDeposit);
    });

    it('should handle large deposit amount', async () => {
      const { wallets } = context;
      const largeDeposit = parseUsdc('5000');

      const usdcBalance = await getUsdcBalance(context, wallets.alice.address);
      expect(usdcBalance).toBeGreaterThanOrEqual(largeDeposit);

      const initialBalance = await getOffChainBalance(context, wallets.alice.address);

      await deposit(context, wallets.alice, largeDeposit);
      await mineBlocks(context, 25);

      await waitFor(
        async () => {
          const balance = await getOffChainBalance(context, wallets.alice.address);
          return balance.total >= initialBalance.total + largeDeposit;
        },
        10000,
        500
      );

      const finalBalance = await getOffChainBalance(context, wallets.alice.address);
      expect(finalBalance.total).toBe(initialBalance.total + largeDeposit);
    });
  });

  // ============================================
  // Property 4: Deposit Amount Conservation
  // **Validates: Requirements 4.2, 7.3**
  // ============================================

  describe('Property 4: Deposit Amount Conservation', () => {
    /**
     * Property 4: Deposit Amount Conservation
     *
     * For any deposit amount between 1 USDC and 10,000 USDC, when a user deposits
     * to the SettlementVault and the Indexer processes the deposit event, the
     * credited off-chain balance SHALL equal the deposited amount exactly.
     */
    it('should conserve deposit amount: off-chain balance equals deposited amount', async () => {
      const { wallets } = context;

      await fc.assert(
        fc.asyncProperty(
          // Generate random deposit amounts between 1 USDC and 10,000 USDC
          // USDC has 6 decimals
          fc.integer({ min: 1_000_000, max: 10_000_000_000 }).map((microUsdc) => BigInt(microUsdc)),
          async (depositAmount) => {
            // Take a fresh snapshot for this iteration
            const iterationSnapshot = await context.anvil.snapshot();

            try {
              // Get initial off-chain balance
              const initialBalance = await getOffChainBalance(context, wallets.alice.address);

              // Verify user has enough USDC
              const usdcBalance = await getUsdcBalance(context, wallets.alice.address);
              if (usdcBalance < depositAmount) {
                return true; // Skip if insufficient balance
              }

              // Perform deposit
              const receipt = await deposit(context, wallets.alice, depositAmount);
              expect(receipt.status).toBe('success');

              // Mine blocks for confirmation
              await mineBlocks(context, 25);

              // Wait for indexer to process
              let finalBalance = initialBalance;
              try {
                await waitFor(
                  async () => {
                    finalBalance = await getOffChainBalance(context, wallets.alice.address);
                    return finalBalance.total > initialBalance.total;
                  },
                  15000,
                  500
                );
              } catch {
                finalBalance = await getOffChainBalance(context, wallets.alice.address);
              }

              // Property: The balance increase should exactly equal the deposit amount
              const balanceIncrease = finalBalance.total - initialBalance.total;
              expect(balanceIncrease).toBe(depositAmount);

              return true;
            } finally {
              // Revert state for next iteration
              await context.anvil.revert(iterationSnapshot);
            }
          }
        ),
        {
          numRuns: 10, // Reduced for E2E tests due to time constraints
          verbose: true,
          endOnFailure: true,
        }
      );
    }, 300000); // 5 minute timeout

    /**
     * Property: Total system balance conservation
     * USDC leaving user wallet === USDC entering vault
     */
    it('should conserve total system balance: USDC out equals vault in', async () => {
      const { wallets } = context;

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1_000_000, max: 5_000_000_000 }).map((microUsdc) => BigInt(microUsdc)),
          async (depositAmount) => {
            const iterationSnapshot = await context.anvil.snapshot();

            try {
              // Get initial balances
              const initialUserUsdc = await getUsdcBalance(context, wallets.bob.address);
              const initialVaultBalance = await getVaultBalance(context, wallets.bob.address);

              if (initialUserUsdc < depositAmount) {
                return true; // Skip if insufficient balance
              }

              // Perform deposit
              await deposit(context, wallets.bob, depositAmount);

              // Get final balances
              const finalUserUsdc = await getUsdcBalance(context, wallets.bob.address);
              const finalVaultBalance = await getVaultBalance(context, wallets.bob.address);

              // Conservation property: USDC decrease === vault increase
              const usdcDecrease = initialUserUsdc - finalUserUsdc;
              const vaultIncrease = finalVaultBalance - initialVaultBalance;

              expect(usdcDecrease).toBe(depositAmount);
              expect(vaultIncrease).toBe(depositAmount);
              expect(usdcDecrease).toBe(vaultIncrease);

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
  });
});
