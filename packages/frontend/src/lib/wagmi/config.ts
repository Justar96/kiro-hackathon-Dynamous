/**
 * Wagmi v2 configuration for on-chain settlement
 * Configures wallet connectors and chain settings for Polygon
 */

import { createConfig, http } from 'wagmi';
import { polygon, polygonAmoy } from 'wagmi/chains';
import { injected, walletConnect, coinbaseWallet } from '@wagmi/connectors';

// WalletConnect project ID - should be set via environment variable
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

/**
 * Wagmi configuration with Polygon chains and wallet connectors
 */
export const wagmiConfig = createConfig({
  chains: [polygon, polygonAmoy],
  connectors: [
    injected(),
    ...(walletConnectProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            metadata: {
              name: 'Thesis',
              description: 'Prediction Market Platform',
              url: typeof window !== 'undefined' ? window.location.origin : '',
              icons: [],
            },
          }),
        ]
      : []),
    coinbaseWallet({
      appName: 'Thesis',
    }),
  ],
  transports: {
    [polygon.id]: http(),
    [polygonAmoy.id]: http(),
  },
});

// Export chain IDs for convenience
export const POLYGON_CHAIN_ID = polygon.id;
export const POLYGON_AMOY_CHAIN_ID = polygonAmoy.id;

// Default chain for the app (use testnet in development)
export const DEFAULT_CHAIN_ID =
  import.meta.env.MODE === 'production' ? POLYGON_CHAIN_ID : POLYGON_AMOY_CHAIN_ID;

// Type for the wagmi config
export type WagmiConfig = typeof wagmiConfig;
