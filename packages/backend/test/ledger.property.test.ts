/**
 * Property-Based Tests for Ledger Service
 * 
 * Feature: hybrid-clob-trading
 * 
 * These tests verify universal properties that must hold across all valid inputs.
 */

import { describe, test, expect } from "bun:test";
import * as fc from "fast-check";
import { Ledger } from "../src/services/ledger";

// Minimum 100 iterations per property test as per design doc
const NUM_RUNS = 100;

// Arbitraries for generating test data
const hexChar = fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f');
const addressArbitrary = fc.array(hexChar, { minLength: 40, maxLength: 40 }).map(chars => `0x${chars.join('')}`);
const tokenIdArbitrary = fc.bigInt({ min: 0n, max: 2n ** 64n - 1n });
// Use larger minimum amounts to ensure percentage calculations don't round to 0
const amountArbitrary = fc.bigInt({ min: 100n, max: 2n ** 64n - 1n });

describe("Ledger Property Tests", () => {
  /**
   * Property 6: Balance Locking Invariant
   * 
   * For any accepted order, the user's available balance SHALL decrease by makerAmount 
   * and locked balance SHALL increase by makerAmount, such that available + locked 
   * remains constant.
   * 
   * **Validates: Requirements 2.7**
   */
  describe("Property 6: Balance Locking Invariant", () => {
    test("available + locked remains constant after lock/unlock operations", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          tokenIdArbitrary,
          amountArbitrary,
          fc.array(
            fc.record({
              operation: fc.constantFrom("lock", "unlock"),
              // Use smaller amounts to ensure we don't exceed available/locked
              fraction: fc.integer({ min: 1, max: 100 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (user, tokenId, initialAmount, operations) => {
            const ledger = new Ledger();
            
            // Setup: credit initial balance
            ledger.credit(user, tokenId, initialAmount);
            
            // Record initial total
            const initialTotal = ledger.getTotalUserBalance(user, tokenId);
            
            // Apply operations
            for (const op of operations) {
              const balance = ledger.getBalance(user, tokenId);
              
              if (op.operation === "lock") {
                // Lock a fraction of available
                if (balance.available > 0n) {
                  const lockAmount = (balance.available * BigInt(op.fraction)) / 100n;
                  if (lockAmount > 0n && lockAmount <= balance.available) {
                    ledger.lock(user, tokenId, lockAmount);
                  }
                }
              } else {
                // Unlock a fraction of locked
                if (balance.locked > 0n) {
                  const unlockAmount = (balance.locked * BigInt(op.fraction)) / 100n;
                  if (unlockAmount > 0n && unlockAmount <= balance.locked) {
                    ledger.unlock(user, tokenId, unlockAmount);
                  }
                }
              }
              
              // Invariant: total must remain constant after each operation
              const currentTotal = ledger.getTotalUserBalance(user, tokenId);
              expect(currentTotal).toBe(initialTotal);
            }
            
            // Final check: total still equals initial
            const finalTotal = ledger.getTotalUserBalance(user, tokenId);
            expect(finalTotal).toBe(initialTotal);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("lock decreases available and increases locked by exact amount", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          tokenIdArbitrary,
          // Use amounts large enough that percentage calculations don't round to 0
          fc.bigInt({ min: 100n, max: 2n ** 32n }),
          fc.integer({ min: 10, max: 90 }),
          (user, tokenId, initialAmount, lockPercent) => {
            const ledger = new Ledger();
            ledger.credit(user, tokenId, initialAmount);
            
            const lockAmount = (initialAmount * BigInt(lockPercent)) / 100n;
            // Pre-condition: lockAmount must be positive
            fc.pre(lockAmount > 0n);
            
            const beforeBalance = ledger.getBalance(user, tokenId);
            // Copy values since getBalance returns a reference that may be mutated
            const beforeAvailable = beforeBalance.available;
            const beforeLocked = beforeBalance.locked;
            
            ledger.lock(user, tokenId, lockAmount);
            const afterBalance = ledger.getBalance(user, tokenId);
            
            // Available decreased by exact lock amount
            expect(afterBalance.available).toBe(beforeAvailable - lockAmount);
            // Locked increased by exact lock amount
            expect(afterBalance.locked).toBe(beforeLocked + lockAmount);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("unlock increases available and decreases locked by exact amount", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          tokenIdArbitrary,
          // Use amounts large enough that percentage calculations don't round to 0
          fc.bigInt({ min: 1000n, max: 2n ** 32n }),
          fc.integer({ min: 20, max: 80 }),
          fc.integer({ min: 20, max: 80 }),
          (user, tokenId, initialAmount, lockPercent, unlockPercent) => {
            const ledger = new Ledger();
            ledger.credit(user, tokenId, initialAmount);
            
            const lockAmount = (initialAmount * BigInt(lockPercent)) / 100n;
            // Pre-condition: lockAmount must be positive
            fc.pre(lockAmount > 0n);
            
            ledger.lock(user, tokenId, lockAmount);
            
            const unlockAmount = (lockAmount * BigInt(unlockPercent)) / 100n;
            // Pre-condition: unlockAmount must be positive
            fc.pre(unlockAmount > 0n);
            
            const beforeBalance = ledger.getBalance(user, tokenId);
            // Copy values since getBalance returns a reference that may be mutated
            const beforeAvailable = beforeBalance.available;
            const beforeLocked = beforeBalance.locked;
            
            ledger.unlock(user, tokenId, unlockAmount);
            const afterBalance = ledger.getBalance(user, tokenId);
            
            // Available increased by exact unlock amount
            expect(afterBalance.available).toBe(beforeAvailable + unlockAmount);
            // Locked decreased by exact unlock amount
            expect(afterBalance.locked).toBe(beforeLocked - unlockAmount);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("sequence of lock/unlock operations preserves total", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          tokenIdArbitrary,
          amountArbitrary,
          fc.array(fc.integer({ min: 1, max: 50 }), { minLength: 1, maxLength: 10 }),
          (user, tokenId, initialAmount, lockPercentages) => {
            const ledger = new Ledger();
            ledger.credit(user, tokenId, initialAmount);
            
            const initialTotal = ledger.getTotalUserBalance(user, tokenId);
            
            // Lock various amounts
            for (const pct of lockPercentages) {
              const balance = ledger.getBalance(user, tokenId);
              if (balance.available > 0n) {
                const lockAmount = (balance.available * BigInt(pct)) / 100n;
                if (lockAmount > 0n) {
                  ledger.lock(user, tokenId, lockAmount);
                }
              }
            }
            
            // Unlock all
            const midBalance = ledger.getBalance(user, tokenId);
            if (midBalance.locked > 0n) {
              ledger.unlock(user, tokenId, midBalance.locked);
            }
            
            const finalTotal = ledger.getTotalUserBalance(user, tokenId);
            expect(finalTotal).toBe(initialTotal);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});


  /**
   * Property 11: Trade Balance Conservation
   * 
   * For any executed trade, the sum of all balance changes across both parties 
   * SHALL equal zero (conservation of value), accounting for the trade amount and price.
   * 
   * **Validates: Requirements 3.6**
   */
  describe("Property 11: Trade Balance Conservation", () => {
    test("sum of all balance changes equals zero in transfer", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          addressArbitrary,
          tokenIdArbitrary,
          amountArbitrary,
          amountArbitrary,
          (sender, receiver, tokenId, senderInitial, transferAmount) => {
            // Pre-condition: sender and receiver must be different
            fc.pre(sender.toLowerCase() !== receiver.toLowerCase());
            // Pre-condition: transfer amount must not exceed sender's balance
            fc.pre(transferAmount <= senderInitial);
            
            const ledger = new Ledger();
            
            // Setup: credit sender with initial balance
            ledger.credit(sender, tokenId, senderInitial);
            
            // Record total before transfer
            const totalBefore = ledger.getTotalBalance(tokenId);
            
            // Execute transfer
            ledger.transfer(sender, receiver, tokenId, transferAmount, false);
            
            // Record total after transfer
            const totalAfter = ledger.getTotalBalance(tokenId);
            
            // Conservation: total balance must remain constant
            expect(totalAfter).toBe(totalBefore);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("transfer from locked balance conserves total", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          addressArbitrary,
          tokenIdArbitrary,
          amountArbitrary,
          fc.integer({ min: 10, max: 90 }),
          fc.integer({ min: 10, max: 90 }),
          (sender, receiver, tokenId, senderInitial, lockPercent, transferPercent) => {
            // Pre-condition: sender and receiver must be different
            fc.pre(sender.toLowerCase() !== receiver.toLowerCase());
            
            const ledger = new Ledger();
            
            // Setup: credit sender and lock some balance
            ledger.credit(sender, tokenId, senderInitial);
            const lockAmount = (senderInitial * BigInt(lockPercent)) / 100n;
            fc.pre(lockAmount > 0n);
            ledger.lock(sender, tokenId, lockAmount);
            
            // Calculate transfer amount from locked balance
            const transferAmount = (lockAmount * BigInt(transferPercent)) / 100n;
            fc.pre(transferAmount > 0n);
            
            // Record total before transfer
            const totalBefore = ledger.getTotalBalance(tokenId);
            
            // Execute transfer from locked balance
            ledger.transfer(sender, receiver, tokenId, transferAmount, true);
            
            // Record total after transfer
            const totalAfter = ledger.getTotalBalance(tokenId);
            
            // Conservation: total balance must remain constant
            expect(totalAfter).toBe(totalBefore);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("multiple transfers conserve total balance", () => {
      fc.assert(
        fc.property(
          fc.array(addressArbitrary, { minLength: 3, maxLength: 5 }),
          tokenIdArbitrary,
          fc.array(amountArbitrary, { minLength: 3, maxLength: 5 }),
          fc.array(
            fc.record({
              fromIdx: fc.integer({ min: 0, max: 4 }),
              toIdx: fc.integer({ min: 0, max: 4 }),
              percent: fc.integer({ min: 1, max: 50 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (users, tokenId, initialAmounts, transfers) => {
            // Ensure we have matching arrays
            const numUsers = Math.min(users.length, initialAmounts.length);
            fc.pre(numUsers >= 2);
            
            const ledger = new Ledger();
            
            // Setup: credit each user with initial balance
            for (let i = 0; i < numUsers; i++) {
              ledger.credit(users[i], tokenId, initialAmounts[i]);
            }
            
            // Record total before transfers
            const totalBefore = ledger.getTotalBalance(tokenId);
            
            // Execute transfers
            for (const t of transfers) {
              const fromIdx = t.fromIdx % numUsers;
              const toIdx = t.toIdx % numUsers;
              
              // Skip self-transfers
              if (users[fromIdx].toLowerCase() === users[toIdx].toLowerCase()) continue;
              
              const senderBalance = ledger.getBalance(users[fromIdx], tokenId);
              if (senderBalance.available > 0n) {
                const transferAmount = (senderBalance.available * BigInt(t.percent)) / 100n;
                if (transferAmount > 0n) {
                  ledger.transfer(users[fromIdx], users[toIdx], tokenId, transferAmount, false);
                }
              }
            }
            
            // Record total after transfers
            const totalAfter = ledger.getTotalBalance(tokenId);
            
            // Conservation: total balance must remain constant
            expect(totalAfter).toBe(totalBefore);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("sender loses exactly what receiver gains", () => {
      fc.assert(
        fc.property(
          addressArbitrary,
          addressArbitrary,
          tokenIdArbitrary,
          amountArbitrary,
          amountArbitrary,
          (sender, receiver, tokenId, senderInitial, transferAmount) => {
            // Pre-condition: sender and receiver must be different
            fc.pre(sender.toLowerCase() !== receiver.toLowerCase());
            // Pre-condition: transfer amount must not exceed sender's balance
            fc.pre(transferAmount <= senderInitial);
            
            const ledger = new Ledger();
            
            // Setup
            ledger.credit(sender, tokenId, senderInitial);
            
            // Record balances before
            const senderBefore = ledger.getTotalUserBalance(sender, tokenId);
            const receiverBefore = ledger.getTotalUserBalance(receiver, tokenId);
            
            // Execute transfer
            ledger.transfer(sender, receiver, tokenId, transferAmount, false);
            
            // Record balances after
            const senderAfter = ledger.getTotalUserBalance(sender, tokenId);
            const receiverAfter = ledger.getTotalUserBalance(receiver, tokenId);
            
            // Sender loses exactly transferAmount
            expect(senderBefore - senderAfter).toBe(transferAmount);
            // Receiver gains exactly transferAmount
            expect(receiverAfter - receiverBefore).toBe(transferAmount);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
