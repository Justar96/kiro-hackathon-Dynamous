/**
 * Wagmi v2 configuration for on-chain settlement
 * Configures wallet connectors and chain settings for Polygon
 * 
 * Includes configuration validation on app startup.
 * Requirements: 1.3, 5.4
 */

import { createConfig, http } from 'wagmi';
import { polygon, polygonAmoy } from 'wagmi/chains';
import { injected, walletConnect, coinbaseWallet } from '@wagmi/connectors';
import {
  loadConfigFromEnv,
  validateConfig,
  isZeroAddress,
  type NetworkConfig,
  type ConfigValidationResult,
  type ContractAddresses,
} from '@thesis/shared';

// ============ Environment Loading ============

/**
 * Load configuration from Vite environment variables
 */
function loadFrontendConfig(): NetworkConfig {
  // Convert import.meta.env to a plain object for the config loader
  const env: Record<string, string | undefined> = {
    VITE_CHAIN_ID: import.meta.env.VITE_CHAIN_ID,
    VITE_RPC_URL: import.meta.env.VITE_RPC_URL,
    VITE_EXCHANGE_ADDRESS: import.meta.env.VITE_EXCHANGE_ADDRESS,
    VITE_VAULT_ADDRESS: import.meta.env.VITE_VAULT_ADDRESS,
    VITE_CTF_ADDRESS: import.meta.env.VITE_CTF_ADDRESS,
    VITE_USDC_ADDRESS: import.meta.env.VITE_USDC_ADDRESS,
    VITE_MARKET_FACTORY_ADDRESS: import.meta.env.VITE_MARKET_FACTORY_ADDRESS,
    VITE_ORDER_BOOK_ADDRESS: import.meta.env.VITE_ORDER_BOOK_ADDRESS,
  };

  return loadConfigFromEnv(env);
}

// ============ Configuration State ============

/**
 * Loaded network configuration
 */
export const networkConfig: NetworkConfig = loadFrontendConfig();

/**
 * Configuration validation result
 */
export const configValidation: ConfigValidationResult = validateConfig(networkConfig);

/**
 * Check if configuration is valid for trading operations
 * Returns true if all critical contract addresses are configured
 */
export function isConfigValid(): boolean {
  return configValidation.valid;
}

/**
 * Get list of missing contract addresses
 */
export function getMissingAddresses(): string[] {
  const missing: string[] = [];
  const contracts = networkConfig.contracts;
  
  const criticalContracts: (keyof ContractAddresses)[] = [
    'ctfExchange',
    'settlementVault',
    'usdc',
  ];

  for (const key of criticalContracts) {
    if (isZeroAddress(contracts[key])) {
      missing.push(key);
    }
  }

  return missing;
}

/**
 * Check if blockchain features are available
 * Returns false if critical addresses are missing
 */
export function isBlockchainEnabled(): boolean {
  const missing = getMissingAddresses();
  return missing.length === 0;
}

/**
 * Get configuration errors for display
 */
export function getConfigErrors(): string[] {
  return configValidation.errors.map((e: { field: string; message: string }) => `${e.field}: ${e.message}`);
}

/**
 * Get configuration warnings for display
 */
export function getConfigWarnings(): string[] {
  return configValidation.warnings.map((w: { field: string; message: string }) => `${w.field}: ${w.message}`);
}

// ============ Wagmi Configuration ============

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

// Default chain for the app based on loaded config
export const DEFAULT_CHAIN_ID = networkConfig.chainId;

// Type for the wagmi config
export type WagmiConfig = typeof wagmiConfig;

// ============ Contract Addresses Export ============

/**
 * Get contract addresses from loaded config
 */
export function getContractAddresses(): ContractAddresses {
  return networkConfig.contracts;
}

/**
 * Get a specific contract address
 */
export function getContractAddress(contract: keyof ContractAddresses): `0x${string}` {
  return networkConfig.contracts[contract];
}

// Log configuration status on load (development only)
if (import.meta.env.DEV) {
  console.log('[CONFIG] Network configuration loaded:', {
    environment: networkConfig.environment,
    chainId: networkConfig.chainId,
    rpcUrl: networkConfig.rpcUrl,
    valid: configValidation.valid,
  });
  
  if (configValidation.errors.length > 0) {
    console.warn('[CONFIG] Configuration errors:', configValidation.errors);
  }
  
  if (configValidation.warnings.length > 0) {
    console.warn('[CONFIG] Configuration warnings:', configValidation.warnings);
  }
  
  const missing = getMissingAddresses();
  if (missing.length > 0) {
    console.warn('[CONFIG] Missing contract addresses:', missing);
    console.warn('[CONFIG] Blockchain features will be disabled');
  }
}
