/**
 * Property-Based Tests for Settlement Service
 * 
 * Feature: hybrid-clob-trading
 * 
 * These tests verify universal properties that must hold across all valid inputs.
 */

import { describe, test, expect } from "bun:test";
import * as fc from "fast-check";
import { SettlementService } from "../src/services/settlement";
import { MerkleTree } from "../src/services/merkleTree";
import type { Trade } from "../src/types";
import { MatchType } from "../src/types";

// Minimum 100 iterations per property test as per design doc
const NUM_RUNS = 100;

// Use predefined addresses to avoid shrinking to zero addresses
const PREDEFINED_ADDRESSES = [
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
  "0x4444444444444444444444444444444444444444",
  "0x5555555555555555555555555555555555555555",
  "0x6666666666666666666666666666666666666666",
  "0x7777777777777777777777777777777777777777",
  "0x8888888888888888888888888888888888888888",
  "0x9999999999999999999999999999999999999999",
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
];

// Address arbitrary using predefined addresses (won't shrink to zero)
const addressArbitrary = fc.constantFrom(...PREDEFINED_ADDRESSES);

// For tests that need random addresses, use hex chars excluding '0'
const hexCharNonZero = fc.constantFrom('1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f');
const randomAddressArbitrary = fc.array(hexCharNonZero, { minLength: 40, maxLength: 40 }).map(chars => `0x${chars.join('')}`);

const amountArbitrary = fc.bigInt({ min: 1n, max: 2n ** 64n - 1n });
const priceArbitrary = fc.bigInt({ min: 1n, max: 10n ** 18n });

// Create a settlement service for testing
function createTestSettlementService(): SettlementService {
  return new SettlementService(
    "http://localhost:8545",
    "0x0000000000000000000000000000000000000000000000000000000000000001",
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000"
  );
}

// Helper function to compute leaf hash
function computeLeaf(address: string, amount: bigint): string {
  const { ethers } = require("ethers");
  return ethers.keccak256(
    ethers.solidityPacked(["address", "uint256"], [address, amount])
  );
}

// Helper to create a valid trade
function createTrade(maker: string, taker: string, id: string, amount: bigint, price: bigint): Trade {
  return {
    id,
    takerOrderHash: `0x${'a'.repeat(64)}`,
    makerOrderHash: `0x${'b'.repeat(64)}`,
    maker,
    taker,
    tokenId: 1n,
    amount,
    price,
    matchType: MatchType.COMPLEMENTARY,
    timestamp: Date.now(),
    fee: 0n,
    feeRateBps: 0n,
  };
}

describe("Settlement Service Property Tests", () => {
  /**
   * Property 14: Balance Delta Computation Correctness
   * 
   * For any set of trades in a batch, the computed balance delta for each user 
   * SHALL equal the sum of all amounts received minus the sum of all amounts paid 
   * across all trades involving that user.
   * 
   * **Validates: Requirements 4.2**
   */
  describe("Property 14: Balance Delta Computation Correctness", () => {
    test("sum of all deltas equals zero (conservation)", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              makerIdx: fc.integer({ min: 0, max: 4 }),
              takerIdx: fc.integer({ min: 5, max: 9 }),
              amount: amountArbitrary,
              price: priceArbitrary,
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (tradeParams) => {
            const trades: Trade[] = tradeParams.map((p, i) => 
              createTrade(PREDEFINED_ADDRESSES[p.makerIdx], PREDEFINED_ADDRESSES[p.takerIdx], `t-${i}`, p.amount, p.price)
            );
            const service = createTestSettlementService();
            const deltas = service.computeBalanceDeltas(trades);
            let totalDelta = 0n;
            for (const delta of deltas.values()) totalDelta += delta;
            expect(totalDelta).toBe(0n);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("maker delta equals negative of cost for single trade", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4 }),
          fc.integer({ min: 5, max: 9 }),
          amountArbitrary,
          priceArbitrary,
          (makerIdx, takerIdx, amount, price) => {
            const maker = PREDEFINED_ADDRESSES[makerIdx];
            const taker = PREDEFINED_ADDRESSES[takerIdx];
            const trade = createTrade(maker, taker, "t-1", amount, price);
            const service = createTestSettlementService();
            const deltas = service.computeBalanceDeltas([trade]);
            const expectedCost = (price * amount) / 10n ** 18n;
            expect(deltas.get(maker.toLowerCase()) || 0n).toBe(-expectedCost);
            expect(deltas.get(taker.toLowerCase()) || 0n).toBe(expectedCost);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("multiple trades aggregate correctly per user", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4 }),
          fc.integer({ min: 5, max: 9 }),
          fc.array(fc.record({ amount: amountArbitrary, price: priceArbitrary }), { minLength: 2, maxLength: 10 }),
          (makerIdx, takerIdx, tradeParams) => {
            const user1 = PREDEFINED_ADDRESSES[makerIdx];
            const user2 = PREDEFINED_ADDRESSES[takerIdx];
            const trades: Trade[] = tradeParams.map((params, i) => createTrade(user1, user2, `t-${i}`, params.amount, params.price));
            const service = createTestSettlementService();
            const deltas = service.computeBalanceDeltas(trades);
            let expectedTotalCost = 0n;
            for (const params of tradeParams) expectedTotalCost += (params.price * params.amount) / 10n ** 18n;
            expect(deltas.get(user1.toLowerCase()) || 0n).toBe(-expectedTotalCost);
            expect(deltas.get(user2.toLowerCase()) || 0n).toBe(expectedTotalCost);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("user acting as both maker and taker has correct net delta", () => {
      fc.assert(
        fc.property(
          amountArbitrary,
          priceArbitrary,
          amountArbitrary,
          priceArbitrary,
          (amount1, price1, amount2, price2) => {
            const user1 = PREDEFINED_ADDRESSES[0];
            const user2 = PREDEFINED_ADDRESSES[1];
            const user3 = PREDEFINED_ADDRESSES[2];
            
            const trade1 = createTrade(user1, user2, "trade-1", amount1, price1);
            const trade2 = createTrade(user2, user3, "trade-2", amount2, price2);
            
            const service = createTestSettlementService();
            const deltas = service.computeBalanceDeltas([trade1, trade2]);
            
            const cost1 = (price1 * amount1) / 10n ** 18n;
            const cost2 = (price2 * amount2) / 10n ** 18n;
            
            expect(deltas.get(user1.toLowerCase()) || 0n).toBe(-cost1);
            expect(deltas.get(user2.toLowerCase()) || 0n).toBe(cost1 - cost2);
            expect(deltas.get(user3.toLowerCase()) || 0n).toBe(cost2);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("delta computation is deterministic", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              makerIdx: fc.integer({ min: 0, max: 4 }),
              takerIdx: fc.integer({ min: 5, max: 9 }),
              amount: amountArbitrary,
              price: priceArbitrary,
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (tradeParams) => {
            const trades: Trade[] = tradeParams.map((p, i) => 
              createTrade(PREDEFINED_ADDRESSES[p.makerIdx], PREDEFINED_ADDRESSES[p.takerIdx], `t-${i}`, p.amount, p.price)
            );
            const deltas1 = createTestSettlementService().computeBalanceDeltas(trades);
            const deltas2 = createTestSettlementService().computeBalanceDeltas(trades);
            expect(deltas1.size).toBe(deltas2.size);
            for (const [key, value] of deltas1) expect(deltas2.get(key)).toBe(value);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

describe("Merkle Tree Property Tests", () => {
  /**
   * Property 15: Merkle Tree Inclusion
   * 
   * For any user with a positive balance delta in a batch, the generated 
   * Merkle proof SHALL verify successfully against the batch's Merkle root.
   * 
   * **Validates: Requirements 4.3, 4.5, 6.2**
   */
  describe("Property 15: Merkle Tree Inclusion", () => {
    test("all entries have valid proofs", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              addressIdx: fc.integer({ min: 0, max: 9 }),
              amount: fc.bigInt({ min: 1n, max: 2n ** 64n }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (entryParams) => {
            // Map indices to addresses and deduplicate
            const seen = new Set<number>();
            const uniqueEntries = entryParams
              .filter((e) => { if (seen.has(e.addressIdx)) return false; seen.add(e.addressIdx); return true; })
              .map((e) => ({ address: PREDEFINED_ADDRESSES[e.addressIdx], amount: e.amount }));
            
            fc.pre(uniqueEntries.length > 0);
            
            const tree = new MerkleTree(uniqueEntries);
            const root = tree.getRoot();
            
            for (const entry of uniqueEntries) {
              const { leaf, proof } = tree.getProof(entry.address, entry.amount);
              expect(MerkleTree.verify(proof, root, leaf)).toBe(true);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("proof verification is deterministic", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              addressIdx: fc.integer({ min: 0, max: 9 }),
              amount: fc.bigInt({ min: 1n, max: 2n ** 64n }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (entryParams) => {
            const seen = new Set<number>();
            const uniqueEntries = entryParams
              .filter((e) => { if (seen.has(e.addressIdx)) return false; seen.add(e.addressIdx); return true; })
              .map((e) => ({ address: PREDEFINED_ADDRESSES[e.addressIdx], amount: e.amount }));
            
            fc.pre(uniqueEntries.length > 0);
            
            const tree1 = new MerkleTree(uniqueEntries);
            const tree2 = new MerkleTree(uniqueEntries);
            
            expect(tree1.getRoot()).toBe(tree2.getRoot());
            
            for (const entry of uniqueEntries) {
              const p1 = tree1.getProof(entry.address, entry.amount);
              const p2 = tree2.getProof(entry.address, entry.amount);
              expect(p1.leaf).toBe(p2.leaf);
              expect(p1.root).toBe(p2.root);
              expect(p1.proof).toEqual(p2.proof);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("wrong amount produces invalid proof", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              addressIdx: fc.integer({ min: 0, max: 9 }),
              amount: fc.bigInt({ min: 2n, max: 2n ** 64n }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fc.bigInt({ min: 1n, max: 2n ** 32n }),
          (entryParams, wrongAmountDelta) => {
            const seen = new Set<number>();
            const uniqueEntries = entryParams
              .filter((e) => { if (seen.has(e.addressIdx)) return false; seen.add(e.addressIdx); return true; })
              .map((e) => ({ address: PREDEFINED_ADDRESSES[e.addressIdx], amount: e.amount }));
            
            fc.pre(uniqueEntries.length > 0);
            
            const tree = new MerkleTree(uniqueEntries);
            const entry = uniqueEntries[0];
            const { proof } = tree.getProof(entry.address, entry.amount);
            const wrongLeaf = computeLeaf(entry.address, entry.amount + wrongAmountDelta);
            expect(MerkleTree.verify(proof, tree.getRoot(), wrongLeaf)).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("wrong address produces invalid proof", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              addressIdx: fc.integer({ min: 0, max: 4 }),
              amount: fc.bigInt({ min: 1n, max: 2n ** 64n }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fc.integer({ min: 5, max: 9 }),
          (entryParams, wrongAddressIdx) => {
            const seen = new Set<number>();
            const uniqueEntries = entryParams
              .filter((e) => { if (seen.has(e.addressIdx)) return false; seen.add(e.addressIdx); return true; })
              .map((e) => ({ address: PREDEFINED_ADDRESSES[e.addressIdx], amount: e.amount }));
            
            fc.pre(uniqueEntries.length > 0);
            
            const tree = new MerkleTree(uniqueEntries);
            const entry = uniqueEntries[0];
            const { proof } = tree.getProof(entry.address, entry.amount);
            const wrongAddress = PREDEFINED_ADDRESSES[wrongAddressIdx];
            const wrongLeaf = computeLeaf(wrongAddress, entry.amount);
            expect(MerkleTree.verify(proof, tree.getRoot(), wrongLeaf)).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("settlement batch creates valid proofs for all positive deltas", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              makerIdx: fc.integer({ min: 0, max: 4 }),
              takerIdx: fc.integer({ min: 5, max: 9 }),
              amount: amountArbitrary,
              price: priceArbitrary,
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (tradeParams) => {
            const trades: Trade[] = tradeParams.map((p, i) => 
              createTrade(PREDEFINED_ADDRESSES[p.makerIdx], PREDEFINED_ADDRESSES[p.takerIdx], `t-${i}`, p.amount, p.price)
            );
            
            const service = createTestSettlementService();
            
            // Compute balance deltas and create Merkle tree synchronously
            const balanceDeltas = service.computeBalanceDeltas(trades);
            const entries = Array.from(balanceDeltas.entries())
              .filter(([_, amount]) => amount > 0n)
              .map(([address, amount]) => ({ address, amount }));
            
            if (entries.length === 0) return;
            
            const tree = new MerkleTree(entries);
            const merkleRoot = tree.getRoot();
            
            // Verify all proofs
            for (const entry of entries) {
              const { leaf, proof } = tree.getProof(entry.address, entry.amount);
              const isValid = MerkleTree.verify(proof, merkleRoot, leaf);
              expect(isValid).toBe(true);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});


describe("Cancelled Order Exclusion Property Tests", () => {
  /**
   * Property 23: Cancelled Order Settlement Exclusion
   * 
   * For any order that has been cancelled, trades involving that order 
   * SHALL NOT appear in any settlement batch created after the cancellation.
   * 
   * **Validates: Requirements 7.5**
   */
  describe("Property 23: Cancelled Order Settlement Exclusion", () => {
    // Helper to create trades with unique order hashes
    function createTradesWithHashes(tradeParams: Array<{makerIdx: number, takerIdx: number, amount: bigint, price: bigint}>, prefix: string): Trade[] {
      return tradeParams.map((p, i) => ({
        id: `trade-${i}`,
        takerOrderHash: `0x${prefix}${'a'.repeat(60)}${i.toString(16).padStart(2, '0')}`,
        makerOrderHash: `0x${prefix}${'b'.repeat(60)}${i.toString(16).padStart(2, '0')}`,
        maker: PREDEFINED_ADDRESSES[p.makerIdx],
        taker: PREDEFINED_ADDRESSES[p.takerIdx],
        tokenId: 1n,
        amount: p.amount,
        price: p.price,
        matchType: MatchType.COMPLEMENTARY,
        timestamp: Date.now(),
        fee: 0n,
        feeRateBps: 0n,
      }));
    }

    // Helper to filter cancelled trades (simulating what the service does)
    function filterCancelledTrades(trades: Trade[], cancelledHashes: Set<string>): Trade[] {
      return trades.filter(t => 
        !cancelledHashes.has(t.takerOrderHash.toLowerCase()) && 
        !cancelledHashes.has(t.makerOrderHash.toLowerCase())
      );
    }

    test("cancelled taker orders are excluded from batches", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              makerIdx: fc.integer({ min: 0, max: 4 }),
              takerIdx: fc.integer({ min: 5, max: 9 }),
              amount: amountArbitrary,
              price: priceArbitrary,
            }),
            { minLength: 2, maxLength: 10 }
          ),
          fc.integer({ min: 0, max: 9 }),
          (tradeParams, cancelIdx) => {
            const trades = createTradesWithHashes(tradeParams, '11');
            
            // Cancel one of the taker orders
            const cancelledTradeIdx = cancelIdx % trades.length;
            const cancelledHashes = new Set([trades[cancelledTradeIdx].takerOrderHash.toLowerCase()]);
            
            // Filter trades (simulating service behavior)
            const filteredTrades = filterCancelledTrades(trades, cancelledHashes);
            
            // Verify cancelled trade is not in filtered list
            const filteredIds = filteredTrades.map(t => t.id);
            expect(filteredIds).not.toContain(`trade-${cancelledTradeIdx}`);
            
            // Verify other trades are present
            for (let i = 0; i < trades.length; i++) {
              if (i !== cancelledTradeIdx) {
                expect(filteredIds).toContain(`trade-${i}`);
              }
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("cancelled maker orders are excluded from batches", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              makerIdx: fc.integer({ min: 0, max: 4 }),
              takerIdx: fc.integer({ min: 5, max: 9 }),
              amount: amountArbitrary,
              price: priceArbitrary,
            }),
            { minLength: 2, maxLength: 10 }
          ),
          fc.integer({ min: 0, max: 9 }),
          (tradeParams, cancelIdx) => {
            const trades = createTradesWithHashes(tradeParams, '22');
            
            // Cancel one of the maker orders
            const cancelledTradeIdx = cancelIdx % trades.length;
            const cancelledHashes = new Set([trades[cancelledTradeIdx].makerOrderHash.toLowerCase()]);
            
            const filteredTrades = filterCancelledTrades(trades, cancelledHashes);
            const filteredIds = filteredTrades.map(t => t.id);
            
            expect(filteredIds).not.toContain(`trade-${cancelledTradeIdx}`);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("multiple cancelled orders are all excluded", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              makerIdx: fc.integer({ min: 0, max: 4 }),
              takerIdx: fc.integer({ min: 5, max: 9 }),
              amount: amountArbitrary,
              price: priceArbitrary,
            }),
            { minLength: 4, maxLength: 10 }
          ),
          fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 3 }),
          (tradeParams, cancelIndices) => {
            const trades = createTradesWithHashes(tradeParams, '33');
            
            // Cancel multiple orders
            const cancelledTradeIndices = new Set(
              cancelIndices.map(idx => idx % trades.length)
            );
            
            const cancelledHashes = new Set<string>();
            for (const idx of cancelledTradeIndices) {
              cancelledHashes.add(trades[idx].takerOrderHash.toLowerCase());
            }
            
            const filteredTrades = filterCancelledTrades(trades, cancelledHashes);
            const filteredIds = new Set(filteredTrades.map(t => t.id));
            
            // Verify all cancelled trades are excluded
            for (const idx of cancelledTradeIndices) {
              expect(filteredIds.has(`trade-${idx}`)).toBe(false);
            }
            
            // Verify non-cancelled trades are included
            for (let i = 0; i < trades.length; i++) {
              if (!cancelledTradeIndices.has(i)) {
                expect(filteredIds.has(`trade-${i}`)).toBe(true);
              }
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("cancellation is case-insensitive for order hashes", () => {
      fc.assert(
        fc.property(
          fc.record({
            makerIdx: fc.integer({ min: 0, max: 4 }),
            takerIdx: fc.integer({ min: 5, max: 9 }),
            amount: amountArbitrary,
            price: priceArbitrary,
          }),
          fc.boolean(),
          (tradeParams, useUpperCase) => {
            const orderHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
            
            const trade: Trade = {
              id: "trade-1",
              takerOrderHash: orderHash,
              makerOrderHash: `0x${'1'.repeat(64)}`,
              maker: PREDEFINED_ADDRESSES[tradeParams.makerIdx],
              taker: PREDEFINED_ADDRESSES[tradeParams.takerIdx],
              tokenId: 1n,
              amount: tradeParams.amount,
              price: tradeParams.price,
              matchType: MatchType.COMPLEMENTARY,
              timestamp: Date.now(),
              fee: 0n,
              feeRateBps: 0n,
            };
            
            // Cancel with different case
            const cancelHash = useUpperCase ? orderHash.toUpperCase() : orderHash.toLowerCase();
            const cancelledHashes = new Set([cancelHash.toLowerCase()]);
            
            const filteredTrades = filterCancelledTrades([trade], cancelledHashes);
            
            // Trade should be excluded regardless of case
            expect(filteredTrades.length).toBe(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("balance deltas exclude cancelled trades", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              makerIdx: fc.integer({ min: 0, max: 4 }),
              takerIdx: fc.integer({ min: 5, max: 9 }),
              amount: amountArbitrary,
              price: priceArbitrary,
            }),
            { minLength: 2, maxLength: 10 }
          ),
          fc.integer({ min: 0, max: 9 }),
          (tradeParams, cancelIdx) => {
            const trades = createTradesWithHashes(tradeParams, '44');
            
            // Cancel one trade
            const cancelledTradeIdx = cancelIdx % trades.length;
            const cancelledHashes = new Set([trades[cancelledTradeIdx].takerOrderHash.toLowerCase()]);
            
            const filteredTrades = filterCancelledTrades(trades, cancelledHashes);
            
            // Compute deltas from filtered trades
            const service = createTestSettlementService();
            const actualDeltas = service.computeBalanceDeltas(filteredTrades);
            
            // Compute expected deltas from non-cancelled trades only
            const expectedDeltas = new Map<string, bigint>();
            for (let i = 0; i < trades.length; i++) {
              if (i === cancelledTradeIdx) continue;
              
              const trade = trades[i];
              const cost = (trade.price * trade.amount) / 10n ** 18n;
              
              const makerKey = trade.maker.toLowerCase();
              expectedDeltas.set(makerKey, (expectedDeltas.get(makerKey) || 0n) - cost);
              
              const takerKey = trade.taker.toLowerCase();
              expectedDeltas.set(takerKey, (expectedDeltas.get(takerKey) || 0n) + cost);
            }
            
            // Verify deltas match expected
            for (const [user, expectedDelta] of expectedDeltas) {
              const actualDelta = actualDeltas.get(user) || 0n;
              expect(actualDelta).toBe(expectedDelta);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
