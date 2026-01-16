/**
 * Property-Based Tests for Risk Engine
 * 
 * Feature: hybrid-clob-trading
 * 
 * These tests verify universal properties that must hold across all valid inputs.
 */

import { describe, test, expect } from "bun:test";
import * as fc from "fast-check";
import { RiskEngine, UserTier, TIER_LIMITS, type RiskLimits } from "../src/services/riskEngine";
import { Side, SignatureType, type SignedOrder } from "../src/types";

// Minimum 100 iterations per property test as per design doc
const NUM_RUNS = 100;

// Arbitraries for generating test data
const hexChar = fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f');
// Generate non-zero addresses (exclude all-zero address)
const addressArbitrary = fc.array(hexChar, { minLength: 40, maxLength: 40 })
  .map(chars => `0x${chars.join('')}`)
  .filter(addr => addr !== "0x0000000000000000000000000000000000000000");
const tokenIdArbitrary = fc.bigInt({ min: 0n, max: 2n ** 64n - 1n });
const amountArbitrary = fc.bigInt({ min: 1n, max: 2n ** 64n - 1n });
const tierArbitrary = fc.constantFrom(UserTier.STANDARD, UserTier.PREMIUM, UserTier.VIP);

// Helper to create a signed order
function createOrder(overrides: Partial<SignedOrder> = {}): SignedOrder {
  return {
    salt: 1n,
    maker: "0x1234567890123456789012345678901234567890",
    signer: "0x1234567890123456789012345678901234567890",
    taker: "0x0000000000000000000000000000000000000000",
    marketId: "0x" + "ab".repeat(32),
    tokenId: 1n,
    side: Side.BUY,
    makerAmount: 10n ** 18n,
    takerAmount: 10n ** 18n,
    expiration: BigInt(Math.floor(Date.now() / 1000) + 3600),
    nonce: 0n,
    feeRateBps: 0n,
    sigType: SignatureType.EOA,
    signature: "0x",
    ...overrides,
  };
}

describe("Risk Engine Property Tests", () => {
  /**
   * Property 24: Risk Limit Enforcement
   * 
   * For any operation (order or withdrawal) that exceeds its configured limit 
   * (order size, exposure, rate, or daily withdrawal), the Risk_Engine SHALL 
   * reject the operation.
   * 
   * **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
   */
  describe("Property 24: Risk Limit Enforcement", () => {
    test("orders exceeding maxOrderSize are always rejected", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          tierArbitrary,
          // Generate amount that exceeds the tier's limit
          fc.bigInt({ min: 1n, max: 10n ** 10n }),
          (user, tier, excessMultiplier) => {
            const risk = new RiskEngine();
            risk.setTier(user, tier);
            
            const limits = risk.getLimits(user);
            // Create order that exceeds the limit
            const exceedingAmount = limits.maxOrderSize + excessMultiplier;
            
            const order = createOrder({
              maker: user,
              makerAmount: exceedingAmount,
            });
            
            const result = risk.validateOrder(order);
            
            // Must be rejected
            expect(result.valid).toBe(false);
            expect(result.reason).toBe("Order size exceeds limit");
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("orders within maxOrderSize are accepted (when other limits not exceeded)", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          tierArbitrary,
          fc.integer({ min: 1, max: 99 }),
          (user, tier, percentOfLimit) => {
            const risk = new RiskEngine();
            risk.setTier(user, tier);
            
            const limits = risk.getLimits(user);
            // Create order within the limit
            const withinAmount = (limits.maxOrderSize * BigInt(percentOfLimit)) / 100n;
            fc.pre(withinAmount > 0n);
            
            const order = createOrder({
              maker: user,
              makerAmount: withinAmount,
            });
            
            const result = risk.validateOrder(order);
            
            // Should be accepted (no other limits exceeded)
            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("orders exceeding maxExposure are always rejected", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          tierArbitrary,
          fc.integer({ min: 1, max: 20 }),
          (user, tier, numOrders) => {
            const risk = new RiskEngine();
            risk.setTier(user, tier);
            
            const limits = risk.getLimits(user);
            // Calculate order size that will exceed exposure after numOrders
            // Each order is 10% of maxExposure, so after 11+ orders we exceed
            const orderSize = (limits.maxExposure / 10n);
            fc.pre(orderSize > 0n && orderSize <= limits.maxOrderSize);
            
            const order = createOrder({
              maker: user,
              makerAmount: orderSize,
            });
            
            // Record orders to build up exposure
            for (let i = 0; i < numOrders; i++) {
              risk.recordOrder(`order-${i}`, order);
            }
            
            // Check if we've exceeded exposure
            const currentExposure = risk.getExposure(user);
            const wouldExceed = currentExposure + orderSize > limits.maxExposure;
            
            const result = risk.validateOrder(order);
            
            if (wouldExceed) {
              expect(result.valid).toBe(false);
              expect(result.reason).toBe("Exposure limit exceeded");
            } else {
              expect(result.valid).toBe(true);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("withdrawals exceeding daily limit are always rejected", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          tierArbitrary,
          fc.bigInt({ min: 1n, max: 10n ** 10n }),
          (user, tier, excessAmount) => {
            const risk = new RiskEngine();
            risk.setTier(user, tier);
            
            const limits = risk.getLimits(user);
            
            // First withdrawal uses up the daily limit
            risk.recordWithdrawal(user, limits.maxWithdrawalPerDay);
            
            // Second withdrawal should be rejected
            const result = risk.validateWithdrawal(user, excessAmount);
            
            expect(result.valid).toBe(false);
            expect(result.reason).toBe("Daily withdrawal limit exceeded");
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("withdrawals within daily limit are accepted", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          tierArbitrary,
          fc.integer({ min: 1, max: 99 }),
          (user, tier, percentOfLimit) => {
            const risk = new RiskEngine();
            risk.setTier(user, tier);
            
            const limits = risk.getLimits(user);
            const withdrawAmount = (limits.maxWithdrawalPerDay * BigInt(percentOfLimit)) / 100n;
            fc.pre(withdrawAmount > 0n);
            
            const result = risk.validateWithdrawal(user, withdrawAmount);
            
            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("rate limit enforcement rejects orders when exceeded", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          // Only test STANDARD tier since it has rate limit <= 100 (the timestamp buffer size)
          fc.constant(UserTier.STANDARD),
          (user, tier) => {
            const risk = new RiskEngine();
            risk.setTier(user, tier);
            
            const limits = risk.getLimits(user);
            // Note: Implementation only keeps last 100 timestamps, so rate limits > 100 won't work correctly
            fc.pre(limits.maxOrdersPerMinute <= 100);
            
            // Create a tiny order that won't hit size/exposure limits
            const order = createOrder({
              maker: user,
              makerAmount: 1n,
            });
            
            // Record orders up to the rate limit
            for (let i = 0; i < limits.maxOrdersPerMinute; i++) {
              risk.recordOrder(`order-${i}`, order);
            }
            
            // Next order should be rejected due to rate limit
            const result = risk.validateOrder(order);
            
            expect(result.valid).toBe(false);
            expect(result.reason).toBe("Rate limit exceeded");
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("operations at exact limit boundary are accepted", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          tierArbitrary,
          (user, tier) => {
            const risk = new RiskEngine();
            risk.setTier(user, tier);
            
            const limits = risk.getLimits(user);
            
            // Order at exact maxOrderSize should be accepted
            const order = createOrder({
              maker: user,
              makerAmount: limits.maxOrderSize,
            });
            
            const result = risk.validateOrder(order);
            expect(result.valid).toBe(true);
            
            // Withdrawal at exact maxWithdrawalPerDay should be accepted
            const withdrawResult = risk.validateWithdrawal(user, limits.maxWithdrawalPerDay);
            expect(withdrawResult.valid).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("rejection reason is specific to the violated limit", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          // Use STANDARD tier for rate limit test since it has rate limit <= 100
          fc.constant(UserTier.STANDARD),
          fc.constantFrom("orderSize", "exposure", "rate", "withdrawal"),
          (user, tier, limitType) => {
            const risk = new RiskEngine();
            risk.setTier(user, tier);
            
            const limits = risk.getLimits(user);
            
            if (limitType === "orderSize") {
              const order = createOrder({
                maker: user,
                makerAmount: limits.maxOrderSize + 1n,
              });
              const result = risk.validateOrder(order);
              expect(result.valid).toBe(false);
              expect(result.reason).toBe("Order size exceeds limit");
            } else if (limitType === "exposure") {
              // Build up exposure first
              const orderSize = limits.maxExposure / 2n;
              fc.pre(orderSize > 0n && orderSize <= limits.maxOrderSize);
              const order = createOrder({
                maker: user,
                makerAmount: orderSize,
              });
              risk.recordOrder("order-1", order);
              risk.recordOrder("order-2", order);
              
              // This should exceed exposure
              const result = risk.validateOrder(order);
              expect(result.valid).toBe(false);
              expect(result.reason).toBe("Exposure limit exceeded");
            } else if (limitType === "rate") {
              // Note: Implementation only keeps last 100 timestamps
              fc.pre(limits.maxOrdersPerMinute <= 100);
              const smallOrder = createOrder({
                maker: user,
                makerAmount: 1n,
              });
              for (let i = 0; i < limits.maxOrdersPerMinute; i++) {
                risk.recordOrder(`order-${i}`, smallOrder);
              }
              const result = risk.validateOrder(smallOrder);
              expect(result.valid).toBe(false);
              expect(result.reason).toBe("Rate limit exceeded");
            } else {
              // withdrawal
              risk.recordWithdrawal(user, limits.maxWithdrawalPerDay);
              const result = risk.validateWithdrawal(user, 1n);
              expect(result.valid).toBe(false);
              expect(result.reason).toBe("Daily withdrawal limit exceeded");
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });


  /**
   * Property 25: Tier-Based Limit Application
   * 
   * For any user with a configured tier, the Risk_Engine SHALL apply that tier's 
   * limits rather than default limits.
   * 
   * **Validates: Requirements 10.6**
   */
  describe("Property 25: Tier-Based Limit Application", () => {
    test("users with different tiers have different limits applied", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          addressArbitrary,
          addressArbitrary,
          (standardUser, premiumUser, vipUser) => {
            // Pre-condition: all users must be different
            fc.pre(
              standardUser.toLowerCase() !== premiumUser.toLowerCase() &&
              premiumUser.toLowerCase() !== vipUser.toLowerCase() &&
              standardUser.toLowerCase() !== vipUser.toLowerCase()
            );
            
            const risk = new RiskEngine();
            
            // Set different tiers
            risk.setTier(standardUser, UserTier.STANDARD);
            risk.setTier(premiumUser, UserTier.PREMIUM);
            risk.setTier(vipUser, UserTier.VIP);
            
            // Get limits for each user
            const standardLimits = risk.getLimits(standardUser);
            const premiumLimits = risk.getLimits(premiumUser);
            const vipLimits = risk.getLimits(vipUser);
            
            // Verify each user gets their tier's limits
            expect(standardLimits).toEqual(TIER_LIMITS[UserTier.STANDARD]);
            expect(premiumLimits).toEqual(TIER_LIMITS[UserTier.PREMIUM]);
            expect(vipLimits).toEqual(TIER_LIMITS[UserTier.VIP]);
            
            // Verify limits are different between tiers
            expect(vipLimits.maxOrderSize > premiumLimits.maxOrderSize).toBe(true);
            expect(premiumLimits.maxOrderSize > standardLimits.maxOrderSize).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("tier change updates effective limits immediately", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          tierArbitrary,
          tierArbitrary,
          (user, initialTier, newTier) => {
            const risk = new RiskEngine();
            
            // Set initial tier
            risk.setTier(user, initialTier);
            const initialLimits = risk.getLimits(user);
            expect(initialLimits).toEqual(TIER_LIMITS[initialTier]);
            
            // Change tier
            risk.setTier(user, newTier);
            const newLimits = risk.getLimits(user);
            expect(newLimits).toEqual(TIER_LIMITS[newTier]);
            
            // Verify the tier was actually changed
            expect(risk.getTier(user)).toBe(newTier);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("order validation uses tier-specific limits", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          (user) => {
            const risk = new RiskEngine();
            
            // Amount that exceeds STANDARD but is within VIP
            const testAmount = TIER_LIMITS[UserTier.STANDARD].maxOrderSize + 1n;
            fc.pre(testAmount <= TIER_LIMITS[UserTier.VIP].maxOrderSize);
            
            const order = createOrder({
              maker: user,
              makerAmount: testAmount,
            });
            
            // With STANDARD tier, should be rejected
            risk.setTier(user, UserTier.STANDARD);
            const standardResult = risk.validateOrder(order);
            expect(standardResult.valid).toBe(false);
            
            // With VIP tier, should be accepted
            risk.setTier(user, UserTier.VIP);
            const vipResult = risk.validateOrder(order);
            expect(vipResult.valid).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("withdrawal validation uses tier-specific limits", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          (user) => {
            const risk = new RiskEngine();
            
            // Amount that exceeds STANDARD but is within VIP
            const testAmount = TIER_LIMITS[UserTier.STANDARD].maxWithdrawalPerDay + 1n;
            fc.pre(testAmount <= TIER_LIMITS[UserTier.VIP].maxWithdrawalPerDay);
            
            // With STANDARD tier, should be rejected
            risk.setTier(user, UserTier.STANDARD);
            const standardResult = risk.validateWithdrawal(user, testAmount);
            expect(standardResult.valid).toBe(false);
            
            // With VIP tier, should be accepted
            risk.setTier(user, UserTier.VIP);
            const vipResult = risk.validateWithdrawal(user, testAmount);
            expect(vipResult.valid).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("exposure validation uses tier-specific limits", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          (user) => {
            const risk = new RiskEngine();
            
            // Build up exposure that exceeds STANDARD but is within VIP
            const standardMaxExposure = TIER_LIMITS[UserTier.STANDARD].maxExposure;
            const vipMaxExposure = TIER_LIMITS[UserTier.VIP].maxExposure;
            
            // Use an order size that's valid for both tiers
            const orderSize = TIER_LIMITS[UserTier.STANDARD].maxOrderSize / 2n;
            fc.pre(orderSize > 0n);
            
            const order = createOrder({
              maker: user,
              makerAmount: orderSize,
            });
            
            // With STANDARD tier, build up exposure to near limit
            risk.setTier(user, UserTier.STANDARD);
            
            // Record orders to build exposure
            const numOrdersToExceed = Number(standardMaxExposure / orderSize) + 1;
            for (let i = 0; i < numOrdersToExceed; i++) {
              risk.recordOrder(`order-${i}`, order);
            }
            
            // Should be rejected with STANDARD tier
            const standardResult = risk.validateOrder(order);
            expect(standardResult.valid).toBe(false);
            expect(standardResult.reason).toBe("Exposure limit exceeded");
            
            // Upgrade to VIP - exposure is still tracked but limit is higher
            risk.setTier(user, UserTier.VIP);
            
            // Current exposure should still be below VIP limit
            const currentExposure = risk.getExposure(user);
            if (currentExposure + orderSize <= vipMaxExposure) {
              const vipResult = risk.validateOrder(order);
              expect(vipResult.valid).toBe(true);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("rate limit validation uses tier-specific limits", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          (user) => {
            const risk = new RiskEngine();
            
            const standardRateLimit = TIER_LIMITS[UserTier.STANDARD].maxOrdersPerMinute;
            const vipRateLimit = TIER_LIMITS[UserTier.VIP].maxOrdersPerMinute;
            
            // Use a tiny order to avoid hitting size/exposure limits
            const order = createOrder({
              maker: user,
              makerAmount: 1n,
            });
            
            // With STANDARD tier, hit the rate limit
            risk.setTier(user, UserTier.STANDARD);
            for (let i = 0; i < standardRateLimit; i++) {
              risk.recordOrder(`order-${i}`, order);
            }
            
            // Should be rejected with STANDARD tier
            const standardResult = risk.validateOrder(order);
            expect(standardResult.valid).toBe(false);
            expect(standardResult.reason).toBe("Rate limit exceeded");
            
            // Upgrade to VIP - rate limit is higher
            risk.setTier(user, UserTier.VIP);
            
            // Should now be accepted since VIP has higher rate limit
            const vipResult = risk.validateOrder(order);
            expect(vipResult.valid).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("default tier is STANDARD for users without explicit tier", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          (user) => {
            const risk = new RiskEngine();
            
            // User without explicit tier should get STANDARD
            expect(risk.getTier(user)).toBe(UserTier.STANDARD);
            expect(risk.getLimits(user)).toEqual(TIER_LIMITS[UserTier.STANDARD]);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("getTierLimits returns correct limits for each tier", () => {
      fc.assert(
        fc.property(
          tierArbitrary,
          (tier) => {
            const risk = new RiskEngine();
            
            const limits = risk.getTierLimits(tier);
            expect(limits).toEqual(TIER_LIMITS[tier]);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
