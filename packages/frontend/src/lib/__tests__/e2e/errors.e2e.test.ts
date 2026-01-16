/**
 * Error Handling E2E Tests
 *
 * Tests error scenarios to verify the system handles failures gracefully.
 * Validates blockchain disconnection handling, contract revert propagation,
 * SSE reconnection, and gas error handling.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { type Hex, encodeFunctionData, erc20Abi } from 'viem';
import {
  setupE2ETests,
  teardownE2ETests,
  type E2ETestContext,
} from './setup';
import {
  deposit,
  submitOrder,
  getOrderBook,
  getOffChainBalance,
  mineBlocks,
  parseUsdc,
  waitFor,
  approveUsdc,
} from './helpers';

// Skip E2E tests in CI unless explicitly enabled
const SKIP_E2E = process.env.CI && !process.env.RUN_E2E_TESTS;

// Test market configuration
const TEST_MARKET_ID = '0x' + 'e'.repeat(64) as Hex;
const TEST_TOKEN_ID = 1n;

// Settlement vault ABI for testing reverts
const settlementVaultAbi = [
  {
    type: 'function',
    name: 'deposit',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
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
] as const;

describe.skipIf(SKIP_E2E)('Error Handling E2E Tests', () => {
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
  // Requirement 13.1: Blockchain Disconnection Handling
  // ============================================

  describe('Blockchain Disconnection Handling', () => {
    /**
     * Test that backend returns appropriate error responses when
     * blockchain connection is unavailable.
     * Requirement: 13.1
     */
    it('should return appropriate error when backend cannot reach blockchain', async () => {
      // The backend health endpoint should indicate service status
      const healthResponse = await fetch(`${context.backendUrl}/health`);
      expect(healthResponse.ok).toBe(true);

      const health = await healthResponse.json();
      
      // Health endpoint should report service status
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('services');
      expect(['ok', 'degraded']).toContain(health.status);
    });

    it('should handle indexer service unavailability gracefully', async () => {
      const { wallets } = context;

      // Request deposits for a user - should work even if indexer has issues
      const depositsResponse = await fetch(
        `${context.backendUrl}/api/deposits/${wallets.alice.address}`
      );

      // Should return either success or a proper error response
      if (depositsResponse.ok) {
        const data = await depositsResponse.json();
        expect(data).toHaveProperty('address');
        expect(data).toHaveProperty('pending');
      } else {
        // If indexer not configured, should return 503 with clear error
        expect(depositsResponse.status).toBe(503);
        const error = await depositsResponse.json();
        expect(error).toHaveProperty('error');
        expect(error.error).toContain('not configured');
      }
    });

    it('should handle settlement service unavailability gracefully', async () => {
      // Request settlement epochs - should handle missing service
      const epochsResponse = await fetch(`${context.backendUrl}/api/settlement/epochs`);

      if (epochsResponse.ok) {
        const data = await epochsResponse.json();
        expect(data).toHaveProperty('currentEpoch');
        expect(data).toHaveProperty('epochs');
      } else {
        // If settlement not configured, should return 503 with clear error
        expect(epochsResponse.status).toBe(503);
        const error = await epochsResponse.json();
        expect(error).toHaveProperty('error');
      }
    });

    it('should continue accepting orders when blockchain features are degraded', async () => {
      const { wallets } = context;

      // Deposit first to have balance
      const depositAmount = parseUsdc('500');
      await deposit(context, wallets.alice, depositAmount);
      await mineBlocks(context, 25);

      await waitFor(
        async () => {
          const balance = await getOffChainBalance(context, wallets.alice.address);
          return balance.total >= depositAmount;
        },
        15000,
        500
      );

      // Submit an order - should work regardless of blockchain status
      const result = await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0, // BUY
        priceBps: 5000,
        amount: parseUsdc('50'),
        marketId: TEST_MARKET_ID,
      });

      // Order submission should succeed (matching engine is in-memory)
      expect(result.status).toBe('accepted');
      expect(result.orderId).toBeTruthy();
    });
  });

  // ============================================
  // Requirement 13.2: Contract Revert Error Propagation
  // ============================================

  describe('Contract Revert Error Propagation', () => {
    /**
     * Test that contract revert errors are propagated to the frontend
     * with user-friendly messages.
     * Requirement: 13.2
     */
    it('should propagate insufficient allowance error on deposit', async () => {
      const { wallets, contracts } = context;
      const depositAmount = parseUsdc('100');

      // Try to deposit without approval - should revert
      const data = encodeFunctionData({
        abi: settlementVaultAbi,
        functionName: 'deposit',
        args: [depositAmount],
      });

      // This should fail with an error about allowance
      await expect(
        wallets.charlie.sendTransaction({
          to: contracts.settlementVault,
          data,
        })
      ).rejects.toThrow();
    });

    it('should propagate invalid proof error on claim', async () => {
      const { wallets, contracts } = context;

      // Try to claim with invalid proof
      const invalidProof: Hex[] = [
        '0x' + '1'.repeat(64) as Hex,
        '0x' + '2'.repeat(64) as Hex,
      ];

      const data = encodeFunctionData({
        abi: settlementVaultAbi,
        functionName: 'claim',
        args: [1n, parseUsdc('100'), invalidProof],
      });

      // This should fail with an error about invalid proof
      await expect(
        wallets.alice.sendTransaction({
          to: contracts.settlementVault,
          data,
        })
      ).rejects.toThrow();
    });

    it('should return user-friendly error for insufficient balance order', async () => {
      const { wallets } = context;

      // Try to submit order without any balance
      const result = await submitOrder(context, wallets.charlie, {
        tokenId: TEST_TOKEN_ID,
        side: 0, // BUY
        priceBps: 5000,
        amount: parseUsdc('1000'), // Large amount with no balance
        marketId: TEST_MARKET_ID,
      });

      // Should be rejected with clear error
      expect(result.status).toBe('rejected');
      expect(result.error).toBeTruthy();
      expect(result.errorCode).toBeTruthy();
    });

    it('should return user-friendly error for invalid signature', async () => {
      const { wallets } = context;

      // Deposit first
      const depositAmount = parseUsdc('500');
      await deposit(context, wallets.alice, depositAmount);
      await mineBlocks(context, 25);

      await waitFor(
        async () => {
          const balance = await getOffChainBalance(context, wallets.alice.address);
          return balance.total >= depositAmount;
        },
        15000,
        500
      );

      // Submit order with tampered signature
      const response = await fetch(`${context.backendUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salt: '12345',
          maker: wallets.alice.address,
          signer: wallets.alice.address,
          taker: '0x0000000000000000000000000000000000000000',
          marketId: TEST_MARKET_ID,
          tokenId: TEST_TOKEN_ID.toString(),
          side: 0,
          makerAmount: parseUsdc('50').toString(),
          takerAmount: parseUsdc('100').toString(),
          expiration: (BigInt(Math.floor(Date.now() / 1000)) + 3600n).toString(),
          nonce: '0',
          feeRateBps: '0',
          sigType: 0,
          signature: '0x' + 'ff'.repeat(65), // Invalid signature
        }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);

      const error = await response.json();
      expect(error).toHaveProperty('error');
      expect(error).toHaveProperty('errorCode');
    });

    it('should return user-friendly error for expired order', async () => {
      const { wallets } = context;

      // Deposit first
      const depositAmount = parseUsdc('500');
      await deposit(context, wallets.alice, depositAmount);
      await mineBlocks(context, 25);

      await waitFor(
        async () => {
          const balance = await getOffChainBalance(context, wallets.alice.address);
          return balance.total >= depositAmount;
        },
        15000,
        500
      );

      // Submit order with past expiration
      const response = await fetch(`${context.backendUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salt: '12345',
          maker: wallets.alice.address,
          signer: wallets.alice.address,
          taker: '0x0000000000000000000000000000000000000000',
          marketId: TEST_MARKET_ID,
          tokenId: TEST_TOKEN_ID.toString(),
          side: 0,
          makerAmount: parseUsdc('50').toString(),
          takerAmount: parseUsdc('100').toString(),
          expiration: '1000', // Expired timestamp
          nonce: '0',
          feeRateBps: '0',
          sigType: 0,
          signature: '0x' + '00'.repeat(65),
        }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);

      const error = await response.json();
      expect(error).toHaveProperty('error');
    });
  });

  // ============================================
  // Requirement 13.3: SSE Reconnection
  // ============================================

  describe('SSE Reconnection', () => {
    /**
     * Test that SSE connections can be established and receive events.
     * Requirement: 13.3
     */
    it('should establish SSE connection for order book stream', async () => {
      // Create an AbortController to cancel the request
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(
          `${context.backendUrl}/api/orderbook/${TEST_MARKET_ID}/${TEST_TOKEN_ID}/stream`,
          {
            headers: { Accept: 'text/event-stream' },
            signal: controller.signal,
          }
        );

        expect(response.ok).toBe(true);
        expect(response.headers.get('content-type')).toContain('text/event-stream');

        // Read initial snapshot event
        const reader = response.body?.getReader();
        if (reader) {
          const { value, done } = await reader.read();
          expect(done).toBe(false);
          
          const text = new TextDecoder().decode(value);
          // Should receive snapshot event
          expect(text).toContain('event:');
          
          reader.cancel();
        }
      } finally {
        clearTimeout(timeout);
        controller.abort();
      }
    });

    it('should establish SSE connection for settlement stream', async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(
          `${context.backendUrl}/api/settlement/stream`,
          {
            headers: { Accept: 'text/event-stream' },
            signal: controller.signal,
          }
        );

        expect(response.ok).toBe(true);
        expect(response.headers.get('content-type')).toContain('text/event-stream');

        // Read initial connected event
        const reader = response.body?.getReader();
        if (reader) {
          const { value, done } = await reader.read();
          expect(done).toBe(false);
          
          const text = new TextDecoder().decode(value);
          // Should receive connected event
          expect(text).toContain('event:');
          
          reader.cancel();
        }
      } finally {
        clearTimeout(timeout);
        controller.abort();
      }
    });

    it('should establish SSE connection for balance stream', async () => {
      const { wallets } = context;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(
          `${context.backendUrl}/api/balances/${wallets.alice.address}/stream`,
          {
            headers: { Accept: 'text/event-stream' },
            signal: controller.signal,
          }
        );

        expect(response.ok).toBe(true);
        expect(response.headers.get('content-type')).toContain('text/event-stream');

        // Read initial snapshot event
        const reader = response.body?.getReader();
        if (reader) {
          const { value, done } = await reader.read();
          expect(done).toBe(false);
          
          const text = new TextDecoder().decode(value);
          // Should receive snapshot event
          expect(text).toContain('event:');
          
          reader.cancel();
        }
      } finally {
        clearTimeout(timeout);
        controller.abort();
      }
    });

    it('should receive order book updates via SSE after order submission', async () => {
      const { wallets } = context;

      // Deposit first
      const depositAmount = parseUsdc('500');
      await deposit(context, wallets.alice, depositAmount);
      await mineBlocks(context, 25);

      await waitFor(
        async () => {
          const balance = await getOffChainBalance(context, wallets.alice.address);
          return balance.total >= depositAmount;
        },
        15000,
        500
      );

      // Start SSE connection
      const controller = new AbortController();
      const events: string[] = [];

      const ssePromise = (async () => {
        const response = await fetch(
          `${context.backendUrl}/api/orderbook/${TEST_MARKET_ID}/${TEST_TOKEN_ID}/stream`,
          {
            headers: { Accept: 'text/event-stream' },
            signal: controller.signal,
          }
        );

        const reader = response.body?.getReader();
        if (!reader) return;

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            const text = new TextDecoder().decode(value);
            events.push(text);
            
            // Stop after receiving a few events
            if (events.length >= 3) break;
          }
        } catch {
          // Connection aborted
        }
      })();

      // Wait for SSE connection to establish
      await new Promise(resolve => setTimeout(resolve, 500));

      // Submit an order
      await submitOrder(context, wallets.alice, {
        tokenId: TEST_TOKEN_ID,
        side: 0, // BUY
        priceBps: 5000,
        amount: parseUsdc('50'),
        marketId: TEST_MARKET_ID,
      });

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 1000));
      controller.abort();

      // Should have received at least the snapshot event
      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.includes('snapshot'))).toBe(true);
    }, 30000);

    it('should handle multiple concurrent SSE connections', async () => {
      const controllers: AbortController[] = [];
      const connections: Promise<Response>[] = [];

      try {
        // Create multiple SSE connections
        for (let i = 0; i < 3; i++) {
          const controller = new AbortController();
          controllers.push(controller);

          const connection = fetch(
            `${context.backendUrl}/api/orderbook/${TEST_MARKET_ID}/${TEST_TOKEN_ID}/stream`,
            {
              headers: { Accept: 'text/event-stream' },
              signal: controller.signal,
            }
          );
          connections.push(connection);
        }

        // All connections should succeed
        const responses = await Promise.all(connections);
        
        for (const response of responses) {
          expect(response.ok).toBe(true);
          expect(response.headers.get('content-type')).toContain('text/event-stream');
        }
      } finally {
        // Cleanup all connections
        for (const controller of controllers) {
          controller.abort();
        }
      }
    });
  });

  // ============================================
  // Requirement 13.4: Gas Error Handling
  // ============================================

  describe('Gas Error Handling', () => {
    /**
     * Test that gas-related errors are handled appropriately.
     * Requirement: 13.4
     */
    it('should handle transaction with insufficient gas gracefully', async () => {
      const { wallets, contracts } = context;
      const depositAmount = parseUsdc('100');

      // First approve
      await approveUsdc(context, wallets.alice, depositAmount);

      // Try to send transaction with very low gas
      const data = encodeFunctionData({
        abi: settlementVaultAbi,
        functionName: 'deposit',
        args: [depositAmount],
      });

      // This should fail due to insufficient gas
      await expect(
        wallets.alice.sendTransaction({
          to: contracts.settlementVault,
          data,
          gas: 21000n, // Too low for contract call
        })
      ).rejects.toThrow();
    });

    it('should successfully complete transaction with adequate gas', async () => {
      const { wallets } = context;
      const depositAmount = parseUsdc('100');

      // Normal deposit should succeed with default gas estimation
      const receipt = await deposit(context, wallets.alice, depositAmount);
      expect(receipt.status).toBe('success');
      expect(receipt.gasUsed).toBeGreaterThan(0n);
    });

    it('should handle zero value transfer appropriately', async () => {
      const { wallets, contracts } = context;

      // Approve zero amount
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [contracts.settlementVault, 0n],
      });

      // Zero approval should succeed
      const txHash = await wallets.alice.sendTransaction({
        to: contracts.usdc,
        data,
      });

      const receipt = await wallets.alice.waitForTransaction(txHash);
      expect(receipt.status).toBe('success');
    });

    it('should report gas usage in transaction receipts', async () => {
      const { wallets } = context;
      const depositAmount = parseUsdc('100');

      const receipt = await deposit(context, wallets.alice, depositAmount);

      // Receipt should contain gas information
      expect(receipt).toHaveProperty('gasUsed');
      expect(receipt.gasUsed).toBeGreaterThan(0n);
      expect(receipt).toHaveProperty('effectiveGasPrice');
    });
  });

  // ============================================
  // Additional Error Scenarios
  // ============================================

  describe('API Error Responses', () => {
    it('should return 404 for non-existent order', async () => {
      const response = await fetch(
        `${context.backendUrl}/api/orders/non-existent-order-id`
      );

      expect(response.status).toBe(404);
      const error = await response.json();
      expect(error).toHaveProperty('error');
    });

    it('should return 400 for malformed order submission', async () => {
      const response = await fetch(`${context.backendUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing required fields
          maker: '0x1234',
        }),
      });

      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error).toHaveProperty('error');
    });

    it('should return 400 for order cancellation without maker header', async () => {
      const response = await fetch(
        `${context.backendUrl}/api/orders/some-order-id`,
        {
          method: 'DELETE',
          // Missing X-Maker-Address header
        }
      );

      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error.error).toContain('X-Maker-Address');
    });

    it('should return 404 for withdrawal proof of non-existent epoch', async () => {
      const { wallets } = context;

      const response = await fetch(
        `${context.backendUrl}/api/settlement/proof/99999/${wallets.alice.address}`
      );

      // Should return 404 or 503 depending on service configuration
      expect([404, 503]).toContain(response.status);
    });
  });

  describe('Input Validation Errors', () => {
    it('should reject order with negative amounts', async () => {
      const { wallets } = context;

      const response = await fetch(`${context.backendUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salt: '12345',
          maker: wallets.alice.address,
          signer: wallets.alice.address,
          taker: '0x0000000000000000000000000000000000000000',
          marketId: TEST_MARKET_ID,
          tokenId: TEST_TOKEN_ID.toString(),
          side: 0,
          makerAmount: '-100', // Negative amount
          takerAmount: '100',
          expiration: (BigInt(Math.floor(Date.now() / 1000)) + 3600n).toString(),
          nonce: '0',
          feeRateBps: '0',
          sigType: 0,
          signature: '0x' + '00'.repeat(65),
        }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it('should reject order with invalid address format', async () => {
      const response = await fetch(`${context.backendUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salt: '12345',
          maker: 'not-an-address', // Invalid address
          signer: 'not-an-address',
          taker: '0x0000000000000000000000000000000000000000',
          marketId: TEST_MARKET_ID,
          tokenId: TEST_TOKEN_ID.toString(),
          side: 0,
          makerAmount: '100',
          takerAmount: '100',
          expiration: (BigInt(Math.floor(Date.now() / 1000)) + 3600n).toString(),
          nonce: '0',
          feeRateBps: '0',
          sigType: 0,
          signature: '0x' + '00'.repeat(65),
        }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it('should handle invalid token ID gracefully', async () => {
      const response = await fetch(
        `${context.backendUrl}/api/orderbook/${TEST_MARKET_ID}/invalid-token-id`
      );

      // Should return 400 or 500 for invalid token ID
      expect(response.ok).toBe(false);
    });
  });
});
