// Export types (base types)
export * from './types';

// Export SSE events (includes trading event types for SSE)
export * from './sse-events';

// Export contracts - but exclude types that conflict with sse-events
// The sse-events versions are preferred as they use string serialization for bigints
export {
  // ABIs
  marketAbi,
  marketFactoryAbi,
  conditionalTokensAbi,
  orderBookAbi,
  ctfExchangeAbi,
  settlementVaultAbi,
  erc20Abi,
} from './contracts/abis';

// Export config (all exports are unique)
export * from './contracts/config';

// Export contract types that don't conflict with sse-events
export {
  // Enums (these are duplicated but identical, so we export from contracts)
  MarketState,
  MarketOutcome,
  OrderSide,
  // Types
  type TokenType,
  type Bytes32,
  type Market,
  type Order,
  type OrderBookLevel,
  type OrderBookState,
  type Position,
  type OpenOrder,
  type TradeHistory,
  type CreateMarketParams,
  type PlaceOrderParams,
  // Constants
  USDC_DECIMALS,
  BPS_DENOMINATOR,
  // Utility functions
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
  // CTFExchange types
  type CTFSignedOrder,
  type CTFOrderStatus,
  type CTFTokenInfo,
  // SettlementVault types
  type SettlementEpoch,
  type WithdrawalProof,
  type DepositStatus,
  // EIP-712 types
  type CTFExchangeDomain,
  CTF_ORDER_TYPES,
} from './contracts/types';
