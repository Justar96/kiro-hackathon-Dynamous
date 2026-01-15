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
