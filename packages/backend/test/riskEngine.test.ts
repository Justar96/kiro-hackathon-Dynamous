import { describe, it, expect, beforeEach } from "bun:test";
import { RiskEngine } from "../src/services/riskEngine";
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
    const order = createOrder({ makerAmount: 10n ** 24n });
    
    // Record multiple orders to build up exposure
    for (let i = 0; i < 15; i++) {
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
    risk.recordWithdrawal(user, 10n ** 24n);
    
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
});
