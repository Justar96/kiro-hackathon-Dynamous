/**
 * Web3 Hooks Index
 *
 * Exports all web3-related hooks for wallet connection and contract interactions.
 */

export {
  useWalletConnection,
  type WalletConnectionState,
  type WalletConnectionActions,
  type UseWalletConnectionReturn,
} from './useWalletConnection';

export {
  useTokenBalances,
  type TokenBalancesState,
  type UseTokenBalancesOptions,
} from './useTokenBalances';

export {
  useMarket as useMarketContract,
  type MarketState,
  type MarketOutcome,
  type MarketStateData,
  type UseMarketOptions,
  type UseMarketReturn,
} from './useMarket';

export {
  useMarketActions as useMarketContractActions,
  type MarketActions,
  type TransactionState as MarketTransactionState,
} from './useMarketActions';

export {
  useMarketFactory as useMarketFactoryContract,
  type CreateMarketParams,
  type MarketInfo,
  type MarketFactoryActions,
  type MarketListState,
  type UseMarketFactoryReturn,
  type UseMarketFactoryOptions,
  type TransactionState as FactoryTransactionState,
} from './useMarketFactory';

export {
  useOrderBook,
  type OrderSide as OrderBookOrderSide,
  type Order,
  type OrderBookLevel,
  type OrderBookState,
  type UseOrderBookOptions,
  type UseOrderBookReturn,
} from './useOrderBook';

export {
  useOrderBookActions,
  OrderSide,
  type OrderBookActions,
  type TransactionState as OrderBookTransactionState,
} from './useOrderBookActions';

export {
  useWeb3Positions,
  usePosition,
  calculateUnrealizedPnL,
  type Position,
  type PortfolioSummary,
  type UsePositionsReturn,
} from './usePositions';

export {
  useOpenOrders,
  useOpenOrdersForMarket,
  type OpenOrder,
  type TokenType,
  type OrderSide as OpenOrderSide,
  type UseOpenOrdersReturn,
} from './useOpenOrders';

export {
  useTransaction,
  getTransactionStatusMessage,
  canRetryTransaction,
  type TransactionState,
  type TransactionStatus,
  type UseTransactionReturn,
} from './useTransaction';
