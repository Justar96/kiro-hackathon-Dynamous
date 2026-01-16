/**
 * Property-Based Tests for Matching Engine
 * 
 * Feature: hybrid-clob-trading
 * 
 * These tests verify universal properties that must hold across all valid inputs.
 */

import { describe, test, expect } from "bun:test";
import * as fc from "fast-check";
import { MatchingEngine } from "../src/services/matchingEngine";
import { Side, SignatureType, MatchType, type SignedOrder } from "../src/types";

// Minimum 100 iterations per property test as per design doc
const NUM_RUNS = 100;

// Constants
const ONE = 10n ** 18n;

// Arbitraries for generating test data
const hexChar = fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f');
const addressArbitrary = fc.array(hexChar, { minLength: 40, maxLength: 40 }).map(chars => `0x${chars.join('')}`);
const marketIdArbitrary = fc.array(hexChar, { minLength: 64, maxLength: 64 }).map(chars => `0x${chars.join('')}`);
const tokenIdArbitrary = fc.bigInt({ min: 1n, max: 2n ** 64n - 1n });
const saltArbitrary = fc.bigInt({ min: 1n, max: 2n ** 128n - 1n });

// Price in basis points (100-9900 to avoid edge cases with very small prices)
const priceArbitrary = fc.integer({ min: 100, max: 9900 });

// Amount arbitrary (positive amounts, using a fixed reasonable range)
// Using integer-based generation to avoid bigint generation issues
const amountArbitrary = fc.integer({ min: 100, max: 1000 }).map(n => BigInt(n) * ONE);

/**
 * Create a signed order for testing
 */
function createOrder(
  maker: string,
  marketId: string,
  tokenId: bigint,
  side: Side,
  price: number, // in basis points (0-10000)
  amount: bigint,
  salt: bigint
): SignedOrder {
  // For BUY: makerAmount = collateral, takerAmount = tokens
  // price = makerAmount / takerAmount
  // So makerAmount = price * takerAmount / 10000
  
  // For SELL: makerAmount = tokens, takerAmount = collateral
  // price = takerAmount / makerAmount
  // So takerAmount = price * makerAmount / 10000
  
  let makerAmount: bigint;
  let takerAmount: bigint;
  
  if (side === Side.BUY) {
    // Buying `amount` tokens at `price` basis points
    takerAmount = amount; // tokens to receive
    makerAmount = (BigInt(price) * amount) / 10000n; // collateral to pay
  } else {
    // Selling `amount` tokens at `price` basis points
    makerAmount = amount; // tokens to sell
    takerAmount = (BigInt(price) * amount) / 10000n; // collateral to receive
  }
  
  return {
    salt,
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

describe("Matching Engine Property Tests", () => {
  /**
   * Property 9: MINT Match Type Detection
   * 
   * For any two buy orders where the sum of their prices >= 1.0 (in normalized units),
   * the Matching_Engine SHALL flag the resulting trade with matchType = MINT.
   * 
   * **Validates: Requirements 3.4**
   */
  describe("Property 9: MINT Match Type Detection", () => {
    test("two BUY orders with prices summing >= 1.0 should be detected as MINT", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          addressArbitrary,
          marketIdArbitrary,
          tokenIdArbitrary,
          // Generate first price between 100 and 9900 basis points
          fc.integer({ min: 100, max: 9900 }),
          amountArbitrary,
          saltArbitrary,
          saltArbitrary,
          (maker1, maker2, marketId, tokenId, price1, amount, salt1, salt2) => {
            // Set price2 so that sum >= 10000 (at least 1.0)
            // price2 = 10000 - price1 + some extra (0 to 1000)
            const price2 = Math.max(100, 10000 - price1 + Math.floor(Math.random() * 1000));
            fc.pre(price1 + price2 >= 10000);
            fc.pre(price2 <= 10000); // Cap at 100%
            
            const engine = new MatchingEngine();
            
            const buyOrder1 = createOrder(maker1, marketId, tokenId, Side.BUY, price1, amount, salt1);
            const buyOrder2 = createOrder(maker2, marketId, tokenId, Side.BUY, price2, amount, salt2);
            
            // Verify orders have non-zero amounts
            fc.pre(buyOrder1.makerAmount > 0n && buyOrder1.takerAmount > 0n);
            fc.pre(buyOrder2.makerAmount > 0n && buyOrder2.takerAmount > 0n);
            
            // Verify MINT detection
            const matchType = engine.detectMatchType(buyOrder1, buyOrder2);
            expect(matchType).toBe(MatchType.MINT);
            
            // Also verify canMint helper
            expect(engine.canMint(buyOrder1, buyOrder2)).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("two BUY orders with prices summing < 1.0 should NOT be detected as MINT", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          addressArbitrary,
          marketIdArbitrary,
          tokenIdArbitrary,
          // Generate two prices that sum to < 10000 basis points (1.0)
          fc.integer({ min: 100, max: 4900 }),
          fc.integer({ min: 100, max: 4900 }),
          amountArbitrary,
          saltArbitrary,
          saltArbitrary,
          (maker1, maker2, marketId, tokenId, price1, price2, amount, salt1, salt2) => {
            // Ensure prices sum < 10000 (1.0)
            fc.pre(price1 + price2 < 10000);
            
            const engine = new MatchingEngine();
            
            const buyOrder1 = createOrder(maker1, marketId, tokenId, Side.BUY, price1, amount, salt1);
            const buyOrder2 = createOrder(maker2, marketId, tokenId, Side.BUY, price2, amount, salt2);
            
            // Verify orders have non-zero amounts
            fc.pre(buyOrder1.makerAmount > 0n && buyOrder1.takerAmount > 0n);
            fc.pre(buyOrder2.makerAmount > 0n && buyOrder2.takerAmount > 0n);
            
            // Should NOT be MINT
            const matchType = engine.detectMatchType(buyOrder1, buyOrder2);
            expect(matchType).not.toBe(MatchType.MINT);
            
            // canMint should return false
            expect(engine.canMint(buyOrder1, buyOrder2)).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("MINT detection is symmetric (order of arguments doesn't matter)", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          addressArbitrary,
          marketIdArbitrary,
          tokenIdArbitrary,
          fc.integer({ min: 5000, max: 9000 }),
          fc.integer({ min: 5000, max: 9000 }),
          amountArbitrary,
          saltArbitrary,
          saltArbitrary,
          (maker1, maker2, marketId, tokenId, price1, price2, amount, salt1, salt2) => {
            const engine = new MatchingEngine();
            
            const buyOrder1 = createOrder(maker1, marketId, tokenId, Side.BUY, price1, amount, salt1);
            const buyOrder2 = createOrder(maker2, marketId, tokenId, Side.BUY, price2, amount, salt2);
            
            // Verify orders have non-zero amounts
            fc.pre(buyOrder1.makerAmount > 0n && buyOrder1.takerAmount > 0n);
            fc.pre(buyOrder2.makerAmount > 0n && buyOrder2.takerAmount > 0n);
            
            // Detection should be symmetric
            const matchType1 = engine.detectMatchType(buyOrder1, buyOrder2);
            const matchType2 = engine.detectMatchType(buyOrder2, buyOrder1);
            
            expect(matchType1).toBe(matchType2);
            
            // canMint should also be symmetric
            expect(engine.canMint(buyOrder1, buyOrder2)).toBe(engine.canMint(buyOrder2, buyOrder1));
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("MINT at exact boundary (prices sum = 1.0) should be detected", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          addressArbitrary,
          marketIdArbitrary,
          tokenIdArbitrary,
          fc.integer({ min: 100, max: 9900 }),
          amountArbitrary,
          saltArbitrary,
          saltArbitrary,
          (maker1, maker2, marketId, tokenId, price1, amount, salt1, salt2) => {
            // Set price2 so that sum is exactly 10000
            const price2 = 10000 - price1;
            fc.pre(price2 >= 100); // Ensure price2 is valid
            
            const engine = new MatchingEngine();
            
            const buyOrder1 = createOrder(maker1, marketId, tokenId, Side.BUY, price1, amount, salt1);
            const buyOrder2 = createOrder(maker2, marketId, tokenId, Side.BUY, price2, amount, salt2);
            
            // Verify orders have non-zero amounts
            fc.pre(buyOrder1.makerAmount > 0n && buyOrder1.takerAmount > 0n);
            fc.pre(buyOrder2.makerAmount > 0n && buyOrder2.takerAmount > 0n);
            
            // Should be MINT at exact boundary
            const matchType = engine.detectMatchType(buyOrder1, buyOrder2);
            expect(matchType).toBe(MatchType.MINT);
            expect(engine.canMint(buyOrder1, buyOrder2)).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});


  /**
   * Property 10: MERGE Match Type Detection
   * 
   * For any two sell orders where the sum of their prices <= 1.0 (in normalized units),
   * the Matching_Engine SHALL flag the resulting trade with matchType = MERGE.
   * 
   * **Validates: Requirements 3.5**
   */
  describe("Property 10: MERGE Match Type Detection", () => {
    test("two SELL orders with prices summing <= 1.0 should be detected as MERGE", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          addressArbitrary,
          marketIdArbitrary,
          tokenIdArbitrary,
          // Generate first price between 100 and 4900 basis points
          fc.integer({ min: 100, max: 4900 }),
          amountArbitrary,
          saltArbitrary,
          saltArbitrary,
          (maker1, maker2, marketId, tokenId, price1, amount, salt1, salt2) => {
            // Set price2 so that sum <= 10000 (at most 1.0)
            // price2 = random value such that price1 + price2 <= 10000
            const maxPrice2 = 10000 - price1;
            const price2 = Math.min(maxPrice2, Math.max(100, Math.floor(Math.random() * maxPrice2)));
            fc.pre(price1 + price2 <= 10000);
            fc.pre(price2 >= 100); // Ensure valid price
            
            const engine = new MatchingEngine();
            
            const sellOrder1 = createOrder(maker1, marketId, tokenId, Side.SELL, price1, amount, salt1);
            const sellOrder2 = createOrder(maker2, marketId, tokenId, Side.SELL, price2, amount, salt2);
            
            // Verify orders have non-zero amounts
            fc.pre(sellOrder1.makerAmount > 0n && sellOrder1.takerAmount > 0n);
            fc.pre(sellOrder2.makerAmount > 0n && sellOrder2.takerAmount > 0n);
            
            // Verify MERGE detection
            const matchType = engine.detectMatchType(sellOrder1, sellOrder2);
            expect(matchType).toBe(MatchType.MERGE);
            
            // Also verify canMerge helper
            expect(engine.canMerge(sellOrder1, sellOrder2)).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("two SELL orders with prices summing > 1.0 should NOT be detected as MERGE", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          addressArbitrary,
          marketIdArbitrary,
          tokenIdArbitrary,
          // Generate two prices that sum to > 10000 basis points (1.0)
          fc.integer({ min: 5100, max: 9900 }),
          fc.integer({ min: 5100, max: 9900 }),
          amountArbitrary,
          saltArbitrary,
          saltArbitrary,
          (maker1, maker2, marketId, tokenId, price1, price2, amount, salt1, salt2) => {
            // Ensure prices sum > 10000 (1.0)
            fc.pre(price1 + price2 > 10000);
            
            const engine = new MatchingEngine();
            
            const sellOrder1 = createOrder(maker1, marketId, tokenId, Side.SELL, price1, amount, salt1);
            const sellOrder2 = createOrder(maker2, marketId, tokenId, Side.SELL, price2, amount, salt2);
            
            // Verify orders have non-zero amounts
            fc.pre(sellOrder1.makerAmount > 0n && sellOrder1.takerAmount > 0n);
            fc.pre(sellOrder2.makerAmount > 0n && sellOrder2.takerAmount > 0n);
            
            // Should NOT be MERGE
            const matchType = engine.detectMatchType(sellOrder1, sellOrder2);
            expect(matchType).not.toBe(MatchType.MERGE);
            
            // canMerge should return false
            expect(engine.canMerge(sellOrder1, sellOrder2)).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("MERGE detection is symmetric (order of arguments doesn't matter)", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          addressArbitrary,
          marketIdArbitrary,
          tokenIdArbitrary,
          fc.integer({ min: 100, max: 4900 }),
          fc.integer({ min: 100, max: 4900 }),
          amountArbitrary,
          saltArbitrary,
          saltArbitrary,
          (maker1, maker2, marketId, tokenId, price1, price2, amount, salt1, salt2) => {
            const engine = new MatchingEngine();
            
            const sellOrder1 = createOrder(maker1, marketId, tokenId, Side.SELL, price1, amount, salt1);
            const sellOrder2 = createOrder(maker2, marketId, tokenId, Side.SELL, price2, amount, salt2);
            
            // Verify orders have non-zero amounts
            fc.pre(sellOrder1.makerAmount > 0n && sellOrder1.takerAmount > 0n);
            fc.pre(sellOrder2.makerAmount > 0n && sellOrder2.takerAmount > 0n);
            
            // Detection should be symmetric
            const matchType1 = engine.detectMatchType(sellOrder1, sellOrder2);
            const matchType2 = engine.detectMatchType(sellOrder2, sellOrder1);
            
            expect(matchType1).toBe(matchType2);
            
            // canMerge should also be symmetric
            expect(engine.canMerge(sellOrder1, sellOrder2)).toBe(engine.canMerge(sellOrder2, sellOrder1));
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("MERGE at exact boundary (prices sum = 1.0) should be detected", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          addressArbitrary,
          marketIdArbitrary,
          tokenIdArbitrary,
          fc.integer({ min: 100, max: 9900 }),
          amountArbitrary,
          saltArbitrary,
          saltArbitrary,
          (maker1, maker2, marketId, tokenId, price1, amount, salt1, salt2) => {
            // Set price2 so that sum is exactly 10000
            const price2 = 10000 - price1;
            fc.pre(price2 >= 100); // Ensure price2 is valid
            
            const engine = new MatchingEngine();
            
            const sellOrder1 = createOrder(maker1, marketId, tokenId, Side.SELL, price1, amount, salt1);
            const sellOrder2 = createOrder(maker2, marketId, tokenId, Side.SELL, price2, amount, salt2);
            
            // Verify orders have non-zero amounts
            fc.pre(sellOrder1.makerAmount > 0n && sellOrder1.takerAmount > 0n);
            fc.pre(sellOrder2.makerAmount > 0n && sellOrder2.takerAmount > 0n);
            
            // Should be MERGE at exact boundary
            const matchType = engine.detectMatchType(sellOrder1, sellOrder2);
            expect(matchType).toBe(MatchType.MERGE);
            expect(engine.canMerge(sellOrder1, sellOrder2)).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });


  /**
   * Property 7: Price-Time Priority Matching
   * 
   * For any order book state and incoming order, the Matching_Engine SHALL match 
   * against resting orders in strict price-time priority: best price first, 
   * then earliest timestamp for equal prices.
   * 
   * **Validates: Requirements 3.1**
   */
  describe("Property 7: Price-Time Priority Matching", () => {
    test("buy orders should match against asks in ascending price order", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          marketIdArbitrary,
          tokenIdArbitrary,
          // Generate 3-5 different ask prices
          fc.array(fc.integer({ min: 100, max: 5000 }), { minLength: 3, maxLength: 5 }),
          amountArbitrary,
          saltArbitrary,
          (buyer, marketId, tokenId, askPrices, amount, salt) => {
            const engine = new MatchingEngine();
            const ledger = engine.getLedger();
            
            // Setup: deposit collateral for buyer
            ledger.credit(buyer, 0n, amount * 100n);
            
            // Create sellers with different prices
            const sellers: string[] = [];
            const sellOrders: SignedOrder[] = [];
            
            for (let i = 0; i < askPrices.length; i++) {
              const seller = `0x${i.toString().padStart(40, '0')}`;
              sellers.push(seller);
              
              // Credit seller with tokens
              ledger.credit(seller, tokenId, amount);
              
              const sellOrder = createOrder(
                seller,
                marketId,
                tokenId,
                Side.SELL,
                askPrices[i],
                amount,
                BigInt(i + 1)
              );
              sellOrders.push(sellOrder);
              
              // Add sell order to book
              engine.addOrder(sellOrder);
            }
            
            // Create a buy order at a high price that should match all asks
            const buyOrder = createOrder(
              buyer,
              marketId,
              tokenId,
              Side.BUY,
              9900, // High price to match all asks
              amount * BigInt(askPrices.length),
              salt
            );
            
            const { trades } = engine.addOrder(buyOrder);
            
            // Verify trades are executed in ascending price order (best ask first)
            if (trades.length > 1) {
              for (let i = 1; i < trades.length; i++) {
                // Each subsequent trade should be at same or higher price
                expect(trades[i].price >= trades[i - 1].price).toBe(true);
              }
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("sell orders should match against bids in descending price order", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          marketIdArbitrary,
          tokenIdArbitrary,
          // Generate 3-5 different bid prices
          fc.array(fc.integer({ min: 5000, max: 9900 }), { minLength: 3, maxLength: 5 }),
          amountArbitrary,
          saltArbitrary,
          (seller, marketId, tokenId, bidPrices, amount, salt) => {
            const engine = new MatchingEngine();
            const ledger = engine.getLedger();
            
            // Setup: deposit tokens for seller
            ledger.credit(seller, tokenId, amount * BigInt(bidPrices.length));
            
            // Create buyers with different prices
            const buyers: string[] = [];
            const buyOrders: SignedOrder[] = [];
            
            for (let i = 0; i < bidPrices.length; i++) {
              const buyer = `0x${i.toString().padStart(40, '0')}`;
              buyers.push(buyer);
              
              // Credit buyer with collateral
              ledger.credit(buyer, 0n, amount * 10n);
              
              const buyOrder = createOrder(
                buyer,
                marketId,
                tokenId,
                Side.BUY,
                bidPrices[i],
                amount,
                BigInt(i + 1)
              );
              buyOrders.push(buyOrder);
              
              // Add buy order to book
              engine.addOrder(buyOrder);
            }
            
            // Create a sell order at a low price that should match all bids
            const sellOrder = createOrder(
              seller,
              marketId,
              tokenId,
              Side.SELL,
              100, // Low price to match all bids
              amount * BigInt(bidPrices.length),
              salt
            );
            
            const { trades } = engine.addOrder(sellOrder);
            
            // Verify trades are executed in descending price order (best bid first)
            if (trades.length > 1) {
              for (let i = 1; i < trades.length; i++) {
                // Each subsequent trade should be at same or lower price
                expect(trades[i].price <= trades[i - 1].price).toBe(true);
              }
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("orders at same price should match in time priority (FIFO)", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          marketIdArbitrary,
          tokenIdArbitrary,
          fc.integer({ min: 3000, max: 7000 }),
          amountArbitrary,
          saltArbitrary,
          (taker, marketId, tokenId, price, amount, salt) => {
            const engine = new MatchingEngine();
            const ledger = engine.getLedger();
            
            // Create multiple makers at the same price
            const makers: string[] = [];
            const orderIds: string[] = [];
            
            for (let i = 0; i < 3; i++) {
              const maker = `0x${(i + 1).toString().padStart(40, '0')}`;
              makers.push(maker);
              
              // Credit maker with tokens
              ledger.credit(maker, tokenId, amount);
              
              const sellOrder = createOrder(
                maker,
                marketId,
                tokenId,
                Side.SELL,
                price,
                amount,
                BigInt(i + 1)
              );
              
              const { orderId } = engine.addOrder(sellOrder);
              orderIds.push(orderId);
            }
            
            // Credit taker with collateral
            ledger.credit(taker, 0n, amount * 10n);
            
            // Create a buy order that matches all sells
            const buyOrder = createOrder(
              taker,
              marketId,
              tokenId,
              Side.BUY,
              price + 1000, // Higher price to ensure matching
              amount * 3n,
              salt
            );
            
            const { trades } = engine.addOrder(buyOrder);
            
            // Verify trades are executed in order of submission (FIFO)
            // The maker order hash should correspond to the order of submission
            if (trades.length === 3) {
              // First trade should be with first maker
              expect(trades[0].taker).toBe(makers[0]);
              // Second trade should be with second maker
              expect(trades[1].taker).toBe(makers[1]);
              // Third trade should be with third maker
              expect(trades[2].taker).toBe(makers[2]);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("order book maintains price-time priority after insertions", () => {
      fc.assert(
        fc.property(
          marketIdArbitrary,
          tokenIdArbitrary,
          // Generate random prices and insertion order
          fc.array(
            fc.record({
              price: fc.integer({ min: 100, max: 9900 }),
              side: fc.constantFrom(Side.BUY, Side.SELL),
            }),
            { minLength: 5, maxLength: 10 }
          ),
          amountArbitrary,
          (marketId, tokenId, orders, amount) => {
            const engine = new MatchingEngine();
            const ledger = engine.getLedger();
            
            // Add orders to book
            for (let i = 0; i < orders.length; i++) {
              const maker = `0x${i.toString().padStart(40, '0')}`;
              
              // Credit appropriate balance
              if (orders[i].side === Side.BUY) {
                ledger.credit(maker, 0n, amount * 10n);
              } else {
                ledger.credit(maker, tokenId, amount);
              }
              
              const order = createOrder(
                maker,
                marketId,
                tokenId,
                orders[i].side,
                orders[i].price,
                amount,
                BigInt(i + 1)
              );
              
              try {
                engine.addOrder(order);
              } catch {
                // Some orders may fail due to matching - that's ok
              }
            }
            
            // Verify order book is properly sorted
            const book = engine.getOrderBook(marketId, tokenId, 100);
            
            // Bids should be in descending price order
            for (let i = 1; i < book.bids.length; i++) {
              const prevPrice = engine.calculatePrice(book.bids[i - 1].order);
              const currPrice = engine.calculatePrice(book.bids[i].order);
              
              if (prevPrice === currPrice) {
                // Same price: earlier timestamp should come first
                expect(book.bids[i - 1].timestamp <= book.bids[i].timestamp).toBe(true);
              } else {
                // Different price: higher price should come first
                expect(prevPrice > currPrice).toBe(true);
              }
            }
            
            // Asks should be in ascending price order
            for (let i = 1; i < book.asks.length; i++) {
              const prevPrice = engine.calculatePrice(book.asks[i - 1].order);
              const currPrice = engine.calculatePrice(book.asks[i].order);
              
              if (prevPrice === currPrice) {
                // Same price: earlier timestamp should come first
                expect(book.asks[i - 1].timestamp <= book.asks[i].timestamp).toBe(true);
              } else {
                // Different price: lower price should come first
                expect(prevPrice < currPrice).toBe(true);
              }
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });


  /**
   * Property 8: Trade Execution at Maker Price
   * 
   * For any crossing orders (buy price >= ask price OR sell price <= bid price), 
   * the trade SHALL execute at the maker's (resting order's) price, not the taker's price.
   * 
   * **Validates: Requirements 3.2, 3.3**
   */
  describe("Property 8: Trade Execution at Maker Price", () => {
    test("buy order crossing ask should execute at ask (maker) price", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          addressArbitrary,
          marketIdArbitrary,
          tokenIdArbitrary,
          // Ask price (maker)
          fc.integer({ min: 100, max: 5000 }),
          // Buy price must be >= ask price for crossing
          fc.integer({ min: 0, max: 4900 }),
          amountArbitrary,
          saltArbitrary,
          saltArbitrary,
          (buyer, seller, marketId, tokenId, askPrice, priceSpread, amount, salt1, salt2) => {
            const buyPrice = askPrice + priceSpread; // Ensure buy >= ask
            fc.pre(buyPrice <= 10000); // Cap at 100%
            
            const engine = new MatchingEngine();
            const ledger = engine.getLedger();
            
            // Setup balances
            ledger.credit(seller, tokenId, amount);
            ledger.credit(buyer, 0n, amount * 10n);
            
            // Seller places ask (maker order)
            const sellOrder = createOrder(
              seller,
              marketId,
              tokenId,
              Side.SELL,
              askPrice,
              amount,
              salt1
            );
            engine.addOrder(sellOrder);
            
            // Buyer places crossing buy (taker order)
            const buyOrder = createOrder(
              buyer,
              marketId,
              tokenId,
              Side.BUY,
              buyPrice,
              amount,
              salt2
            );
            
            const { trades } = engine.addOrder(buyOrder);
            
            // Verify trade executed at maker's (ask) price
            if (trades.length > 0) {
              const expectedPrice = engine.calculatePrice(sellOrder);
              expect(trades[0].price).toBe(expectedPrice);
              
              // Trade price should NOT be the taker's (buy) price
              const takerPrice = engine.calculatePrice(buyOrder);
              if (takerPrice !== expectedPrice) {
                expect(trades[0].price).not.toBe(takerPrice);
              }
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("sell order crossing bid should execute at bid (maker) price", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          addressArbitrary,
          marketIdArbitrary,
          tokenIdArbitrary,
          // Bid price (maker)
          fc.integer({ min: 5000, max: 9900 }),
          // Sell price must be <= bid price for crossing
          fc.integer({ min: 0, max: 4900 }),
          amountArbitrary,
          saltArbitrary,
          saltArbitrary,
          (buyer, seller, marketId, tokenId, bidPrice, priceSpread, amount, salt1, salt2) => {
            const sellPrice = bidPrice - priceSpread; // Ensure sell <= bid
            fc.pre(sellPrice >= 100); // Minimum valid price
            
            const engine = new MatchingEngine();
            const ledger = engine.getLedger();
            
            // Setup balances
            ledger.credit(buyer, 0n, amount * 10n);
            ledger.credit(seller, tokenId, amount);
            
            // Buyer places bid (maker order)
            const buyOrder = createOrder(
              buyer,
              marketId,
              tokenId,
              Side.BUY,
              bidPrice,
              amount,
              salt1
            );
            engine.addOrder(buyOrder);
            
            // Seller places crossing sell (taker order)
            const sellOrder = createOrder(
              seller,
              marketId,
              tokenId,
              Side.SELL,
              sellPrice,
              amount,
              salt2
            );
            
            const { trades } = engine.addOrder(sellOrder);
            
            // Verify trade executed at maker's (bid) price
            if (trades.length > 0) {
              const expectedPrice = engine.calculatePrice(buyOrder);
              expect(trades[0].price).toBe(expectedPrice);
              
              // Trade price should NOT be the taker's (sell) price
              const takerPrice = engine.calculatePrice(sellOrder);
              if (takerPrice !== expectedPrice) {
                expect(trades[0].price).not.toBe(takerPrice);
              }
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("multiple crossing orders should each execute at respective maker price", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          marketIdArbitrary,
          tokenIdArbitrary,
          // Generate 3 different ask prices
          fc.array(fc.integer({ min: 100, max: 4000 }), { minLength: 3, maxLength: 3 }),
          amountArbitrary,
          saltArbitrary,
          (buyer, marketId, tokenId, askPrices, amount, salt) => {
            const engine = new MatchingEngine();
            const ledger = engine.getLedger();
            
            // Setup buyer balance
            ledger.credit(buyer, 0n, amount * 100n);
            
            // Create sellers with different prices
            const sellOrders: SignedOrder[] = [];
            
            for (let i = 0; i < askPrices.length; i++) {
              const seller = `0x${(i + 1).toString().padStart(40, '0')}`;
              ledger.credit(seller, tokenId, amount);
              
              const sellOrder = createOrder(
                seller,
                marketId,
                tokenId,
                Side.SELL,
                askPrices[i],
                amount,
                BigInt(i + 1)
              );
              sellOrders.push(sellOrder);
              engine.addOrder(sellOrder);
            }
            
            // Buyer places order at high price to match all
            const buyOrder = createOrder(
              buyer,
              marketId,
              tokenId,
              Side.BUY,
              9900,
              amount * 3n,
              salt
            );
            
            const { trades } = engine.addOrder(buyOrder);
            
            // Each trade should execute at its respective maker's price
            for (const trade of trades) {
              // Find the corresponding sell order
              const matchedSellOrder = sellOrders.find(
                so => so.maker === trade.taker
              );
              
              if (matchedSellOrder) {
                const expectedPrice = engine.calculatePrice(matchedSellOrder);
                expect(trade.price).toBe(expectedPrice);
              }
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("trade price should never exceed taker's limit price", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          addressArbitrary,
          marketIdArbitrary,
          tokenIdArbitrary,
          fc.integer({ min: 100, max: 9900 }),
          fc.integer({ min: 100, max: 9900 }),
          amountArbitrary,
          saltArbitrary,
          saltArbitrary,
          (buyer, seller, marketId, tokenId, askPrice, buyPrice, amount, salt1, salt2) => {
            // Only test crossing orders
            fc.pre(buyPrice >= askPrice);
            
            const engine = new MatchingEngine();
            const ledger = engine.getLedger();
            
            // Setup balances
            ledger.credit(seller, tokenId, amount);
            ledger.credit(buyer, 0n, amount * 10n);
            
            // Seller places ask
            const sellOrder = createOrder(
              seller,
              marketId,
              tokenId,
              Side.SELL,
              askPrice,
              amount,
              salt1
            );
            engine.addOrder(sellOrder);
            
            // Buyer places buy
            const buyOrder = createOrder(
              buyer,
              marketId,
              tokenId,
              Side.BUY,
              buyPrice,
              amount,
              salt2
            );
            
            const { trades } = engine.addOrder(buyOrder);
            
            if (trades.length > 0) {
              const tradePrice = trades[0].price;
              const buyerLimitPrice = engine.calculatePrice(buyOrder);
              const sellerLimitPrice = engine.calculatePrice(sellOrder);
              
              // Trade price should be <= buyer's limit (they're willing to pay up to this)
              expect(tradePrice <= buyerLimitPrice).toBe(true);
              
              // Trade price should be >= seller's limit (they want at least this)
              expect(tradePrice >= sellerLimitPrice).toBe(true);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });


  /**
   * Property 27: Fee Calculation Formula
   * 
   * For any trade with feeRateBps > 0, the calculated fee SHALL equal:
   * feeRateBps × min(price, 1-price) × outcomeTokens / BPS_DIVISOR
   * 
   * **Validates: Requirements 12.1**
   */
  describe("Property 27: Fee Calculation Formula", () => {
    const BPS_DIVISOR = 10000n;

    test("fee equals feeRateBps × min(price, 1-price) × amount / (BPS_DIVISOR × ONE)", () => {
      fc.assert(
        fc.property(
          // Price in normalized units (0.01 to 0.99 in ONE units)
          fc.integer({ min: 100, max: 9900 }).map(p => (BigInt(p) * ONE) / 10000n),
          // Amount of outcome tokens
          amountArbitrary,
          // Fee rate in basis points (0-500 bps = 0-5%)
          fc.integer({ min: 0, max: 500 }).map(n => BigInt(n)),
          (price, amount, feeRateBps) => {
            const engine = new MatchingEngine();
            
            // Calculate expected fee using the formula
            const complementPrice = ONE - price;
            const minPrice = price < complementPrice ? price : complementPrice;
            const expectedFee = (feeRateBps * minPrice * amount) / (BPS_DIVISOR * ONE);
            
            // Calculate actual fee using the engine
            const actualFee = engine.calculateFee(price, amount, feeRateBps);
            
            // Fees should match exactly
            expect(actualFee).toBe(expectedFee);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("fee is zero when feeRateBps is zero", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 9900 }).map(p => (BigInt(p) * ONE) / 10000n),
          amountArbitrary,
          (price, amount) => {
            const engine = new MatchingEngine();
            
            const fee = engine.calculateFee(price, amount, 0n);
            
            expect(fee).toBe(0n);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("fee uses min(price, 1-price) - symmetric around 0.5", () => {
      fc.assert(
        fc.property(
          // Price between 0.01 and 0.49 (below 0.5)
          fc.integer({ min: 100, max: 4900 }).map(p => (BigInt(p) * ONE) / 10000n),
          amountArbitrary,
          fc.integer({ min: 1, max: 500 }).map(n => BigInt(n)),
          (price, amount, feeRateBps) => {
            const engine = new MatchingEngine();
            
            // Calculate fee at price
            const feeAtPrice = engine.calculateFee(price, amount, feeRateBps);
            
            // Calculate fee at complement price (1 - price)
            const complementPrice = ONE - price;
            const feeAtComplement = engine.calculateFee(complementPrice, amount, feeRateBps);
            
            // Fees should be equal due to min(price, 1-price) symmetry
            expect(feeAtPrice).toBe(feeAtComplement);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("fee is maximized at price = 0.5", () => {
      fc.assert(
        fc.property(
          // Price not equal to 0.5 (between 0.01 and 0.49 or 0.51 and 0.99)
          fc.oneof(
            fc.integer({ min: 100, max: 4900 }),
            fc.integer({ min: 5100, max: 9900 })
          ).map(p => (BigInt(p) * ONE) / 10000n),
          amountArbitrary,
          fc.integer({ min: 1, max: 500 }).map(n => BigInt(n)),
          (price, amount, feeRateBps) => {
            const engine = new MatchingEngine();
            
            // Fee at given price
            const feeAtPrice = engine.calculateFee(price, amount, feeRateBps);
            
            // Fee at price = 0.5 (maximum)
            const halfPrice = ONE / 2n;
            const feeAtHalf = engine.calculateFee(halfPrice, amount, feeRateBps);
            
            // Fee at 0.5 should be >= fee at any other price
            expect(feeAtHalf >= feeAtPrice).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("fee scales linearly with amount", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 9900 }).map(p => (BigInt(p) * ONE) / 10000n),
          // Use smaller amounts to avoid overflow
          fc.integer({ min: 100, max: 500 }).map(n => BigInt(n) * ONE),
          fc.integer({ min: 1, max: 500 }).map(n => BigInt(n)),
          fc.integer({ min: 2, max: 10 }),
          (price, baseAmount, feeRateBps, multiplier) => {
            const engine = new MatchingEngine();
            
            const feeBase = engine.calculateFee(price, baseAmount, feeRateBps);
            const feeMultiplied = engine.calculateFee(price, baseAmount * BigInt(multiplier), feeRateBps);
            
            // Due to integer division, we check that the multiplied fee is approximately
            // multiplier times the base fee (within rounding tolerance)
            const expectedMultiplied = feeBase * BigInt(multiplier);
            
            // Allow for small rounding differences
            const diff = feeMultiplied > expectedMultiplied 
              ? feeMultiplied - expectedMultiplied 
              : expectedMultiplied - feeMultiplied;
            
            // Difference should be at most multiplier (due to rounding in each calculation)
            expect(diff <= BigInt(multiplier)).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("fee scales linearly with feeRateBps", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 9900 }).map(p => (BigInt(p) * ONE) / 10000n),
          amountArbitrary,
          fc.integer({ min: 1, max: 100 }).map(n => BigInt(n)),
          fc.integer({ min: 2, max: 5 }),
          (price, amount, baseFeeRate, multiplier) => {
            const engine = new MatchingEngine();
            
            const feeBase = engine.calculateFee(price, amount, baseFeeRate);
            const feeMultiplied = engine.calculateFee(price, amount, baseFeeRate * BigInt(multiplier));
            
            // Due to integer division, we check approximate linearity
            const expectedMultiplied = feeBase * BigInt(multiplier);
            
            // Allow for small rounding differences
            const diff = feeMultiplied > expectedMultiplied 
              ? feeMultiplied - expectedMultiplied 
              : expectedMultiplied - feeMultiplied;
            
            // Difference should be at most multiplier (due to rounding)
            expect(diff <= BigInt(multiplier)).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("trades include correct fee based on order feeRateBps", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          addressArbitrary,
          marketIdArbitrary,
          tokenIdArbitrary,
          fc.integer({ min: 3000, max: 7000 }), // Price in basis points
          amountArbitrary,
          fc.integer({ min: 0, max: 500 }).map(n => BigInt(n)), // Fee rate
          saltArbitrary,
          saltArbitrary,
          (buyer, seller, marketId, tokenId, priceBps, amount, feeRateBps, salt1, salt2) => {
            fc.pre(buyer !== seller);
            
            const engine = new MatchingEngine();
            const ledger = engine.getLedger();
            
            // Setup balances
            ledger.credit(seller, tokenId, amount);
            ledger.credit(buyer, 0n, amount * 10n);
            
            // Create sell order (maker) with fee rate
            const sellOrder: SignedOrder = {
              salt: salt1,
              maker: seller,
              signer: seller,
              taker: "0x0000000000000000000000000000000000000000",
              marketId,
              tokenId,
              side: Side.SELL,
              makerAmount: amount,
              takerAmount: (BigInt(priceBps) * amount) / 10000n,
              expiration: 0n,
              nonce: 0n,
              feeRateBps,
              sigType: SignatureType.EOA,
              signature: "0x",
            };
            engine.addOrder(sellOrder);
            
            // Create buy order (taker) that crosses
            const buyOrder: SignedOrder = {
              salt: salt2,
              maker: buyer,
              signer: buyer,
              taker: "0x0000000000000000000000000000000000000000",
              marketId,
              tokenId,
              side: Side.BUY,
              makerAmount: (BigInt(priceBps + 1000) * amount) / 10000n, // Higher price to ensure crossing
              takerAmount: amount,
              expiration: 0n,
              nonce: 0n,
              feeRateBps,
              sigType: SignatureType.EOA,
              signature: "0x",
            };
            
            const { trades } = engine.addOrder(buyOrder);
            
            if (trades.length > 0) {
              const trade = trades[0];
              
              // Verify fee is included in trade
              expect(trade.feeRateBps).toBe(feeRateBps);
              
              // Verify fee calculation matches formula
              const expectedFee = engine.calculateFee(trade.price, trade.amount, feeRateBps);
              expect(trade.fee).toBe(expectedFee);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
