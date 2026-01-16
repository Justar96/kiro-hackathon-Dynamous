/**
 * Trading Hooks Index
 *
 * Exports all trading-related hooks for the hybrid CLOB system.
 */

export {
  useOrders,
  type SubmitOrderParams,
  type OrderResult,
  type OrderEntry,
  type UseOrdersReturn,
} from './useOrders';

export {
  useOrderBook as useTradingOrderBook,
  type PriceLevel,
  type OrderBookEntry,
  type OrderBookState as TradingOrderBookState,
  type ConnectionStatus,
  type UseOrderBookOptions as UseTradingOrderBookOptions,
  type UseOrderBookReturn as UseTradingOrderBookReturn,
} from './useOrderBook';

export {
  useBalances,
  type TokenBalance,
  type PendingDeposit,
  type WithdrawalProof,
  type UseBalancesReturn,
} from './useBalances';
