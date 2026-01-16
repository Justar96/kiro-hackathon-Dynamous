import { describe, test, expect, beforeEach } from "bun:test";
import { MatchingEngine } from "../src/services/matchingEngine";
import { Side, SignatureType, MatchType, type SignedOrder } from "../src/types";

describe("MatchingEngine", () => {
  let engine: MatchingEngine;
  const marketId = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const tokenId = 1n;
  const ONE = 10n ** 18n;

  beforeEach(() => {
    engine = new MatchingEngine();
    // Deposit collateral for test users
    engine.deposit("0xAlice", 0n, 1000n * ONE);
    engine.deposit("0xBob", 0n, 1000n * ONE);
    engine.deposit("0xBob", tokenId, 100n * ONE); // Bob has tokens to sell
  });

  function createOrder(
    maker: string,
    side: Side,
    makerAmount: bigint,
    takerAmount: bigint
  ): SignedOrder {
    return {
      salt: BigInt(Math.floor(Math.random() * 1e18)),
      maker,
      signer: maker,
      taker: "0x0000000000000000000000000000000000000000",
      marketId,
      tokenId,
      side,
      makerAmount,
      takerAmount,
      expiration: 0n,
      nonce: 0n,
      feeRateBps: 0n,
      sigType: SignatureType.EOA,
      signature: "0x",
    };
  }

  test("should add buy order to book", () => {
    const order = createOrder("0xAlice", Side.BUY, 50n * ONE, 100n * ONE);
    const { orderId, trades } = engine.addOrder(order);

    expect(orderId).toBeDefined();
    expect(trades.length).toBe(0);

    const book = engine.getOrderBook(marketId, tokenId);
    expect(book.bids.length).toBe(1);
    expect(book.asks.length).toBe(0);
  });

  test("should add sell order to book", () => {
    const order = createOrder("0xBob", Side.SELL, 50n * ONE, 25n * ONE);
    const { orderId, trades } = engine.addOrder(order);

    expect(orderId).toBeDefined();
    expect(trades.length).toBe(0);

    const book = engine.getOrderBook(marketId, tokenId);
    expect(book.bids.length).toBe(0);
    expect(book.asks.length).toBe(1);
  });

  test("should match crossing orders", () => {
    // Bob places sell at $0.50 (50 collateral for 100 tokens)
    const sellOrder = createOrder("0xBob", Side.SELL, 50n * ONE, 25n * ONE);
    engine.addOrder(sellOrder);

    // Alice places buy at $0.60 (60 collateral for 100 tokens)
    const buyOrder = createOrder("0xAlice", Side.BUY, 60n * ONE, 100n * ONE);
    const { trades } = engine.addOrder(buyOrder);

    expect(trades.length).toBe(1);
    expect(trades[0].maker).toBe("0xAlice");
    expect(trades[0].taker).toBe("0xBob");
  });

  test("should maintain price-time priority for bids", () => {
    // Add multiple bids at different prices
    const bid1 = createOrder("0xAlice", Side.BUY, 50n * ONE, 100n * ONE); // $0.50
    const bid2 = createOrder("0xAlice", Side.BUY, 60n * ONE, 100n * ONE); // $0.60
    const bid3 = createOrder("0xAlice", Side.BUY, 55n * ONE, 100n * ONE); // $0.55

    engine.addOrder(bid1);
    engine.addOrder(bid2);
    engine.addOrder(bid3);

    const book = engine.getOrderBook(marketId, tokenId);
    expect(book.bids.length).toBe(3);

    // Should be sorted by price descending
    const prices = book.bids.map((b) => b.order.makerAmount);
    expect(prices[0]).toBe(60n * ONE);
    expect(prices[1]).toBe(55n * ONE);
    expect(prices[2]).toBe(50n * ONE);
  });

  test("should cancel order and unlock balance", () => {
    const order = createOrder("0xAlice", Side.BUY, 50n * ONE, 100n * ONE);
    const { orderId } = engine.addOrder(order);

    const balanceBefore = engine.getBalance("0xAlice", 0n);
    expect(balanceBefore.locked).toBe(50n * ONE);

    const success = engine.cancelOrder(orderId, "0xAlice");
    expect(success).toBe(true);

    const balanceAfter = engine.getBalance("0xAlice", 0n);
    expect(balanceAfter.locked).toBe(0n);
    expect(balanceAfter.available).toBe(1000n * ONE);
  });

  test("should reject order with insufficient balance", () => {
    const order = createOrder("0xAlice", Side.BUY, 2000n * ONE, 100n * ONE);

    expect(() => engine.addOrder(order)).toThrow("Insufficient balance");
  });

  test("should get best bid and ask", () => {
    engine.addOrder(createOrder("0xAlice", Side.BUY, 50n * ONE, 100n * ONE));
    engine.addOrder(createOrder("0xBob", Side.SELL, 40n * ONE, 80n * ONE));

    const bestBid = engine.getBestBid(marketId, tokenId);
    const bestAsk = engine.getBestAsk(marketId, tokenId);

    expect(bestBid).not.toBeNull();
    expect(bestAsk).not.toBeNull();
  });

  // ============ MINT/MERGE Detection Tests ============

  describe("MatchType Detection", () => {
    test("should detect COMPLEMENTARY for BUY vs SELL", () => {
      const buyOrder = createOrder("0xAlice", Side.BUY, 50n * ONE, 100n * ONE);
      const sellOrder = createOrder("0xBob", Side.SELL, 50n * ONE, 100n * ONE);

      const matchType = engine.detectMatchType(buyOrder, sellOrder);
      expect(matchType).toBe(MatchType.COMPLEMENTARY);
    });

    test("should detect MINT for two BUY orders with prices summing >= 1.0", () => {
      // Buy YES at $0.60 (60 collateral for 100 tokens)
      const buyYes = createOrder("0xAlice", Side.BUY, 60n * ONE, 100n * ONE);
      // Buy NO at $0.50 (50 collateral for 100 tokens) - sum = 1.10 >= 1.0
      const buyNo = createOrder("0xBob", Side.BUY, 50n * ONE, 100n * ONE);

      const matchType = engine.detectMatchType(buyYes, buyNo);
      expect(matchType).toBe(MatchType.MINT);
    });

    test("should detect MINT at exact boundary (prices sum = 1.0)", () => {
      // Buy YES at $0.50
      const buyYes = createOrder("0xAlice", Side.BUY, 50n * ONE, 100n * ONE);
      // Buy NO at $0.50 - sum = 1.0
      const buyNo = createOrder("0xBob", Side.BUY, 50n * ONE, 100n * ONE);

      const matchType = engine.detectMatchType(buyYes, buyNo);
      expect(matchType).toBe(MatchType.MINT);
    });

    test("should NOT detect MINT for two BUY orders with prices summing < 1.0", () => {
      // Buy YES at $0.40
      const buyYes = createOrder("0xAlice", Side.BUY, 40n * ONE, 100n * ONE);
      // Buy NO at $0.40 - sum = 0.80 < 1.0
      const buyNo = createOrder("0xBob", Side.BUY, 40n * ONE, 100n * ONE);

      // This should be COMPLEMENTARY since MINT condition not met
      const matchType = engine.detectMatchType(buyYes, buyNo);
      expect(matchType).toBe(MatchType.COMPLEMENTARY);
    });

    test("should detect MERGE for two SELL orders with prices summing <= 1.0", () => {
      // Sell YES at $0.40: selling 100 tokens for 40 collateral
      // price = takerAmount / makerAmount = 40 / 100 = 0.40
      const sellYes = createOrder("0xAlice", Side.SELL, 100n * ONE, 40n * ONE);
      // Sell NO at $0.50: selling 100 tokens for 50 collateral
      // price = 50 / 100 = 0.50, sum = 0.90 <= 1.0
      const sellNo = createOrder("0xBob", Side.SELL, 100n * ONE, 50n * ONE);

      const matchType = engine.detectMatchType(sellYes, sellNo);
      expect(matchType).toBe(MatchType.MERGE);
    });

    test("should detect MERGE at exact boundary (prices sum = 1.0)", () => {
      // Sell YES at $0.50: selling 100 tokens for 50 collateral
      const sellYes = createOrder("0xAlice", Side.SELL, 100n * ONE, 50n * ONE);
      // Sell NO at $0.50: selling 100 tokens for 50 collateral - sum = 1.0
      const sellNo = createOrder("0xBob", Side.SELL, 100n * ONE, 50n * ONE);

      const matchType = engine.detectMatchType(sellYes, sellNo);
      expect(matchType).toBe(MatchType.MERGE);
    });

    test("should NOT detect MERGE for two SELL orders with prices summing > 1.0", () => {
      // Sell YES at $0.60: selling 100 tokens for 60 collateral
      const sellYes = createOrder("0xAlice", Side.SELL, 100n * ONE, 60n * ONE);
      // Sell NO at $0.60: selling 100 tokens for 60 collateral - sum = 1.20 > 1.0
      const sellNo = createOrder("0xBob", Side.SELL, 100n * ONE, 60n * ONE);

      // This should be COMPLEMENTARY since MERGE condition not met
      const matchType = engine.detectMatchType(sellYes, sellNo);
      expect(matchType).toBe(MatchType.COMPLEMENTARY);
    });
  });

  describe("canMint helper", () => {
    test("should return true for valid MINT condition", () => {
      const buyYes = createOrder("0xAlice", Side.BUY, 60n * ONE, 100n * ONE);
      const buyNo = createOrder("0xBob", Side.BUY, 50n * ONE, 100n * ONE);

      expect(engine.canMint(buyYes, buyNo)).toBe(true);
    });

    test("should return false for non-BUY orders", () => {
      const buyOrder = createOrder("0xAlice", Side.BUY, 60n * ONE, 100n * ONE);
      const sellOrder = createOrder("0xBob", Side.SELL, 100n * ONE, 50n * ONE);

      expect(engine.canMint(buyOrder, sellOrder)).toBe(false);
    });

    test("should return false when prices sum < 1.0", () => {
      const buyYes = createOrder("0xAlice", Side.BUY, 30n * ONE, 100n * ONE);
      const buyNo = createOrder("0xBob", Side.BUY, 30n * ONE, 100n * ONE);

      expect(engine.canMint(buyYes, buyNo)).toBe(false);
    });
  });

  describe("canMerge helper", () => {
    test("should return true for valid MERGE condition", () => {
      // Sell YES at $0.40: selling 100 tokens for 40 collateral
      const sellYes = createOrder("0xAlice", Side.SELL, 100n * ONE, 40n * ONE);
      // Sell NO at $0.50: selling 100 tokens for 50 collateral - sum = 0.90 <= 1.0
      const sellNo = createOrder("0xBob", Side.SELL, 100n * ONE, 50n * ONE);

      expect(engine.canMerge(sellYes, sellNo)).toBe(true);
    });

    test("should return false for non-SELL orders", () => {
      const buyOrder = createOrder("0xAlice", Side.BUY, 40n * ONE, 100n * ONE);
      const sellOrder = createOrder("0xBob", Side.SELL, 100n * ONE, 50n * ONE);

      expect(engine.canMerge(buyOrder, sellOrder)).toBe(false);
    });

    test("should return false when prices sum > 1.0", () => {
      // Sell YES at $0.60: selling 100 tokens for 60 collateral
      const sellYes = createOrder("0xAlice", Side.SELL, 100n * ONE, 60n * ONE);
      // Sell NO at $0.60: selling 100 tokens for 60 collateral - sum = 1.20 > 1.0
      const sellNo = createOrder("0xBob", Side.SELL, 100n * ONE, 60n * ONE);

      expect(engine.canMerge(sellYes, sellNo)).toBe(false);
    });
  });
});
