import { describe, test, expect, beforeEach } from "bun:test";
import { Ledger, LedgerError, LedgerErrorCode } from "../src/services/ledger";

describe("Ledger", () => {
  let ledger: Ledger;
  const ONE = 10n ** 18n;
  const alice = "0xAlice";
  const bob = "0xBob";
  const collateralTokenId = 0n;
  const outcomeTokenId = 1n;

  beforeEach(() => {
    ledger = new Ledger();
  });

  describe("credit", () => {
    test("should credit balance to user", () => {
      ledger.credit(alice, collateralTokenId, 100n * ONE);
      
      const balance = ledger.getBalance(alice, collateralTokenId);
      expect(balance.available).toBe(100n * ONE);
      expect(balance.locked).toBe(0n);
    });

    test("should accumulate credits", () => {
      ledger.credit(alice, collateralTokenId, 100n * ONE);
      ledger.credit(alice, collateralTokenId, 50n * ONE);
      
      const balance = ledger.getBalance(alice, collateralTokenId);
      expect(balance.available).toBe(150n * ONE);
    });

    test("should reject zero amount", () => {
      expect(() => ledger.credit(alice, collateralTokenId, 0n)).toThrow(LedgerError);
    });

    test("should reject negative amount", () => {
      expect(() => ledger.credit(alice, collateralTokenId, -1n)).toThrow(LedgerError);
    });
  });

  describe("debit", () => {
    test("should debit from available balance", () => {
      ledger.credit(alice, collateralTokenId, 100n * ONE);
      ledger.debit(alice, collateralTokenId, 30n * ONE);
      
      const balance = ledger.getBalance(alice, collateralTokenId);
      expect(balance.available).toBe(70n * ONE);
    });

    test("should reject debit exceeding available balance", () => {
      ledger.credit(alice, collateralTokenId, 100n * ONE);
      
      expect(() => ledger.debit(alice, collateralTokenId, 150n * ONE)).toThrow(LedgerError);
    });

    test("should reject debit for non-existent user", () => {
      expect(() => ledger.debit(alice, collateralTokenId, 10n * ONE)).toThrow(LedgerError);
    });
  });

  describe("lock", () => {
    test("should lock available balance", () => {
      ledger.credit(alice, collateralTokenId, 100n * ONE);
      ledger.lock(alice, collateralTokenId, 30n * ONE);
      
      const balance = ledger.getBalance(alice, collateralTokenId);
      expect(balance.available).toBe(70n * ONE);
      expect(balance.locked).toBe(30n * ONE);
    });

    test("should maintain total balance after lock", () => {
      ledger.credit(alice, collateralTokenId, 100n * ONE);
      const totalBefore = ledger.getTotalUserBalance(alice, collateralTokenId);
      
      ledger.lock(alice, collateralTokenId, 30n * ONE);
      const totalAfter = ledger.getTotalUserBalance(alice, collateralTokenId);
      
      expect(totalAfter).toBe(totalBefore);
    });

    test("should reject lock exceeding available balance", () => {
      ledger.credit(alice, collateralTokenId, 100n * ONE);
      
      expect(() => ledger.lock(alice, collateralTokenId, 150n * ONE)).toThrow(LedgerError);
    });
  });

  describe("unlock", () => {
    test("should unlock locked balance", () => {
      ledger.credit(alice, collateralTokenId, 100n * ONE);
      ledger.lock(alice, collateralTokenId, 30n * ONE);
      ledger.unlock(alice, collateralTokenId, 20n * ONE);
      
      const balance = ledger.getBalance(alice, collateralTokenId);
      expect(balance.available).toBe(90n * ONE);
      expect(balance.locked).toBe(10n * ONE);
    });

    test("should maintain total balance after unlock", () => {
      ledger.credit(alice, collateralTokenId, 100n * ONE);
      ledger.lock(alice, collateralTokenId, 30n * ONE);
      const totalBefore = ledger.getTotalUserBalance(alice, collateralTokenId);
      
      ledger.unlock(alice, collateralTokenId, 20n * ONE);
      const totalAfter = ledger.getTotalUserBalance(alice, collateralTokenId);
      
      expect(totalAfter).toBe(totalBefore);
    });

    test("should reject unlock exceeding locked balance", () => {
      ledger.credit(alice, collateralTokenId, 100n * ONE);
      ledger.lock(alice, collateralTokenId, 30n * ONE);
      
      expect(() => ledger.unlock(alice, collateralTokenId, 50n * ONE)).toThrow(LedgerError);
    });
  });

  describe("transfer", () => {
    test("should transfer from available balance", () => {
      ledger.credit(alice, collateralTokenId, 100n * ONE);
      ledger.transfer(alice, bob, collateralTokenId, 30n * ONE, false);
      
      const aliceBalance = ledger.getBalance(alice, collateralTokenId);
      const bobBalance = ledger.getBalance(bob, collateralTokenId);
      
      expect(aliceBalance.available).toBe(70n * ONE);
      expect(bobBalance.available).toBe(30n * ONE);
    });

    test("should transfer from locked balance", () => {
      ledger.credit(alice, collateralTokenId, 100n * ONE);
      ledger.lock(alice, collateralTokenId, 50n * ONE);
      ledger.transfer(alice, bob, collateralTokenId, 30n * ONE, true);
      
      const aliceBalance = ledger.getBalance(alice, collateralTokenId);
      const bobBalance = ledger.getBalance(bob, collateralTokenId);
      
      expect(aliceBalance.available).toBe(50n * ONE);
      expect(aliceBalance.locked).toBe(20n * ONE);
      expect(bobBalance.available).toBe(30n * ONE);
    });

    test("should conserve total balance in transfer", () => {
      ledger.credit(alice, collateralTokenId, 100n * ONE);
      const totalBefore = ledger.getTotalBalance(collateralTokenId);
      
      ledger.transfer(alice, bob, collateralTokenId, 30n * ONE, false);
      const totalAfter = ledger.getTotalBalance(collateralTokenId);
      
      expect(totalAfter).toBe(totalBefore);
    });

    test("should reject transfer exceeding available balance", () => {
      ledger.credit(alice, collateralTokenId, 100n * ONE);
      
      expect(() => ledger.transfer(alice, bob, collateralTokenId, 150n * ONE, false)).toThrow(LedgerError);
    });
  });

  describe("nonce management", () => {
    test("should return 0 for new user nonce", () => {
      expect(ledger.getNonce(alice)).toBe(0n);
    });

    test("should set and get nonce", () => {
      ledger.setNonce(alice, 5n);
      expect(ledger.getNonce(alice)).toBe(5n);
    });

    test("should only update nonce if higher", () => {
      ledger.setNonce(alice, 5n);
      ledger.setNonce(alice, 3n);
      expect(ledger.getNonce(alice)).toBe(5n);
    });

    test("should increment nonce", () => {
      ledger.setNonce(alice, 5n);
      const newNonce = ledger.incrementNonce(alice);
      expect(newNonce).toBe(6n);
      expect(ledger.getNonce(alice)).toBe(6n);
    });
  });

  describe("getTotalBalance", () => {
    test("should sum balances across all users", () => {
      ledger.credit(alice, collateralTokenId, 100n * ONE);
      ledger.credit(bob, collateralTokenId, 50n * ONE);
      ledger.lock(alice, collateralTokenId, 30n * ONE);
      
      const total = ledger.getTotalBalance(collateralTokenId);
      expect(total).toBe(150n * ONE);
    });
  });

  describe("case insensitivity", () => {
    test("should treat addresses case-insensitively", () => {
      ledger.credit("0xALICE", collateralTokenId, 100n * ONE);
      
      const balance1 = ledger.getBalance("0xalice", collateralTokenId);
      const balance2 = ledger.getBalance("0xAlice", collateralTokenId);
      
      expect(balance1.available).toBe(100n * ONE);
      expect(balance2.available).toBe(100n * ONE);
    });
  });
});
