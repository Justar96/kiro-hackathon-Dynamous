import type { SignedOrder } from "../types";

interface RiskLimits {
  maxOrderSize: bigint;
  maxExposure: bigint;
  maxOrdersPerMinute: number;
  maxWithdrawalPerDay: bigint;
}

interface RiskResult {
  valid: boolean;
  reason?: string;
}

const DEFAULT_LIMITS: RiskLimits = {
  maxOrderSize: 10n ** 24n, // 1M tokens
  maxExposure: 10n ** 25n, // 10M tokens
  maxOrdersPerMinute: 60,
  maxWithdrawalPerDay: 10n ** 24n,
};

export class RiskEngine {
  private userLimits = new Map<string, RiskLimits>();
  private orderTimestamps = new Map<string, number[]>();
  private userExposure = new Map<string, bigint>();
  private dailyWithdrawals = new Map<string, { date: string; amount: bigint }>();
  private activeOrders = new Map<string, Set<string>>(); // user -> orderIds

  getLimits(user: string): RiskLimits {
    return this.userLimits.get(user.toLowerCase()) || DEFAULT_LIMITS;
  }

  setLimits(user: string, limits: Partial<RiskLimits>): void {
    const current = this.getLimits(user);
    this.userLimits.set(user.toLowerCase(), { ...current, ...limits });
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
