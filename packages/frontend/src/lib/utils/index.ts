/**
 * Utils Index
 * 
 * Utility functions and constants.
 */

export { 
  DEBATE_TEMPLATES, 
  getRandomTopic, 
  getTopicsByCategory,
  getCategories,
  getRandomTopicFromCategory,
  getAllTopics,
  type DebateCategory,
} from './debateTemplates';

// Price conversion utilities
export {
  // Re-exported from shared
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
  // Frontend-specific utilities
  impliedProbabilityToPrice,
  isValidPrice,
  isValidBasisPoints,
  calculateOrderCost,
  calculateOrderProceeds,
  calculateWinningPayout,
  calculateInvalidMarketPayout,
  formatPriceAsPercentage,
  formatPriceAsCents,
  parseUserPrice,
  calculateBreakEvenPrice,
} from './price';
