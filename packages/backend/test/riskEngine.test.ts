import { describe, it, expect, beforeEach } from "bun:test";
import { RiskEngine, UserTier, TIER_LIMITS } from "../src/services/riskEngine";
import { Side, SignatureType, type SignedOrder } from "../src/types";

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

describe("RiskEngine", () => {
  let risk: RiskEngine;

  beforeEach(() => {
    risk = new RiskEngine();
  });

  it("should validate order within limits", () => {
    const order = createOrder();
    const result = risk.validateOrder(order);
    expect(result.valid).toBe(true);
  });

  it("should reject order exceeding size limit", () => {
    const order = createOrder({ makerAmount: 10n ** 30n });
    const result = risk.validateOrder(order);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Order size exceeds limit");
  });

  it("should reject order exceeding exposure limit", () => {
    // STANDARD tier has maxExposure of 10^24 (1M tokens)
    const order = createOrder({ makerAmount: 10n ** 23n }); // 100K per order
    
    // Record multiple orders to build up exposure (need > 10 to exceed 1M)
    for (let i = 0; i < 12; i++) {
      risk.recordOrder(`order-${i}`, order);
    }
    
    const result = risk.validateOrder(order);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Exposure limit exceeded");
  });

  it("should track exposure correctly", () => {
    const order = createOrder({ makerAmount: 100n });
    risk.recordOrder("order-1", order);
    
    expect(risk.getExposure(order.maker)).toBe(100n);
    
    risk.releaseOrder("order-1", order.maker, 100n);
    expect(risk.getExposure(order.maker)).toBe(0n);
  });

  it("should validate withdrawal within daily limit", () => {
    const result = risk.validateWithdrawal("0x1234", 10n ** 20n);
    expect(result.valid).toBe(true);
  });

  it("should reject withdrawal exceeding daily limit", () => {
    const user = "0x1234";
    // STANDARD tier has maxWithdrawalPerDay of 10^23 (100K tokens)
    risk.recordWithdrawal(user, 10n ** 23n);
    
    const result = risk.validateWithdrawal(user, 10n ** 20n);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Daily withdrawal limit exceeded");
  });

  it("should allow custom limits per user", () => {
    const user = "0x1234";
    risk.setLimits(user, { maxOrdersPerMinute: 10 });
    
    const limits = risk.getLimits(user);
    expect(limits.maxOrdersPerMinute).toBe(10);
  });

  it("should track active order count", () => {
    const order = createOrder();
    expect(risk.getActiveOrderCount(order.maker)).toBe(0);
    
    risk.recordOrder("order-1", order);
    expect(risk.getActiveOrderCount(order.maker)).toBe(1);
    
    risk.releaseOrder("order-1", order.maker, order.makerAmount);
    expect(risk.getActiveOrderCount(order.maker)).toBe(0);
  });

  describe("Tier-based limits", () => {
    it("should default to STANDARD tier", () => {
      const user = "0x1234";
      expect(risk.getTier(user)).toBe(UserTier.STANDARD);
      expect(risk.getLimits(user)).toEqual(TIER_LIMITS[UserTier.STANDARD]);
    });

    it("should apply PREMIUM tier limits when set", () => {
      const user = "0x1234";
      risk.setTier(user, UserTier.PREMIUM);
      
      expect(risk.getTier(user)).toBe(UserTier.PREMIUM);
      expect(risk.getLimits(user)).toEqual(TIER_LIMITS[UserTier.PREMIUM]);
    });

    it("should apply VIP tier limits when set", () => {
      const user = "0x1234";
      risk.setTier(user, UserTier.VIP);
      
      expect(risk.getTier(user)).toBe(UserTier.VIP);
      expect(risk.getLimits(user)).toEqual(TIER_LIMITS[UserTier.VIP]);
    });

    it("should clear custom limits when tier is set", () => {
      const user = "0x1234";
      risk.setLimits(user, { maxOrdersPerMinute: 999 });
      expect(risk.getLimits(user).maxOrdersPerMinute).toBe(999);
      
      risk.setTier(user, UserTier.PREMIUM);
      expect(risk.getLimits(user).maxOrdersPerMinute).toBe(TIER_LIMITS[UserTier.PREMIUM].maxOrdersPerMinute);
    });

    it("should allow VIP users higher order sizes", () => {
      const user = "0x1234";
      // Order that exceeds STANDARD but within VIP limits
      const order = createOrder({ 
        maker: user,
        makerAmount: 10n ** 24n // 1M tokens - exceeds STANDARD (100K) but within VIP (10M)
      });
      
      // Should fail with STANDARD tier
      let result = risk.validateOrder(order);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Order size exceeds limit");
      
      // Should pass with VIP tier
      risk.setTier(user, UserTier.VIP);
      result = risk.validateOrder(order);
      expect(result.valid).toBe(true);
    });

    it("should return tier limits via getTierLimits", () => {
      expect(risk.getTierLimits(UserTier.STANDARD)).toEqual(TIER_LIMITS[UserTier.STANDARD]);
      expect(risk.getTierLimits(UserTier.PREMIUM)).toEqual(TIER_LIMITS[UserTier.PREMIUM]);
      expect(risk.getTierLimits(UserTier.VIP)).toEqual(TIER_LIMITS[UserTier.VIP]);
    });

    it("should have progressively higher limits for higher tiers", () => {
      const standard = TIER_LIMITS[UserTier.STANDARD];
      const premium = TIER_LIMITS[UserTier.PREMIUM];
      const vip = TIER_LIMITS[UserTier.VIP];
      
      // VIP > PREMIUM > STANDARD for all limits
      expect(vip.maxOrderSize > premium.maxOrderSize).toBe(true);
      expect(premium.maxOrderSize > standard.maxOrderSize).toBe(true);
      
      expect(vip.maxExposure > premium.maxExposure).toBe(true);
      expect(premium.maxExposure > standard.maxExposure).toBe(true);
      
      expect(vip.maxOrdersPerMinute > premium.maxOrdersPerMinute).toBe(true);
      expect(premium.maxOrdersPerMinute > standard.maxOrdersPerMinute).toBe(true);
      
      expect(vip.maxWithdrawalPerDay > premium.maxWithdrawalPerDay).toBe(true);
      expect(premium.maxWithdrawalPerDay > standard.maxWithdrawalPerDay).toBe(true);
    });
  });
});
