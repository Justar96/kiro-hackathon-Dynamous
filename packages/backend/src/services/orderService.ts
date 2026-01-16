/**
 * Order Service
 * 
 * Handles order submission, validation, and management for the hybrid CLOB trading system.
 * Validates EIP-712 signatures, nonces, and balance sufficiency before submitting to matching engine.
 * 
 * Requirements: 2.3, 2.4, 2.5, 2.6
 */

import type { SignedOrder, OrderBookEntry, Trade } from "../types";
import { Side } from "../types";
import { OrderSigner } from "./orderSigner";
import { Ledger, LedgerError, LedgerErrorCode } from "./ledger";
import { MatchingEngine } from "./matchingEngine";
import { RiskEngine } from "./riskEngine";

/**
 * Error codes for order validation failures
 * Requirement 2.6: Return specific error code indicating failure reason
 */
export enum OrderErrorCode {
  INVALID_SIGNATURE = "INVALID_SIGNATURE",
  INVALID_NONCE = "INVALID_NONCE",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  ORDER_EXPIRED = "ORDER_EXPIRED",
  RISK_LIMIT_EXCEEDED = "RISK_LIMIT_EXCEEDED",
  ORDER_NOT_FOUND = "ORDER_NOT_FOUND",
  ORDER_NOT_OWNED = "ORDER_NOT_OWNED",
  INVALID_ORDER = "INVALID_ORDER",
}

/**
 * Error thrown when order validation fails
 */
export class OrderError extends Error {
  constructor(
    message: string,
    public readonly code: OrderErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "OrderError";
  }
}

/**
 * Result of order submission
 */
export interface OrderResult {
  orderId: string;
  status: "accepted" | "rejected";
  trades: Trade[];
  error?: string;
  errorCode?: OrderErrorCode;
}

/**
 * Order Service for the hybrid CLOB trading system
 * 
 * Responsibilities:
 * - Validate EIP-712 signatures (Requirement 2.3)
 * - Validate nonces against Ledger (Requirement 2.4)
 * - Check balance sufficiency (Requirement 2.5)
 * - Return specific error codes (Requirement 2.6)
 * - Wire to Risk Engine for limit checks
 * - Wire to Matching Engine for order submission
 */
export class OrderService {
  private orderSigner: OrderSigner;
  private ledger: Ledger;
  private matchingEngine: MatchingEngine;
  private riskEngine: RiskEngine;

  constructor(
    chainId: number,
    exchangeAddress: string,
    ledger: Ledger,
    matchingEngine: MatchingEngine,
    riskEngine: RiskEngine
  ) {
    this.orderSigner = new OrderSigner(chainId, exchangeAddress);
    this.ledger = ledger;
    this.matchingEngine = matchingEngine;
    this.riskEngine = riskEngine;
  }

  /**
   * Submit a signed order for matching
   * 
   * Validates the order and submits to matching engine if valid.
   * 
   * @param order - The signed order to submit
   * @returns OrderResult with status and any trades executed
   */
  submitOrder(order: SignedOrder): OrderResult {
    try {
      // Step 1: Validate EIP-712 signature
      // Requirement 2.3: Validate signature against signer address
      this.validateSignature(order);

      // Step 2: Validate nonce
      // Requirement 2.4: Verify nonce matches user's current nonce
      this.validateNonce(order);

      // Step 3: Validate balance sufficiency
      // Requirement 2.5: Verify sufficient available balance
      this.validateBalance(order);

      // Step 4: Validate against risk limits
      this.validateRiskLimits(order);

      // Step 5: Submit to matching engine
      // The matching engine will lock balance and attempt matching
      const { trades, orderId } = this.matchingEngine.addOrder(order);

      // Step 6: Record order with risk engine
      this.riskEngine.recordOrder(orderId, order);

      return {
        orderId,
        status: "accepted",
        trades,
      };
    } catch (error) {
      if (error instanceof OrderError) {
        return {
          orderId: "",
          status: "rejected",
          trades: [],
          error: error.message,
          errorCode: error.code,
        };
      }
      
      // Handle other errors
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        orderId: "",
        status: "rejected",
        trades: [],
        error: message,
        errorCode: OrderErrorCode.INVALID_ORDER,
      };
    }
  }

  /**
   * Cancel an order by ID
   * 
   * @param orderId - The order ID to cancel
   * @param maker - The maker address (must own the order)
   * @returns true if cancelled, false if not found or not owned
   */
  cancelOrder(orderId: string, maker: string): boolean {
    // Get order to find the amount for risk engine release
    const order = this.matchingEngine.getOrder(orderId);
    if (!order) {
      return false;
    }

    // Verify ownership
    if (order.order.maker.toLowerCase() !== maker.toLowerCase()) {
      return false;
    }

    // Cancel in matching engine (this unlocks balance)
    const cancelled = this.matchingEngine.cancelOrder(orderId, maker);
    
    if (cancelled) {
      // Release from risk engine
      this.riskEngine.releaseOrder(orderId, maker, order.remaining);
    }

    return cancelled;
  }

  /**
   * Get order status by ID
   * 
   * @param orderId - The order ID to look up
   * @returns The order entry or null if not found
   */
  getOrder(orderId: string): OrderBookEntry | null {
    return this.matchingEngine.getOrder(orderId);
  }

  /**
   * Get signed order by order hash/ID
   * 
   * Implements IOrderStore interface for SettlementService integration.
   * The order hash is the same as the order ID in our system.
   * 
   * @param orderHash - The order hash/ID to look up
   * @returns The signed order or null if not found
   */
  getOrderByHash(orderHash: string): SignedOrder | null {
    const entry = this.matchingEngine.getOrder(orderHash);
    return entry ? entry.order : null;
  }

  /**
   * Get all open orders for a user
   * 
   * @param user - The user address
   * @returns Array of order entries
   */
  getUserOrders(user: string): OrderBookEntry[] {
    // Get order book for all markets and filter by user
    // Note: This is a simplified implementation - in production,
    // we'd maintain an index of orders by user
    const orders: OrderBookEntry[] = [];
    
    // For now, we can't efficiently get all user orders without
    // iterating all markets. This would need to be optimized
    // with a user -> orders index in a real implementation.
    
    return orders;
  }

  // ============ Validation Methods ============

  /**
   * Validate EIP-712 signature
   * 
   * Requirement 2.3: Validate signature against signer address
   * 
   * @throws OrderError if signature is invalid
   */
  validateSignature(order: SignedOrder): void {
    const isValid = this.orderSigner.verifySignature(order);
    
    if (!isValid) {
      throw new OrderError(
        "Invalid EIP-712 signature",
        OrderErrorCode.INVALID_SIGNATURE,
        {
          maker: order.maker,
          signer: order.signer,
        }
      );
    }
  }

  /**
   * Validate order nonce
   * 
   * Requirement 2.4: Verify nonce matches user's current nonce in Ledger
   * 
   * @throws OrderError if nonce is invalid
   */
  validateNonce(order: SignedOrder): void {
    const currentNonce = this.ledger.getNonce(order.maker);
    
    if (order.nonce !== currentNonce) {
      throw new OrderError(
        "Invalid nonce",
        OrderErrorCode.INVALID_NONCE,
        {
          expected: currentNonce.toString(),
          received: order.nonce.toString(),
          maker: order.maker,
        }
      );
    }
  }

  /**
   * Validate balance sufficiency
   * 
   * Requirement 2.5: Verify user has sufficient available balance
   * 
   * For BUY orders: check collateral (tokenId = 0)
   * For SELL orders: check outcome tokens
   * 
   * @throws OrderError if balance is insufficient
   */
  validateBalance(order: SignedOrder): void {
    // Determine which token to check based on order side
    const tokenId = order.side === Side.BUY ? 0n : order.tokenId;
    const requiredAmount = order.makerAmount;

    const hasSufficient = this.ledger.hasSufficientBalance(
      order.maker,
      tokenId,
      requiredAmount
    );

    if (!hasSufficient) {
      const balance = this.ledger.getBalance(order.maker, tokenId);
      throw new OrderError(
        "Insufficient balance",
        OrderErrorCode.INSUFFICIENT_BALANCE,
        {
          maker: order.maker,
          tokenId: tokenId.toString(),
          required: requiredAmount.toString(),
          available: balance.available.toString(),
        }
      );
    }
  }

  /**
   * Validate order against risk limits
   * 
   * @throws OrderError if risk limits are exceeded
   */
  validateRiskLimits(order: SignedOrder): void {
    const result = this.riskEngine.validateOrder(order);
    
    if (!result.valid) {
      throw new OrderError(
        result.reason || "Risk limit exceeded",
        OrderErrorCode.RISK_LIMIT_EXCEEDED,
        {
          maker: order.maker,
          reason: result.reason,
        }
      );
    }
  }

  /**
   * Check if an order has expired
   * 
   * @returns true if order is expired
   */
  isOrderExpired(order: SignedOrder): boolean {
    if (order.expiration === 0n) {
      return false; // No expiration
    }
    const now = BigInt(Math.floor(Date.now() / 1000));
    return order.expiration < now;
  }

  // ============ Utility Methods ============

  /**
   * Get the underlying OrderSigner instance
   * Useful for testing and direct signature operations
   */
  getOrderSigner(): OrderSigner {
    return this.orderSigner;
  }

  /**
   * Get the underlying Ledger instance
   * Useful for testing
   */
  getLedger(): Ledger {
    return this.ledger;
  }

  /**
   * Get the underlying MatchingEngine instance
   * Useful for testing
   */
  getMatchingEngine(): MatchingEngine {
    return this.matchingEngine;
  }

  /**
   * Get the underlying RiskEngine instance
   * Useful for testing
   */
  getRiskEngine(): RiskEngine {
    return this.riskEngine;
  }
}
