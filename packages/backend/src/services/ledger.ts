/**
 * Off-Chain Ledger Service
 * 
 * Dedicated service for balance management in the hybrid CLOB trading system.
 * Provides atomic operations for credit, debit, lock, unlock, and transfer.
 * 
 * Requirements: 1.3, 2.5, 2.7, 7.1
 */

import type { UserBalance } from "../types";

/**
 * Error thrown when a ledger operation fails
 */
export class LedgerError extends Error {
  constructor(
    message: string,
    public readonly code: LedgerErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "LedgerError";
  }
}

export enum LedgerErrorCode {
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  INSUFFICIENT_LOCKED = "INSUFFICIENT_LOCKED",
  INVALID_AMOUNT = "INVALID_AMOUNT",
  USER_NOT_FOUND = "USER_NOT_FOUND",
}

/**
 * Off-Chain Ledger for tracking user balances
 * 
 * Invariants:
 * - available + locked remains constant after lock/unlock operations
 * - Sum of all balance changes in a transfer equals zero
 * - Nonces are monotonically increasing
 */
export class Ledger {
  // User balances: address (lowercase) -> tokenId -> balance
  private balances = new Map<string, Map<bigint, UserBalance>>();

  // Nonces: address (lowercase) -> current nonce
  private nonces = new Map<string, bigint>();

  // ============ Balance Operations ============

  /**
   * Credit balance (from deposit)
   * Requirement 1.3: Update user's available balance atomically
   */
  credit(user: string, tokenId: bigint, amount: bigint): void {
    if (amount <= 0n) {
      throw new LedgerError(
        "Credit amount must be positive",
        LedgerErrorCode.INVALID_AMOUNT,
        { amount: amount.toString() }
      );
    }

    const normalizedUser = user.toLowerCase();
    const userBalances = this.getOrCreateUserBalances(normalizedUser);
    const balance = this.getOrCreateBalance(userBalances, tokenId);
    
    balance.available += amount;
  }

  /**
   * Debit balance (from withdrawal)
   * Reduces available balance
   */
  debit(user: string, tokenId: bigint, amount: bigint): void {
    if (amount <= 0n) {
      throw new LedgerError(
        "Debit amount must be positive",
        LedgerErrorCode.INVALID_AMOUNT,
        { amount: amount.toString() }
      );
    }

    const normalizedUser = user.toLowerCase();
    const userBalances = this.balances.get(normalizedUser);
    if (!userBalances) {
      throw new LedgerError(
        "User has no balances",
        LedgerErrorCode.USER_NOT_FOUND,
        { user: normalizedUser }
      );
    }

    const balance = userBalances.get(tokenId);
    if (!balance || balance.available < amount) {
      throw new LedgerError(
        "Insufficient available balance for debit",
        LedgerErrorCode.INSUFFICIENT_BALANCE,
        {
          user: normalizedUser,
          tokenId: tokenId.toString(),
          requested: amount.toString(),
          available: balance?.available.toString() ?? "0",
        }
      );
    }

    balance.available -= amount;
  }

  /**
   * Lock balance for order
   * Requirement 2.7: Lock required balance when order passes validation
   * 
   * Invariant: available + locked remains constant
   */
  lock(user: string, tokenId: bigint, amount: bigint): void {
    if (amount <= 0n) {
      throw new LedgerError(
        "Lock amount must be positive",
        LedgerErrorCode.INVALID_AMOUNT,
        { amount: amount.toString() }
      );
    }

    const normalizedUser = user.toLowerCase();
    const userBalances = this.balances.get(normalizedUser);
    if (!userBalances) {
      throw new LedgerError(
        "User has no balances",
        LedgerErrorCode.USER_NOT_FOUND,
        { user: normalizedUser }
      );
    }

    const balance = userBalances.get(tokenId);
    if (!balance || balance.available < amount) {
      throw new LedgerError(
        "Insufficient available balance for lock",
        LedgerErrorCode.INSUFFICIENT_BALANCE,
        {
          user: normalizedUser,
          tokenId: tokenId.toString(),
          requested: amount.toString(),
          available: balance?.available.toString() ?? "0",
        }
      );
    }

    balance.available -= amount;
    balance.locked += amount;
  }

  /**
   * Unlock balance (order cancelled/expired)
   * Requirement 7.1: Unlock user's balance on cancellation
   * 
   * Invariant: available + locked remains constant
   */
  unlock(user: string, tokenId: bigint, amount: bigint): void {
    if (amount <= 0n) {
      throw new LedgerError(
        "Unlock amount must be positive",
        LedgerErrorCode.INVALID_AMOUNT,
        { amount: amount.toString() }
      );
    }

    const normalizedUser = user.toLowerCase();
    const userBalances = this.balances.get(normalizedUser);
    if (!userBalances) {
      throw new LedgerError(
        "User has no balances",
        LedgerErrorCode.USER_NOT_FOUND,
        { user: normalizedUser }
      );
    }

    const balance = userBalances.get(tokenId);
    if (!balance || balance.locked < amount) {
      throw new LedgerError(
        "Insufficient locked balance for unlock",
        LedgerErrorCode.INSUFFICIENT_LOCKED,
        {
          user: normalizedUser,
          tokenId: tokenId.toString(),
          requested: amount.toString(),
          locked: balance?.locked.toString() ?? "0",
        }
      );
    }

    balance.locked -= amount;
    balance.available += amount;
  }

  /**
   * Transfer between users (trade execution)
   * 
   * Invariant: Sum of all balance changes equals zero (conservation)
   * 
   * @param from - Source user address
   * @param to - Destination user address
   * @param tokenId - Token being transferred
   * @param amount - Amount to transfer
   * @param fromLocked - If true, deduct from locked balance; otherwise from available
   */
  transfer(
    from: string,
    to: string,
    tokenId: bigint,
    amount: bigint,
    fromLocked: boolean = false
  ): void {
    if (amount <= 0n) {
      throw new LedgerError(
        "Transfer amount must be positive",
        LedgerErrorCode.INVALID_AMOUNT,
        { amount: amount.toString() }
      );
    }

    const normalizedFrom = from.toLowerCase();
    const normalizedTo = to.toLowerCase();

    // Get source balance
    const fromBalances = this.balances.get(normalizedFrom);
    if (!fromBalances) {
      throw new LedgerError(
        "Source user has no balances",
        LedgerErrorCode.USER_NOT_FOUND,
        { user: normalizedFrom }
      );
    }

    const fromBalance = fromBalances.get(tokenId);
    if (!fromBalance) {
      throw new LedgerError(
        "Source user has no balance for token",
        LedgerErrorCode.INSUFFICIENT_BALANCE,
        { user: normalizedFrom, tokenId: tokenId.toString() }
      );
    }

    // Check sufficient balance
    if (fromLocked) {
      if (fromBalance.locked < amount) {
        throw new LedgerError(
          "Insufficient locked balance for transfer",
          LedgerErrorCode.INSUFFICIENT_LOCKED,
          {
            user: normalizedFrom,
            tokenId: tokenId.toString(),
            requested: amount.toString(),
            locked: fromBalance.locked.toString(),
          }
        );
      }
      fromBalance.locked -= amount;
    } else {
      if (fromBalance.available < amount) {
        throw new LedgerError(
          "Insufficient available balance for transfer",
          LedgerErrorCode.INSUFFICIENT_BALANCE,
          {
            user: normalizedFrom,
            tokenId: tokenId.toString(),
            requested: amount.toString(),
            available: fromBalance.available.toString(),
          }
        );
      }
      fromBalance.available -= amount;
    }

    // Credit destination
    const toBalances = this.getOrCreateUserBalances(normalizedTo);
    const toBalance = this.getOrCreateBalance(toBalances, tokenId);
    toBalance.available += amount;
  }

  // ============ Balance Queries ============

  /**
   * Get balance for a specific token
   * Requirement 2.5: Check user's available balance
   */
  getBalance(user: string, tokenId: bigint): UserBalance {
    const normalizedUser = user.toLowerCase();
    const userBalances = this.balances.get(normalizedUser);
    if (!userBalances) {
      return { available: 0n, locked: 0n };
    }
    return userBalances.get(tokenId) ?? { available: 0n, locked: 0n };
  }

  /**
   * Get all balances for a user
   */
  getAllBalances(user: string): Map<bigint, UserBalance> {
    const normalizedUser = user.toLowerCase();
    const userBalances = this.balances.get(normalizedUser);
    if (!userBalances) {
      return new Map();
    }
    // Return a copy to prevent external mutation
    return new Map(userBalances);
  }

  /**
   * Get total balance across all users for a token
   * Used for reconciliation
   */
  getTotalBalance(tokenId: bigint): bigint {
    let total = 0n;
    for (const userBalances of this.balances.values()) {
      const balance = userBalances.get(tokenId);
      if (balance) {
        total += balance.available + balance.locked;
      }
    }
    return total;
  }

  /**
   * Get all users with balances for a specific token
   * Used for reconciliation
   */
  getUsersWithBalance(tokenId: bigint): Map<string, UserBalance> {
    const result = new Map<string, UserBalance>();
    for (const [user, userBalances] of this.balances) {
      const balance = userBalances.get(tokenId);
      if (balance && (balance.available > 0n || balance.locked > 0n)) {
        result.set(user, { ...balance });
      }
    }
    return result;
  }

  // ============ Nonce Management ============

  /**
   * Get current nonce for user
   */
  getNonce(user: string): bigint {
    const normalizedUser = user.toLowerCase();
    return this.nonces.get(normalizedUser) ?? 0n;
  }

  /**
   * Set nonce for user
   * Used by indexer to sync on-chain nonce
   */
  setNonce(user: string, nonce: bigint): void {
    const normalizedUser = user.toLowerCase();
    const currentNonce = this.nonces.get(normalizedUser) ?? 0n;
    // Only update if new nonce is higher (nonces are monotonically increasing)
    if (nonce > currentNonce) {
      this.nonces.set(normalizedUser, nonce);
    }
  }

  /**
   * Increment nonce for user
   * Returns the new nonce value
   */
  incrementNonce(user: string): bigint {
    const normalizedUser = user.toLowerCase();
    const currentNonce = this.nonces.get(normalizedUser) ?? 0n;
    const newNonce = currentNonce + 1n;
    this.nonces.set(normalizedUser, newNonce);
    return newNonce;
  }

  // ============ Utility Methods ============

  /**
   * Check if user has sufficient available balance
   * Requirement 2.5: Verify balance sufficiency
   */
  hasSufficientBalance(user: string, tokenId: bigint, amount: bigint): boolean {
    const balance = this.getBalance(user, tokenId);
    return balance.available >= amount;
  }

  /**
   * Get total (available + locked) balance for a user and token
   */
  getTotalUserBalance(user: string, tokenId: bigint): bigint {
    const balance = this.getBalance(user, tokenId);
    return balance.available + balance.locked;
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.balances.clear();
    this.nonces.clear();
  }

  // ============ Private Helpers ============

  private getOrCreateUserBalances(user: string): Map<bigint, UserBalance> {
    let userBalances = this.balances.get(user);
    if (!userBalances) {
      userBalances = new Map();
      this.balances.set(user, userBalances);
    }
    return userBalances;
  }

  private getOrCreateBalance(
    userBalances: Map<bigint, UserBalance>,
    tokenId: bigint
  ): UserBalance {
    let balance = userBalances.get(tokenId);
    if (!balance) {
      balance = { available: 0n, locked: 0n };
      userBalances.set(tokenId, balance);
    }
    return balance;
  }
}
