/**
 * Withdrawal Flow E2E Tests
 *
 * Tests the complete withdrawal flow including Merkle proof generation,
 * claim transaction execution, balance verification, and double-claim rejection.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { type Hex, decodeEventLog, encodeFunctionData } from 'viem';
import {
  setupE2ETests,
  teardownE2ETests,
  type E2ETestContext,
} from './setup';
import {
  deposit,
  submitOrder,
  waitForAsk,
  getOffChainBalance,
  triggerSettlement,
  getWithdrawalProof,
  claimWithdrawal,
  getUsdcBalance,
  mineBlocks,
  parseUsdc,
  waitFor,
} from './helpers';

// Skip E2E tests in CI unless explicitly enabled
const SKIP_E2E = process.env.CI && !process.env.RUN_E2E_TESTS;

// Test market configuration
const TEST_MARKET_ID = '0x' + '1'.repeat(64) as Hex;
const TEST_TOKEN_ID = 1n;

// Settlement vault ABI for event decoding and direct calls
const settlementVaultAbi = [
  {
    type: 'event',
    name: 'Claimed',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'epochId', type: 'uint256', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'claim',
    inputs: [
      { name: 'epochId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'proof', type: 'bytes32[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'hasClaimed',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'epochId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const;

describe.skipIf(SKIP_E2E)('Withdrawal Flow E2E Tests', () => {
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

  /**
   * Helper to create a trade and trigger settlement
   * Returns the settlement batch and the seller's proof
   */
  async function createTradeAndSettle(tradeAmount: bigint): Promise<{
    batch: { epochId: number; merkleRoot: string };
    sellerProof: { amount: string; proof: string[] };
  }> {
    const { wallets } = context;

    // Bob sells to Alice - Bob will have positive balance (receives USDC)
    await submitOrder(context, wallets.bob, {
      tokenId: TEST_TOKEN_ID,
      side: 1, // SELL
      priceBps: 5500,
      amount: tradeAmount,
      marketId: TEST_MARKET_ID,
    });
    await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 5000);

    await submitOrder(context, wallets.alice, {
      tokenId: TEST_TOKEN_ID,
      side: 0, // BUY
      priceBps: 6000,
      amount: tradeAmount,
      marketId: TEST_MARKET_ID,
    });

    // Trigger settlement
    const batch = await triggerSettlement(context);

    // Get Bob's proof (seller has positive balance)
    const sellerProof = await getWithdrawalProof(context, batch.epochId, wallets.bob.address);

    return {
      batch: { epochId: batch.epochId, merkleRoot: batch.merkleRoot },
      sellerProof: { amount: sellerProof.amount, proof: sellerProof.proof },
    };
  }

  // ============================================
  // Requirement 11.1: Merkle Proof Generation
  // ============================================

  describe('Merkle Proof Generation', () => {
    it('should generate valid Merkle proof for user with positive balance', async () => {
      const { wallets } = context;
      const tradeAmount = parseUsdc('100');

      const { batch, sellerProof } = await createTradeAndSettle(tradeAmount);

      // Verify proof structure
      expect(sellerProof.proof).toBeInstanceOf(Array);
      expect(BigInt(sellerProof.amount)).toBeGreaterThan(0n);

      // Each proof element should be a valid 32-byte hex string
      for (const proofElement of sellerProof.proof) {
        expect(proofElement).toMatch(/^0x[a-fA-F0-9]{64}$/);
      }
    });

    it('should return error when requesting proof for user with no balance', async () => {
      const { wallets } = context;
      const tradeAmount = parseUsdc('100');

      const { batch } = await createTradeAndSettle(tradeAmount);

      // Charlie didn't participate in the trade
      await expect(
        getWithdrawalProof(context, batch.epochId, wallets.charlie.address)
      ).rejects.toThrow();
    });

    it('should return error when requesting proof for non-existent epoch', async () => {
      const { wallets } = context;

      // Request proof for epoch that doesn't exist
      await expect(
        getWithdrawalProof(context, 999999, wallets.alice.address)
      ).rejects.toThrow();
    });

    it('should generate different proofs for different users in same epoch', async () => {
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

      // Create two trades: Bob sells to Alice, Charlie sells to Alice
      await submitOrder(context, wallets.bob, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5500,
        amount: parseUsdc('50'),
        marketId: TEST_MARKET_ID,
      });
      await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 3000);

      await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('50'),
        marketId: TEST_MARKET_ID,
      });

      await submitOrder(context, wallets.charlie, {
        tokenId: TEST_TOKEN_ID,
        side: 1,
        priceBps: 5600,
        amount: parseUsdc('30'),
        marketId: TEST_MARKET_ID,
      });
      await waitForAsk(context, TEST_MARKET_ID, TEST_TOKEN_ID, 3000);

      await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0,
        priceBps: 6000,
        amount: parseUsdc('30'),
        marketId: TEST_MARKET_ID,
      });

      // Trigger settlement
      const batch = await triggerSettlement(context);

      // Get proofs for both sellers
      const bobProof = await getWithdrawalProof(context, batch.epochId, wallets.bob.address);
      const charlieProof = await getWithdrawalProof(context, batch.epochId, wallets.charlie.address);

      // Proofs should be different (different amounts and/or proof paths)
      expect(bobProof.amount).not.toBe(charlieProof.amount);
      // Both should have valid proofs
      expect(bobProof.proof.length).toBeGreaterThan(0);
      expect(charlieProof.proof.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // Requirement 11.2: Claim Transaction Success
  // ============================================

  describe('Claim Transaction Success', () => {
    it('should successfully claim withdrawal with valid proof', async () => {
      const { wallets } = context;
      const tradeAmount = parseUsdc('100');

      const { batch } = await createTradeAndSettle(tradeAmount);

      // Bob claims his withdrawal
      const receipt = await claimWithdrawal(context, wallets.bob, batch.epochId);

      expect(receipt.status).toBe('success');

      // Verify Claimed event was emitted
      const claimedLog = receipt.logs.find((log) => {
        try {
          const decoded = decodeEventLog({
            abi: settlementVaultAbi,
            data: log.data,
            topics: log.topics,
          });
          return decoded.eventName === 'Claimed';
        } catch {
          return false;
        }
      });

      expect(claimedLog).toBeDefined();

      // Decode and verify event data
      const decodedEvent = decodeEventLog({
        abi: settlementVaultAbi,
        data: claimedLog!.data,
        topics: claimedLog!.topics,
      });

      expect(decodedEvent.eventName).toBe('Claimed');
      expect((decodedEvent.args as { user: string }).user.toLowerCase()).toBe(
        wallets.bob.address.toLowerCase()
      );
      expect((decodedEvent.args as { epochId: bigint }).epochId).toBe(BigInt(batch.epochId));
    });

    it('should mark claim as processed after successful claim', async () => {
      const { wallets, contracts } = context;
      const tradeAmount = parseUsdc('100');

      const { batch } = await createTradeAndSettle(tradeAmount);

      // Check hasClaimed before
      const hasClaimedBeforeData = encodeFunctionData({
        abi: settlementVaultAbi,
        functionName: 'hasClaimed',
        args: [wallets.bob.address, BigInt(batch.epochId)],
      });

      const resultBefore = await wallets.deployer.publicClient.call({
        to: contracts.settlementVault,
        data: hasClaimedBeforeData,
      });
      expect(resultBefore.data).toBe('0x0000000000000000000000000000000000000000000000000000000000000000'); // false

      // Claim
      await claimWithdrawal(context, wallets.bob, batch.epochId);

      // Check hasClaimed after
      const resultAfter = await wallets.deployer.publicClient.call({
        to: contracts.settlementVault,
        data: hasClaimedBeforeData,
      });
      expect(resultAfter.data).toBe('0x0000000000000000000000000000000000000000000000000000000000000001'); // true
    });
  });

  // ============================================
  // Requirement 11.3: USDC Balance Verification
  // ============================================

  describe('USDC Balance Verification', () => {
    it('should increase USDC balance by claimed amount', async () => {
      const { wallets } = context;
      const tradeAmount = parseUsdc('100');

      // Get initial USDC balance
      const initialUsdcBalance = await getUsdcBalance(context, wallets.bob.address);

      const { batch, sellerProof } = await createTradeAndSettle(tradeAmount);
      const claimAmount = BigInt(sellerProof.amount);

      // Claim withdrawal
      await claimWithdrawal(context, wallets.bob, batch.epochId);

      // Verify USDC balance increased by claimed amount
      const finalUsdcBalance = await getUsdcBalance(context, wallets.bob.address);
      expect(finalUsdcBalance).toBe(initialUsdcBalance + claimAmount);
    });

    it('should handle multiple claims from different epochs', async () => {
      const { wallets } = context;

      // Get initial USDC balance
      const initialUsdcBalance = await getUsdcBalance(context, wallets.bob.address);

      // First trade and settlement
      const { batch: batch1, sellerProof: proof1 } = await createTradeAndSettle(parseUsdc('50'));
      const claim1Amount = BigInt(proof1.amount);

      // Second trade and settlement
      const { batch: batch2, sellerProof: proof2 } = await createTradeAndSettle(parseUsdc('75'));
      const claim2Amount = BigInt(proof2.amount);

      // Claim both
      await claimWithdrawal(context, wallets.bob, batch1.epochId);
      await claimWithdrawal(context, wallets.bob, batch2.epochId);

      // Verify total USDC balance increase
      const finalUsdcBalance = await getUsdcBalance(context, wallets.bob.address);
      expect(finalUsdcBalance).toBe(initialUsdcBalance + claim1Amount + claim2Amount);
    });

    it('should correctly calculate claim amount based on trade', async () => {
      const { wallets } = context;
      const tradeAmount = parseUsdc('100');

      const { sellerProof } = await createTradeAndSettle(tradeAmount);

      // Bob sold at 55% price, so he should receive approximately 55 USDC
      // (minus any fees)
      const claimAmount = BigInt(sellerProof.amount);
      const expectedApprox = (tradeAmount * 5500n) / 10000n; // 55% of trade amount

      // Allow some tolerance for fees
      expect(claimAmount).toBeGreaterThan(expectedApprox - parseUsdc('5'));
      expect(claimAmount).toBeLessThanOrEqual(expectedApprox + parseUsdc('5'));
    });
  });

  // ============================================
  // Requirement 11.4: Double-Claim Rejection
  // ============================================

  describe('Double-Claim Rejection', () => {
    it('should reject second claim attempt for same epoch', async () => {
      const { wallets } = context;
      const tradeAmount = parseUsdc('100');

      const { batch } = await createTradeAndSettle(tradeAmount);

      // First claim should succeed
      const receipt1 = await claimWithdrawal(context, wallets.bob, batch.epochId);
      expect(receipt1.status).toBe('success');

      // Second claim should fail
      await expect(
        claimWithdrawal(context, wallets.bob, batch.epochId)
      ).rejects.toThrow();
    });

    it('should allow claims from different epochs after claiming one', async () => {
      const { wallets } = context;

      // First trade and settlement
      const { batch: batch1 } = await createTradeAndSettle(parseUsdc('50'));

      // Second trade and settlement
      const { batch: batch2 } = await createTradeAndSettle(parseUsdc('75'));

      // Claim first epoch
      const receipt1 = await claimWithdrawal(context, wallets.bob, batch1.epochId);
      expect(receipt1.status).toBe('success');

      // Claim second epoch should also succeed
      const receipt2 = await claimWithdrawal(context, wallets.bob, batch2.epochId);
      expect(receipt2.status).toBe('success');
    });

    it('should reject claim with invalid proof', async () => {
      const { wallets, contracts } = context;
      const tradeAmount = parseUsdc('100');

      const { batch, sellerProof } = await createTradeAndSettle(tradeAmount);

      // Try to claim with tampered proof
      const tamperedProof = sellerProof.proof.map((p, i) => 
        i === 0 ? ('0x' + 'ff'.repeat(32)) as Hex : p as Hex
      );

      const data = encodeFunctionData({
        abi: settlementVaultAbi,
        functionName: 'claim',
        args: [BigInt(batch.epochId), BigInt(sellerProof.amount), tamperedProof],
      });

      await expect(
        wallets.bob.sendTransaction({
          to: contracts.settlementVault,
          data,
        })
      ).rejects.toThrow();
    });

    it('should reject claim with wrong amount', async () => {
      const { wallets, contracts } = context;
      const tradeAmount = parseUsdc('100');

      const { batch, sellerProof } = await createTradeAndSettle(tradeAmount);

      // Try to claim with wrong amount (double the actual amount)
      const wrongAmount = BigInt(sellerProof.amount) * 2n;

      const data = encodeFunctionData({
        abi: settlementVaultAbi,
        functionName: 'claim',
        args: [BigInt(batch.epochId), wrongAmount, sellerProof.proof as Hex[]],
      });

      await expect(
        wallets.bob.sendTransaction({
          to: contracts.settlementVault,
          data,
        })
      ).rejects.toThrow();
    });

    it('should reject claim from wrong address', async () => {
      const { wallets, contracts } = context;
      const tradeAmount = parseUsdc('100');

      const { batch, sellerProof } = await createTradeAndSettle(tradeAmount);

      // Charlie tries to claim Bob's proof
      const data = encodeFunctionData({
        abi: settlementVaultAbi,
        functionName: 'claim',
        args: [BigInt(batch.epochId), BigInt(sellerProof.amount), sellerProof.proof as Hex[]],
      });

      await expect(
        wallets.charlie.sendTransaction({
          to: contracts.settlementVault,
          data,
        })
      ).rejects.toThrow();
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should handle claim for minimum amount', async () => {
      const { wallets } = context;
      // Small trade amount
      const tradeAmount = parseUsdc('1');

      const { batch, sellerProof } = await createTradeAndSettle(tradeAmount);

      // Should still be able to claim even small amounts
      if (BigInt(sellerProof.amount) > 0n) {
        const receipt = await claimWithdrawal(context, wallets.bob, batch.epochId);
        expect(receipt.status).toBe('success');
      }
    });

    it('should handle claim for large amount', async () => {
      const { wallets } = context;
      // Large trade amount
      const tradeAmount = parseUsdc('1000');

      const { batch, sellerProof } = await createTradeAndSettle(tradeAmount);

      const initialBalance = await getUsdcBalance(context, wallets.bob.address);
      const receipt = await claimWithdrawal(context, wallets.bob, batch.epochId);
      expect(receipt.status).toBe('success');

      const finalBalance = await getUsdcBalance(context, wallets.bob.address);
      expect(finalBalance).toBe(initialBalance + BigInt(sellerProof.amount));
    });
  });
});
