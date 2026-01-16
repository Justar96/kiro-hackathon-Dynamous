import type { SignedOrder } from "../types";

export interface RiskLimits {
  maxOrderSize: bigint;
  maxExposure: bigint;
  maxOrdersPerMinute: number;
  maxWithdrawalPerDay: bigint;
}

export interface RiskResult {
  valid: boolean;
  reason?: string;
}

/**
 * User tiers for risk management.
 * Each tier has different limits for trading activity.
 */
export enum UserTier {
  STANDARD = "STANDARD",
  PREMIUM = "PREMIUM",
  VIP = "VIP",
}

/**
 * Predefined limits for each user tier.
 * - STANDARD: Default limits for new users
 * - PREMIUM: Higher limits for verified users
 * - VIP: Highest limits for institutional/high-volume traders
 */
export const TIER_LIMITS: Record<UserTier, RiskLimits> = {
  [UserTier.STANDARD]: {
    maxOrderSize: 10n ** 23n, // 100K tokens
    maxExposure: 10n ** 24n, // 1M tokens
    maxOrdersPerMinute: 30,
    maxWithdrawalPerDay: 10n ** 23n, // 100K tokens
  },
  [UserTier.PREMIUM]: {
    maxOrderSize: 10n ** 24n, // 1M tokens
    maxExposure: 10n ** 25n, // 10M tokens
    maxOrdersPerMinute: 60,
    maxWithdrawalPerDay: 10n ** 24n, // 1M tokens
  },
  [UserTier.VIP]: {
    maxOrderSize: 10n ** 25n, // 10M tokens
    maxExposure: 10n ** 26n, // 100M tokens
    maxOrdersPerMinute: 120,
    maxWithdrawalPerDay: 10n ** 25n, // 10M tokens
  },
};

const DEFAULT_TIER = UserTier.STANDARD;
const DEFAULT_LIMITS: RiskLimits = TIER_LIMITS[DEFAULT_TIER];

export class RiskEngine {
  private userLimits = new Map<string, RiskLimits>();
  private userTiers = new Map<string, UserTier>();
  private orderTimestamps = new Map<string, number[]>();
  private userExposure = new Map<string, bigint>();
  private dailyWithdrawals = new Map<string, { date: string; amount: bigint }>();
  private activeOrders = new Map<string, Set<string>>(); // user -> orderIds

  /**
   * Get the tier for a user. Returns DEFAULT_TIER if not set.
   */
  getTier(user: string): UserTier {
    return this.userTiers.get(user.toLowerCase()) || DEFAULT_TIER;
  }

  /**
   * Set the tier for a user.
   */
  setTier(user: string, tier: UserTier): void {
    this.userTiers.set(user.toLowerCase(), tier);
    // Clear any custom limits when tier is set - tier limits take precedence
    this.userLimits.delete(user.toLowerCase());
  }

  /**
   * Get the effective limits for a user.
   * Priority: custom limits > tier limits > default limits
   */
  getLimits(user: string): RiskLimits {
    const addr = user.toLowerCase();
    // Custom limits take precedence
    const customLimits = this.userLimits.get(addr);
    if (customLimits) {
      return customLimits;
    }
    // Then tier limits
    const tier = this.userTiers.get(addr);
    if (tier) {
      return TIER_LIMITS[tier];
    }
    // Default to standard tier
    return DEFAULT_LIMITS;
  }

  /**
   * Set custom limits for a user (overrides tier limits).
   */
  setLimits(user: string, limits: Partial<RiskLimits>): void {
    const current = this.getLimits(user);
    this.userLimits.set(user.toLowerCase(), { ...current, ...limits });
  }

  /**
   * Get the limits for a specific tier.
   */
  getTierLimits(tier: UserTier): RiskLimits {
    return TIER_LIMITS[tier];
  }

  validateOrder(order: SignedOrder): RiskResult {
    const user = order.maker.toLowerCase();
    const limits = this.getLimits(user);

    // Check order size
    if (order.makerAmount > limits.maxOrderSize) {
      return { valid: false, reason: "Order size exceeds limit" };
    }

    // Check exposure
    const exposure = this.userExposure.get(user) || 0n;
    if (exposure + order.makerAmount > limits.maxExposure) {
      return { valid: false, reason: "Exposure limit exceeded" };
    }

    // Check rate limit
    const now = Date.now();
    const timestamps = this.orderTimestamps.get(user) || [];
    const recent = timestamps.filter((t) => now - t < 60000);
    if (recent.length >= limits.maxOrdersPerMinute) {
      return { valid: false, reason: "Rate limit exceeded" };
    }

    return { valid: true };
  }

  recordOrder(orderId: string, order: SignedOrder): void {
    const user = order.maker.toLowerCase();

    // Record timestamp
    const timestamps = this.orderTimestamps.get(user) || [];
    timestamps.push(Date.now());
    this.orderTimestamps.set(user, timestamps.slice(-100)); // Keep last 100

    // Update exposure
    const exposure = this.userExposure.get(user) || 0n;
    this.userExposure.set(user, exposure + order.makerAmount);

    // Track active order
    const orders = this.activeOrders.get(user) || new Set();
    orders.add(orderId);
    this.activeOrders.set(user, orders);
  }

  releaseOrder(orderId: string, user: string, amount: bigint): void {
    const addr = user.toLowerCase();
    const exposure = this.userExposure.get(addr) || 0n;
    this.userExposure.set(addr, exposure > amount ? exposure - amount : 0n);

    const orders = this.activeOrders.get(addr);
    orders?.delete(orderId);
  }

  validateWithdrawal(user: string, amount: bigint): RiskResult {
    const addr = user.toLowerCase();
    const limits = this.getLimits(addr);
    const today = new Date().toISOString().slice(0, 10);

    const record = this.dailyWithdrawals.get(addr);
    const dailyAmount = record?.date === today ? record.amount : 0n;

    if (dailyAmount + amount > limits.maxWithdrawalPerDay) {
      return { valid: false, reason: "Daily withdrawal limit exceeded" };
    }

    return { valid: true };
  }

  recordWithdrawal(user: string, amount: bigint): void {
    const addr = user.toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    const record = this.dailyWithdrawals.get(addr);
    const current = record?.date === today ? record.amount : 0n;
    this.dailyWithdrawals.set(addr, { date: today, amount: current + amount });
  }

  getExposure(user: string): bigint {
    return this.userExposure.get(user.toLowerCase()) || 0n;
  }

  getActiveOrderCount(user: string): number {
    return this.activeOrders.get(user.toLowerCase())?.size || 0;
  }
}
