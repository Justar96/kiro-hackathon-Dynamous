/**
 * Price Conversion Utilities
 *
 * Provides functions for converting between different price representations
 * used in the on-chain settlement system.
 *
 * Requirements: 8.4
 */

// Re-export core utilities from shared package
export {
  USDC_DECIMALS,
  BPS_DENOMINATOR,
  priceToBasisPoints,
  basisPointsToPrice,
  toUsdcUnits,
  fromUsdcUnits,
  priceToImpliedProbability,
  calculateMidPrice,
  calculateSpread,
  calculateUnrealizedPnL,
  formatPrice,
  formatUsdc,
} from '@thesis/shared';

/**
 * Convert implied probability (0-100) to decimal price (0.01-0.99)
 *
 * @param probability - Probability as percentage (0-100)
 * @returns Decimal price (0.01-0.99)
 */
export const impliedProbabilityToPrice = (probability: number): number => {
  if (probability < 0 || probability > 100) {
    throw new Error('Probability must be between 0 and 100');
  }
  return probability / 100;
};

/**
 * Validate that a price is within valid bounds (0.01-0.99)
 *
 * @param price - Decimal price to validate
 * @returns True if price is valid
 */
export const isValidPrice = (price: number): boolean => {
  return price >= 0.01 && price <= 0.99;
};

/**
 * Validate that basis points are within valid bounds (100-9900)
 *
 * @param bps - Basis points to validate
 * @returns True if basis points are valid
 */
export const isValidBasisPoints = (bps: bigint): boolean => {
  return bps >= 100n && bps <= 9900n;
};

/**
 * Calculate the cost of buying tokens at a given price
 *
 * @param price - Price per token (0.01-0.99)
 * @param quantity - Number of tokens to buy
 * @returns Cost in USDC units (6 decimals)
 */
export const calculateOrderCost = (price: number, quantity: bigint): bigint => {
  // Cost = price * quantity, converted to USDC units
  const priceInUnits = BigInt(Math.round(price * 1e6));
  return (priceInUnits * quantity) / BigInt(1e6);
};

/**
 * Calculate the proceeds from selling tokens at a given price
 *
 * @param price - Price per token (0.01-0.99)
 * @param quantity - Number of tokens to sell
 * @returns Proceeds in USDC units (6 decimals)
 */
export const calculateOrderProceeds = (price: number, quantity: bigint): bigint => {
  return calculateOrderCost(price, quantity);
};

/**
 * Calculate the potential payout for winning tokens
 *
 * @param quantity - Number of winning tokens
 * @param feePercentage - Protocol fee percentage (default 2%)
 * @returns Payout in USDC units (6 decimals)
 */
export const calculateWinningPayout = (quantity: bigint, feePercentage: number = 2): bigint => {
  // Each winning token pays out 1 USDC minus fee
  const feeMultiplier = (100 - feePercentage) / 100;
  return BigInt(Math.floor(Number(quantity) * feeMultiplier));
};

/**
 * Calculate the payout for invalid market resolution (50/50 split)
 *
 * @param yesQuantity - Number of YES tokens
 * @param noQuantity - Number of NO tokens
 * @param feePercentage - Protocol fee percentage (default 2%)
 * @returns Payout in USDC units (6 decimals)
 */
export const calculateInvalidMarketPayout = (
  yesQuantity: bigint,
  noQuantity: bigint,
  feePercentage: number = 2
): bigint => {
  // Each token pays out 0.50 USDC minus fee
  const totalTokens = yesQuantity + noQuantity;
  const feeMultiplier = (100 - feePercentage) / 100;
  return BigInt(Math.floor(Number(totalTokens) * 0.5 * feeMultiplier));
};

/**
 * Format a price as a percentage string
 *
 * @param price - Decimal price (0.01-0.99)
 * @returns Formatted percentage string (e.g., "65%")
 */
export const formatPriceAsPercentage = (price: number): string => {
  return `${Math.round(price * 100)}%`;
};

/**
 * Format a price as cents
 *
 * @param price - Decimal price (0.01-0.99)
 * @returns Formatted cents string (e.g., "65¢")
 */
export const formatPriceAsCents = (price: number): string => {
  return `${Math.round(price * 100)}¢`;
};

/**
 * Parse a user-entered price string to a decimal number
 *
 * @param input - User input string (e.g., "0.65", "65", "65%", "65¢")
 * @returns Decimal price (0.01-0.99) or null if invalid
 */
export const parseUserPrice = (input: string): number | null => {
  const trimmed = input.trim();

  // Handle percentage format (e.g., "65%")
  if (trimmed.endsWith('%')) {
    const value = parseFloat(trimmed.slice(0, -1));
    if (isNaN(value)) return null;
    const price = value / 100;
    return isValidPrice(price) ? price : null;
  }

  // Handle cents format (e.g., "65¢")
  if (trimmed.endsWith('¢')) {
    const value = parseFloat(trimmed.slice(0, -1));
    if (isNaN(value)) return null;
    const price = value / 100;
    return isValidPrice(price) ? price : null;
  }

  // Handle decimal format (e.g., "0.65")
  const value = parseFloat(trimmed);
  if (isNaN(value)) return null;

  // If value is > 1, assume it's a percentage
  if (value > 1 && value <= 99) {
    const price = value / 100;
    return isValidPrice(price) ? price : null;
  }

  return isValidPrice(value) ? value : null;
};

/**
 * Calculate the break-even price for a position
 *
 * @param avgEntryPrice - Average entry price
 * @param feePercentage - Protocol fee percentage (default 2%)
 * @returns Break-even price
 */
export const calculateBreakEvenPrice = (avgEntryPrice: number, feePercentage: number = 2): number => {
  // Account for the fee on winning payouts
  const feeMultiplier = (100 - feePercentage) / 100;
  return avgEntryPrice / feeMultiplier;
};
