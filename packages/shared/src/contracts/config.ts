/**
 * Contract configuration for on-chain settlement
 * Contains contract addresses for different networks and chain configuration
 * 
 * Supports environment-based loading for local, testnet, and mainnet environments.
 */

import type { Address } from './types';

// ============ Types ============

export type Environment = 'local' | 'testnet' | 'mainnet';

/**
 * Contract addresses for a network
 */
export interface ContractAddresses {
  marketFactory: Address;
  conditionalTokens: Address;
  orderBook: Address;
  ctfExchange: Address;
  settlementVault: Address;
  usdc: Address;
}

/**
 * Network configuration including chain info and contract addresses
 */
export interface NetworkConfig {
  environment: Environment;
  chainId: number;
  chainName: string;
  rpcUrl: string;
  blockExplorerUrl?: string;
  contracts: ContractAddresses;
  confirmations: {
    deposit: number;
    settlement: number;
  };
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationError[];
  warnings: ConfigValidationWarning[];
}

export interface ConfigValidationError {
  field: string;
  message: string;
  value?: string;
}

export interface ConfigValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

// ============ Constants ============

// Chain IDs
export const POLYGON_CHAIN_ID = 137;
export const POLYGON_AMOY_CHAIN_ID = 80002;
export const LOCAL_CHAIN_ID = 31337; // Anvil default

// Zero address constant
export const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000';

// Protocol constants
export const PROTOCOL_FEE_BPS = 200; // 2%
export const MIN_INITIAL_LIQUIDITY = BigInt(10 * 10 ** 6); // 10 USDC (6 decimals)
export const DISPUTE_PERIOD_SECONDS = 24 * 60 * 60; // 24 hours

// Supported chain IDs
export const SUPPORTED_CHAIN_IDS = [POLYGON_CHAIN_ID, POLYGON_AMOY_CHAIN_ID, LOCAL_CHAIN_ID] as const;
export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

// ============ Default Configurations ============

/**
 * Default contract addresses by chain (used when env vars not set)
 */
export const DEFAULT_CONTRACT_ADDRESSES: Record<SupportedChainId, ContractAddresses> = {
  [POLYGON_CHAIN_ID]: {
    marketFactory: ZERO_ADDRESS,
    conditionalTokens: ZERO_ADDRESS,
    orderBook: ZERO_ADDRESS,
    ctfExchange: ZERO_ADDRESS,
    settlementVault: ZERO_ADDRESS,
    usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as Address, // Native USDC on Polygon mainnet
  },
  [POLYGON_AMOY_CHAIN_ID]: {
    marketFactory: ZERO_ADDRESS,
    conditionalTokens: ZERO_ADDRESS,
    orderBook: ZERO_ADDRESS,
    ctfExchange: ZERO_ADDRESS,
    settlementVault: ZERO_ADDRESS,
    usdc: ZERO_ADDRESS,
  },
  [LOCAL_CHAIN_ID]: {
    marketFactory: ZERO_ADDRESS,
    conditionalTokens: ZERO_ADDRESS,
    orderBook: ZERO_ADDRESS,
    ctfExchange: ZERO_ADDRESS,
    settlementVault: ZERO_ADDRESS,
    usdc: ZERO_ADDRESS,
  },
};

/**
 * Default network configurations
 */
export const DEFAULT_NETWORK_CONFIGS: Record<Environment, Omit<NetworkConfig, 'contracts'>> = {
  local: {
    environment: 'local',
    chainId: LOCAL_CHAIN_ID,
    chainName: 'Anvil Local',
    rpcUrl: 'http://127.0.0.1:8545',
    confirmations: {
      deposit: 1,
      settlement: 1,
    },
  },
  testnet: {
    environment: 'testnet',
    chainId: POLYGON_AMOY_CHAIN_ID,
    chainName: 'Polygon Amoy',
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    blockExplorerUrl: 'https://amoy.polygonscan.com',
    confirmations: {
      deposit: 10,
      settlement: 5,
    },
  },
  mainnet: {
    environment: 'mainnet',
    chainId: POLYGON_CHAIN_ID,
    chainName: 'Polygon',
    rpcUrl: 'https://polygon-rpc.com',
    blockExplorerUrl: 'https://polygonscan.com',
    confirmations: {
      deposit: 20,
      settlement: 10,
    },
  },
};

// ============ Validation Functions ============

/**
 * Check if a string is a valid Ethereum address
 */
export function isValidAddress(address: string): address is Address {
  if (typeof address !== 'string') return false;
  if (!address.startsWith('0x')) return false;
  if (address.length !== 42) return false;
  // Check if all characters after 0x are valid hex
  const hexPart = address.slice(2);
  return /^[0-9a-fA-F]{40}$/.test(hexPart);
}

/**
 * Check if an address is the zero address
 */
export function isZeroAddress(address: string): boolean {
  return address.toLowerCase() === ZERO_ADDRESS.toLowerCase();
}

/**
 * Validate contract addresses - checks for zero addresses in production
 */
export function validateContractAddresses(
  addresses: ContractAddresses,
  environment: Environment
): ConfigValidationResult {
  const errors: ConfigValidationError[] = [];
  const warnings: ConfigValidationWarning[] = [];

  const addressFields: (keyof ContractAddresses)[] = [
    'marketFactory',
    'conditionalTokens',
    'orderBook',
    'ctfExchange',
    'settlementVault',
    'usdc',
  ];

  for (const field of addressFields) {
    const value = addresses[field];

    // Check if valid address format
    if (!isValidAddress(value)) {
      errors.push({
        field: `contracts.${field}`,
        message: `Invalid Ethereum address format`,
        value,
      });
      continue;
    }

    // Check for zero addresses in production environments
    if (isZeroAddress(value)) {
      if (environment === 'mainnet' || environment === 'testnet') {
        errors.push({
          field: `contracts.${field}`,
          message: `Zero address not allowed in ${environment} environment`,
          value,
        });
      } else {
        warnings.push({
          field: `contracts.${field}`,
          message: `Zero address detected - contract not deployed`,
          suggestion: `Deploy contracts and update configuration`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a complete network configuration
 */
export function validateConfig(config: NetworkConfig): ConfigValidationResult {
  const errors: ConfigValidationError[] = [];
  const warnings: ConfigValidationWarning[] = [];

  // Validate chain ID
  if (!SUPPORTED_CHAIN_IDS.includes(config.chainId as SupportedChainId)) {
    warnings.push({
      field: 'chainId',
      message: `Chain ID ${config.chainId} is not in the supported list`,
      suggestion: `Supported chains: ${SUPPORTED_CHAIN_IDS.join(', ')}`,
    });
  }

  // Validate RPC URL
  if (!config.rpcUrl || config.rpcUrl.trim() === '') {
    errors.push({
      field: 'rpcUrl',
      message: 'RPC URL is required',
    });
  }

  // Validate contract addresses
  const addressValidation = validateContractAddresses(config.contracts, config.environment);
  errors.push(...addressValidation.errors);
  warnings.push(...addressValidation.warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============ Environment Loading Functions ============

/**
 * Environment variable names for contract addresses
 */
const ENV_VAR_MAPPING = {
  chainId: ['CHAIN_ID', 'VITE_CHAIN_ID'],
  rpcUrl: ['RPC_URL', 'VITE_RPC_URL'],
  marketFactory: ['MARKET_FACTORY_ADDRESS', 'VITE_MARKET_FACTORY_ADDRESS'],
  conditionalTokens: ['CTF_ADDRESS', 'VITE_CTF_ADDRESS', 'CONDITIONAL_TOKENS_ADDRESS'],
  orderBook: ['ORDER_BOOK_ADDRESS', 'VITE_ORDER_BOOK_ADDRESS'],
  ctfExchange: ['EXCHANGE_ADDRESS', 'VITE_EXCHANGE_ADDRESS'],
  settlementVault: ['VAULT_ADDRESS', 'VITE_VAULT_ADDRESS'],
  usdc: ['USDC_ADDRESS', 'VITE_USDC_ADDRESS'],
} as const;

/**
 * Get environment variable value, checking multiple possible names
 */
function getEnvVar(names: readonly string[], env: Record<string, string | undefined>): string | undefined {
  for (const name of names) {
    const value = env[name];
    if (value !== undefined && value !== '') {
      return value;
    }
  }
  return undefined;
}

/**
 * Determine environment from chain ID
 */
export function getEnvironmentFromChainId(chainId: number): Environment {
  switch (chainId) {
    case POLYGON_CHAIN_ID:
      return 'mainnet';
    case POLYGON_AMOY_CHAIN_ID:
      return 'testnet';
    case LOCAL_CHAIN_ID:
    default:
      return 'local';
  }
}

/**
 * Load contract addresses from environment variables
 */
export function loadContractAddressesFromEnv(
  env: Record<string, string | undefined>,
  chainId: SupportedChainId
): ContractAddresses {
  const defaults = DEFAULT_CONTRACT_ADDRESSES[chainId] || DEFAULT_CONTRACT_ADDRESSES[LOCAL_CHAIN_ID];

  return {
    marketFactory: (getEnvVar(ENV_VAR_MAPPING.marketFactory, env) as Address) || defaults.marketFactory,
    conditionalTokens: (getEnvVar(ENV_VAR_MAPPING.conditionalTokens, env) as Address) || defaults.conditionalTokens,
    orderBook: (getEnvVar(ENV_VAR_MAPPING.orderBook, env) as Address) || defaults.orderBook,
    ctfExchange: (getEnvVar(ENV_VAR_MAPPING.ctfExchange, env) as Address) || defaults.ctfExchange,
    settlementVault: (getEnvVar(ENV_VAR_MAPPING.settlementVault, env) as Address) || defaults.settlementVault,
    usdc: (getEnvVar(ENV_VAR_MAPPING.usdc, env) as Address) || defaults.usdc,
  };
}

/**
 * Load complete configuration from environment variables
 * 
 * @param env - Environment variables object (process.env or import.meta.env)
 * @returns NetworkConfig loaded from environment
 */
export function loadConfigFromEnv(env: Record<string, string | undefined> = {}): NetworkConfig {
  // Determine chain ID from env or default to local
  const chainIdStr = getEnvVar(ENV_VAR_MAPPING.chainId, env);
  const chainId = chainIdStr ? parseInt(chainIdStr, 10) : LOCAL_CHAIN_ID;
  
  // Determine environment from chain ID
  const environment = getEnvironmentFromChainId(chainId);
  
  // Get base config for environment
  const baseConfig = DEFAULT_NETWORK_CONFIGS[environment];
  
  // Load contract addresses from env
  const contracts = loadContractAddressesFromEnv(env, chainId as SupportedChainId);
  
  // Override RPC URL if provided
  const rpcUrl = getEnvVar(ENV_VAR_MAPPING.rpcUrl, env) || baseConfig.rpcUrl;

  return {
    ...baseConfig,
    chainId,
    rpcUrl,
    contracts,
  };
}

/**
 * Get configuration for a specific environment
 * Uses defaults with optional env var overrides
 */
export function getConfigForEnvironment(
  environment: Environment,
  env: Record<string, string | undefined> = {}
): NetworkConfig {
  const baseConfig = DEFAULT_NETWORK_CONFIGS[environment];
  const chainId = baseConfig.chainId as SupportedChainId;
  
  // Load contract addresses from env, falling back to defaults
  const contracts = loadContractAddressesFromEnv(env, chainId);
  
  // Override RPC URL if provided
  const rpcUrl = getEnvVar(ENV_VAR_MAPPING.rpcUrl, env) || baseConfig.rpcUrl;

  return {
    ...baseConfig,
    rpcUrl,
    contracts,
  };
}

// ============ Legacy Compatibility ============

/**
 * Contract addresses by chain (legacy format for backwards compatibility)
 */
export const CONTRACT_ADDRESSES = {
  [POLYGON_CHAIN_ID]: DEFAULT_CONTRACT_ADDRESSES[POLYGON_CHAIN_ID],
  [POLYGON_AMOY_CHAIN_ID]: DEFAULT_CONTRACT_ADDRESSES[POLYGON_AMOY_CHAIN_ID],
  [LOCAL_CHAIN_ID]: DEFAULT_CONTRACT_ADDRESSES[LOCAL_CHAIN_ID],
} as const;

/**
 * Check if a chain ID is supported
 */
export function isSupportedChain(chainId: number): chainId is SupportedChainId {
  return SUPPORTED_CHAIN_IDS.includes(chainId as SupportedChainId);
}

/**
 * Get contract addresses for a specific chain (legacy)
 */
export function getContractAddresses(chainId: SupportedChainId): ContractAddresses {
  return DEFAULT_CONTRACT_ADDRESSES[chainId] || DEFAULT_CONTRACT_ADDRESSES[LOCAL_CHAIN_ID];
}

/**
 * Chain configuration for wagmi v2 (legacy)
 */
export const chainConfig = {
  polygon: {
    id: POLYGON_CHAIN_ID,
    name: 'Polygon',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: ['https://polygon-rpc.com'],
      },
      public: {
        http: ['https://polygon-rpc.com'],
      },
    },
    blockExplorers: {
      default: {
        name: 'PolygonScan',
        url: 'https://polygonscan.com',
      },
    },
  },
  polygonAmoy: {
    id: POLYGON_AMOY_CHAIN_ID,
    name: 'Polygon Amoy',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: ['https://rpc-amoy.polygon.technology'],
      },
      public: {
        http: ['https://rpc-amoy.polygon.technology'],
      },
    },
    blockExplorers: {
      default: {
        name: 'PolygonScan',
        url: 'https://amoy.polygonscan.com',
      },
    },
    testnet: true,
  },
  anvil: {
    id: LOCAL_CHAIN_ID,
    name: 'Anvil Local',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: ['http://127.0.0.1:8545'],
      },
      public: {
        http: ['http://127.0.0.1:8545'],
      },
    },
  },
} as const;
