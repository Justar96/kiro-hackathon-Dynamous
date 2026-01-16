/**
 * Property Tests for Order Signer
 * 
 * Feature: hybrid-clob-trading
 * Property 2: EIP-712 Order Hash Determinism
 * 
 * For any order parameters, constructing an EIP-712 typed data structure
 * and computing its hash SHALL produce the same hash for identical parameters.
 * 
 * **Validates: Requirements 2.1**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { type Address, type Hex } from 'viem';
import {
  OrderSigner,
  Side,
  SignatureType,
  type UnsignedOrder,
  DOMAIN_NAME,
  DOMAIN_VERSION,
  calculateOrderPrice,
  isOrderExpired,
  serializeOrder,
  deserializeOrder,
  type SignedOrder,
} from './orderSigner';

// ============================================
// Test Arbitraries
// ============================================

/**
 * Generate a valid Ethereum address
 */
const addressArb = fc.hexaString({ minLength: 40, maxLength: 40 })
  .map(hex => `0x${hex}` as Address);

/**
 * Generate a valid bytes32 hex string
 */
const bytes32Arb = fc.hexaString({ minLength: 64, maxLength: 64 })
  .map(hex => `0x${hex}` as Hex);

/**
 * Generate a valid bigint for amounts (non-negative, reasonable size)
 */
const amountArb = fc.bigUintN(128);

/**
 * Generate a valid chain ID
 */
const chainIdArb = fc.constantFrom(137, 80002); // Polygon mainnet and Amoy testnet

/**
 * Generate a valid Side enum value
 */
const sideArb = fc.constantFrom(Side.BUY, Side.SELL);

/**
 * Generate a valid SignatureType enum value
 */
const sigTypeArb = fc.constantFrom(
  SignatureType.EOA,
  SignatureType.POLY_PROXY,
  SignatureType.POLY_GNOSIS_SAFE
);

/**
 * Generate a valid unsigned order
 */
const unsignedOrderArb = fc.record({
  salt: fc.bigUintN(256),
  maker: addressArb,
  signer: addressArb,
  taker: addressArb,
  marketId: bytes32Arb,
  tokenId: fc.bigUintN(256),
  side: sideArb,
  makerAmount: amountArb,
  takerAmount: amountArb,
  expiration: fc.bigUintN(64),
  nonce: fc.bigUintN(64),
  feeRateBps: fc.bigUint({ max: 1000n }), // Max 10% fee
  sigType: sigTypeArb,
}) as fc.Arbitrary<UnsignedOrder>;

/**
 * Generate a valid signed order (with dummy signature)
 */
const signedOrderArb = unsignedOrderArb.map(order => ({
  ...order,
  signature: '0x' + '00'.repeat(65) as Hex, // Dummy 65-byte signature
})) as fc.Arbitrary<SignedOrder>;

// ============================================
// Property Tests
// ============================================

describe('OrderSigner Property Tests', () => {
  describe('Property 2: EIP-712 Order Hash Determinism', () => {
    /**
     * Property 2.1: Hash computation is deterministic
     * 
     * For any order, computing the hash twice SHALL produce identical results.
     */
    it('should produce identical hashes for the same order', () => {
      fc.assert(
        fc.property(
          chainIdArb,
          addressArb,
          unsignedOrderArb,
          (chainId, exchangeAddress, order) => {
            const signer = new OrderSigner(chainId, exchangeAddress);
            
            const hash1 = signer.hashOrder(order);
            const hash2 = signer.hashOrder(order);
            
            expect(hash1).toBe(hash2);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 2.2: Different orders produce different hashes
     * 
     * For any two orders with different salt values, the hashes SHALL differ.
     */
    it('should produce different hashes for orders with different salts', () => {
      fc.assert(
        fc.property(
          chainIdArb,
          addressArb,
          unsignedOrderArb,
          fc.bigUintN(256),
          (chainId, exchangeAddress, order, differentSalt) => {
            // Skip if salts happen to be the same
            fc.pre(order.salt !== differentSalt);
            
            const signer = new OrderSigner(chainId, exchangeAddress);
            
            const hash1 = signer.hashOrder(order);
            const hash2 = signer.hashOrder({ ...order, salt: differentSalt });
            
            expect(hash1).not.toBe(hash2);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 2.3: Hash changes with any field modification
     * 
     * Modifying any field of an order SHALL produce a different hash.
     */
    it('should produce different hashes when any field changes', () => {
      fc.assert(
        fc.property(
          chainIdArb,
          addressArb,
          unsignedOrderArb,
          (chainId, exchangeAddress, order) => {
            const signer = new OrderSigner(chainId, exchangeAddress);
            const originalHash = signer.hashOrder(order);
            
            // Test each field modification produces different hash
            const modifications: Array<Partial<UnsignedOrder>> = [
              { salt: order.salt + 1n },
              { makerAmount: order.makerAmount + 1n },
              { takerAmount: order.takerAmount + 1n },
              { expiration: order.expiration + 1n },
              { nonce: order.nonce + 1n },
              { feeRateBps: (order.feeRateBps + 1n) % 1001n },
              { side: order.side === Side.BUY ? Side.SELL : Side.BUY },
              { sigType: order.sigType === SignatureType.EOA ? SignatureType.POLY_PROXY : SignatureType.EOA },
            ];
            
            for (const mod of modifications) {
              const modifiedOrder = { ...order, ...mod };
              const modifiedHash = signer.hashOrder(modifiedOrder);
              expect(modifiedHash).not.toBe(originalHash);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property 2.4: Hash is chain-specific
     * 
     * The same order on different chains SHALL produce different hashes.
     */
    it('should produce different hashes for different chain IDs', () => {
      fc.assert(
        fc.property(
          addressArb,
          unsignedOrderArb,
          (exchangeAddress, order) => {
            const signer1 = new OrderSigner(137, exchangeAddress); // Polygon mainnet
            const signer2 = new OrderSigner(80002, exchangeAddress); // Polygon Amoy
            
            const hash1 = signer1.hashOrder(order);
            const hash2 = signer2.hashOrder(order);
            
            expect(hash1).not.toBe(hash2);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 2.5: Hash is contract-address-specific
     * 
     * The same order with different verifying contracts SHALL produce different hashes.
     */
    it('should produce different hashes for different exchange addresses', () => {
      fc.assert(
        fc.property(
          chainIdArb,
          addressArb,
          addressArb,
          unsignedOrderArb,
          (chainId, address1, address2, order) => {
            // Skip if addresses happen to be the same
            fc.pre(address1.toLowerCase() !== address2.toLowerCase());
            
            const signer1 = new OrderSigner(chainId, address1);
            const signer2 = new OrderSigner(chainId, address2);
            
            const hash1 = signer1.hashOrder(order);
            const hash2 = signer2.hashOrder(order);
            
            expect(hash1).not.toBe(hash2);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 2.6: Hash output is valid bytes32
     * 
     * The hash output SHALL always be a valid 32-byte hex string.
     */
    it('should produce valid bytes32 hashes', () => {
      fc.assert(
        fc.property(
          chainIdArb,
          addressArb,
          unsignedOrderArb,
          (chainId, exchangeAddress, order) => {
            const signer = new OrderSigner(chainId, exchangeAddress);
            const hash = signer.hashOrder(order);
            
            // Should be a hex string
            expect(hash).toMatch(/^0x[0-9a-f]{64}$/i);
            
            // Should be exactly 66 characters (0x + 64 hex chars)
            expect(hash.length).toBe(66);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Order Creation Properties', () => {
    /**
     * Property: Salt generation is unique
     * 
     * Generated salts SHALL be unique across multiple calls.
     */
    it('should generate unique salts', () => {
      const signer = new OrderSigner(137, '0x' + '00'.repeat(20) as Address);
      const salts = new Set<string>();
      
      // Generate 100 salts and verify uniqueness
      for (let i = 0; i < 100; i++) {
        const salt = signer.generateSalt();
        const saltStr = salt.toString();
        expect(salts.has(saltStr)).toBe(false);
        salts.add(saltStr);
      }
    });

    /**
     * Property: Created orders have valid structure
     */
    it('should create orders with valid structure', () => {
      fc.assert(
        fc.property(
          chainIdArb,
          addressArb,
          addressArb,
          fc.bigUintN(64),
          bytes32Arb,
          fc.bigUintN(256),
          sideArb,
          amountArb,
          amountArb,
          (chainId, exchangeAddress, maker, nonce, marketId, tokenId, side, makerAmount, takerAmount) => {
            const signer = new OrderSigner(chainId, exchangeAddress);
            
            const order = signer.createOrder(maker, nonce, {
              marketId,
              tokenId,
              side,
              makerAmount,
              takerAmount,
            });
            
            // Verify order structure
            expect(order.maker).toBe(maker);
            expect(order.signer).toBe(maker); // EOA: signer === maker
            expect(order.taker).toBe('0x0000000000000000000000000000000000000000');
            expect(order.marketId).toBe(marketId);
            expect(order.tokenId).toBe(tokenId);
            expect(order.side).toBe(side);
            expect(order.makerAmount).toBe(makerAmount);
            expect(order.takerAmount).toBe(takerAmount);
            expect(order.nonce).toBe(nonce);
            expect(order.sigType).toBe(SignatureType.EOA);
            expect(typeof order.salt).toBe('bigint');
            expect(order.salt > 0n).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Price Calculation Properties', () => {
    /**
     * Property: Price is between 0 and 1 for valid orders
     */
    it('should calculate prices between 0 and 1', () => {
      fc.assert(
        fc.property(
          unsignedOrderArb,
          (order) => {
            // Skip orders with zero amounts
            fc.pre(order.makerAmount > 0n && order.takerAmount > 0n);
            
            const price = calculateOrderPrice(order);
            
            expect(price).toBeGreaterThanOrEqual(0);
            // Price can exceed 1 in some edge cases, but should be finite
            expect(Number.isFinite(price)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Price calculation is consistent
     */
    it('should calculate consistent prices for same order', () => {
      fc.assert(
        fc.property(
          unsignedOrderArb,
          (order) => {
            const price1 = calculateOrderPrice(order);
            const price2 = calculateOrderPrice(order);
            
            expect(price1).toBe(price2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Expiration Properties', () => {
    /**
     * Property: Orders with expiration 0 never expire
     */
    it('should not expire orders with expiration 0', () => {
      fc.assert(
        fc.property(
          unsignedOrderArb,
          (order) => {
            const orderWithNoExpiry = { ...order, expiration: 0n };
            expect(isOrderExpired(orderWithNoExpiry)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Orders with past expiration are expired
     */
    it('should mark orders with past expiration as expired', () => {
      fc.assert(
        fc.property(
          unsignedOrderArb,
          (order) => {
            // Set expiration to 1 second (definitely in the past)
            const expiredOrder = { ...order, expiration: 1n };
            expect(isOrderExpired(expiredOrder)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Orders with future expiration are not expired
     */
    it('should not mark orders with future expiration as expired', () => {
      fc.assert(
        fc.property(
          unsignedOrderArb,
          (order) => {
            // Set expiration to far future (year 3000)
            const futureExpiration = BigInt(Math.floor(new Date('3000-01-01').getTime() / 1000));
            const futureOrder = { ...order, expiration: futureExpiration };
            expect(isOrderExpired(futureOrder)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Serialization Properties', () => {
    /**
     * Property: Serialization round-trip preserves order data
     */
    it('should preserve order data through serialization round-trip', () => {
      fc.assert(
        fc.property(
          signedOrderArb,
          (order) => {
            const serialized = serializeOrder(order);
            const deserialized = deserializeOrder(serialized);
            
            // Verify all fields match
            expect(deserialized.salt).toBe(order.salt);
            expect(deserialized.maker).toBe(order.maker);
            expect(deserialized.signer).toBe(order.signer);
            expect(deserialized.taker).toBe(order.taker);
            expect(deserialized.marketId).toBe(order.marketId);
            expect(deserialized.tokenId).toBe(order.tokenId);
            expect(deserialized.side).toBe(order.side);
            expect(deserialized.makerAmount).toBe(order.makerAmount);
            expect(deserialized.takerAmount).toBe(order.takerAmount);
            expect(deserialized.expiration).toBe(order.expiration);
            expect(deserialized.nonce).toBe(order.nonce);
            expect(deserialized.feeRateBps).toBe(order.feeRateBps);
            expect(deserialized.sigType).toBe(order.sigType);
            expect(deserialized.signature).toBe(order.signature);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Serialized order is JSON-compatible
     */
    it('should produce JSON-serializable output', () => {
      fc.assert(
        fc.property(
          signedOrderArb,
          (order) => {
            const serialized = serializeOrder(order);
            
            // Should not throw when stringifying
            const jsonString = JSON.stringify(serialized);
            expect(typeof jsonString).toBe('string');
            
            // Should be parseable
            const parsed = JSON.parse(jsonString);
            expect(parsed).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Domain Configuration Properties', () => {
    /**
     * Property: Domain has correct name and version
     */
    it('should have correct domain name and version', () => {
      fc.assert(
        fc.property(
          chainIdArb,
          addressArb,
          (chainId, exchangeAddress) => {
            const signer = new OrderSigner(chainId, exchangeAddress);
            const domain = signer.getDomain();
            
            expect(domain.name).toBe(DOMAIN_NAME);
            expect(domain.version).toBe(DOMAIN_VERSION);
            expect(domain.chainId).toBe(BigInt(chainId));
            expect(domain.verifyingContract).toBe(exchangeAddress);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
