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
  useOrderBook,
  useOrderBook as useTradingOrderBook,
  type PriceLevel,
  type OrderBookEntry,
  type OrderBookState,
  type OrderBookState as TradingOrderBookState,
  type ConnectionStatus,
  type UseOrderBookOptions,
  type UseOrderBookOptions as UseTradingOrderBookOptions,
  type UseOrderBookReturn,
  type UseOrderBookReturn as UseTradingOrderBookReturn,
} from './useOrderBook';

export {
  useBalances,
  type TokenBalance,
  type PendingDeposit,
  type WithdrawalProof,
  type UseBalancesReturn,
} from './useBalances';

export {
  useContractConfig,
  useTradingAvailable,
  type ContractConfigStatus,
} from './useContractConfig';
