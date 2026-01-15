/**
 * useWalletConnection Hook
 *
 * Provides wallet connection functionality with Polygon chain verification.
 * Implements connect/disconnect, chain switching, and connection persistence.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.7
 */

import { useCallback, useMemo } from 'react';
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useChainId,
  type Connector,
} from 'wagmi';
import { polygon, polygonAmoy } from 'wagmi/chains';
import { POLYGON_CHAIN_ID, POLYGON_AMOY_CHAIN_ID, DEFAULT_CHAIN_ID } from '../../wagmi';

/**
 * Wallet connection state
 */
export interface WalletConnectionState {
  /** Connected wallet address */
  address: `0x${string}` | undefined;
  /** Whether a wallet is connected */
  isConnected: boolean;
  /** Whether connection is in progress */
  isConnecting: boolean;
  /** Whether disconnection is in progress */
  isDisconnecting: boolean;
  /** Current chain ID */
  chainId: number | undefined;
  /** Whether connected to a supported Polygon chain */
  isCorrectChain: boolean;
  /** Whether connected to Polygon mainnet */
  isPolygonMainnet: boolean;
  /** Whether connected to Polygon Amoy testnet */
  isPolygonAmoy: boolean;
  /** Available wallet connectors */
  connectors: readonly Connector[];
  /** Connection error if any */
  error: Error | null;
}

/**
 * Wallet connection actions
 */
export interface WalletConnectionActions {
  /** Connect to a wallet using a specific connector */
  connect: (connector: Connector) => Promise<void>;
  /** Disconnect the current wallet */
  disconnect: () => void;
  /** Switch to Polygon mainnet */
  switchToPolygon: () => Promise<void>;
  /** Switch to Polygon Amoy testnet */
  switchToPolygonAmoy: () => Promise<void>;
  /** Switch to the default chain (based on environment) */
  switchToDefaultChain: () => Promise<void>;
}

/**
 * Combined return type for useWalletConnection
 */
export type UseWalletConnectionReturn = WalletConnectionState & WalletConnectionActions;

/**
 * Hook for managing wallet connection with Polygon chain support
 */
export function useWalletConnection(): UseWalletConnectionReturn {
  // Wagmi hooks for account state
  const { address, isConnected, isConnecting } = useAccount();
  const chainId = useChainId();

  // Connection hooks
  const {
    connect: wagmiConnect,
    connectors,
    error: connectError,
    isPending: isConnectPending,
  } = useConnect();

  const { disconnect: wagmiDisconnect, isPending: isDisconnectPending } = useDisconnect();

  const { switchChain, error: switchError } = useSwitchChain();

  // Compute chain status
  const isPolygonMainnet = chainId === POLYGON_CHAIN_ID;
  const isPolygonAmoy = chainId === POLYGON_AMOY_CHAIN_ID;
  const isCorrectChain = isPolygonMainnet || isPolygonAmoy;

  // Combine errors
  const error = connectError || switchError || null;

  /**
   * Connect to a wallet using a specific connector
   */
  const connect = useCallback(
    async (connector: Connector): Promise<void> => {
      return new Promise((resolve, reject) => {
        wagmiConnect(
          { connector },
          {
            onSuccess: () => resolve(),
            onError: (err) => reject(err),
          }
        );
      });
    },
    [wagmiConnect]
  );

  /**
   * Disconnect the current wallet
   */
  const disconnect = useCallback(() => {
    wagmiDisconnect();
  }, [wagmiDisconnect]);

  /**
   * Switch to Polygon mainnet
   */
  const switchToPolygon = useCallback(async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      switchChain(
        { chainId: polygon.id },
        {
          onSuccess: () => resolve(),
          onError: (err) => reject(err),
        }
      );
    });
  }, [switchChain]);

  /**
   * Switch to Polygon Amoy testnet
   */
  const switchToPolygonAmoy = useCallback(async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      switchChain(
        { chainId: polygonAmoy.id },
        {
          onSuccess: () => resolve(),
          onError: (err) => reject(err),
        }
      );
    });
  }, [switchChain]);

  /**
   * Switch to the default chain based on environment
   */
  const switchToDefaultChain = useCallback(async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      switchChain(
        { chainId: DEFAULT_CHAIN_ID },
        {
          onSuccess: () => resolve(),
          onError: (err) => reject(err),
        }
      );
    });
  }, [switchChain]);

  // Memoize the return value to prevent unnecessary re-renders
  return useMemo(
    () => ({
      // State
      address,
      isConnected,
      isConnecting: isConnecting || isConnectPending,
      isDisconnecting: isDisconnectPending,
      chainId,
      isCorrectChain,
      isPolygonMainnet,
      isPolygonAmoy,
      connectors,
      error,
      // Actions
      connect,
      disconnect,
      switchToPolygon,
      switchToPolygonAmoy,
      switchToDefaultChain,
    }),
    [
      address,
      isConnected,
      isConnecting,
      isConnectPending,
      isDisconnectPending,
      chainId,
      isCorrectChain,
      isPolygonMainnet,
      isPolygonAmoy,
      connectors,
      error,
      connect,
      disconnect,
      switchToPolygon,
      switchToPolygonAmoy,
      switchToDefaultChain,
    ]
  );
}
