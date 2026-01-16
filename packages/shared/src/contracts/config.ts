/**
 * Contract configuration for on-chain settlement
 * Contains contract addresses for different networks and chain configuration
 */

// Chain IDs
export const POLYGON_CHAIN_ID = 137;
export const POLYGON_AMOY_CHAIN_ID = 80002; // Polygon Amoy testnet (Mumbai is deprecated)

// Contract addresses by chain
export const CONTRACT_ADDRESSES = {
  [POLYGON_CHAIN_ID]: {
    marketFactory: '0x0000000000000000000000000000000000000000' as `0x${string}`, // To be deployed
    conditionalTokens: '0x0000000000000000000000000000000000000000' as `0x${string}`, // To be deployed
    orderBook: '0x0000000000000000000000000000000000000000' as `0x${string}`, // To be deployed
    ctfExchange: '0x0000000000000000000000000000000000000000' as `0x${string}`, // To be deployed
    settlementVault: '0x0000000000000000000000000000000000000000' as `0x${string}`, // To be deployed
    usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`, // Native USDC on Polygon mainnet
  },
  [POLYGON_AMOY_CHAIN_ID]: {
    marketFactory: '0x0000000000000000000000000000000000000000' as `0x${string}`, // To be deployed
    conditionalTokens: '0x0000000000000000000000000000000000000000' as `0x${string}`, // To be deployed
    orderBook: '0x0000000000000000000000000000000000000000' as `0x${string}`, // To be deployed
    ctfExchange: '0x0000000000000000000000000000000000000000' as `0x${string}`, // To be deployed
    settlementVault: '0x0000000000000000000000000000000000000000' as `0x${string}`, // To be deployed
    usdc: '0x0000000000000000000000000000000000000000' as `0x${string}`, // Test USDC on Amoy (to be deployed)
  },
} as const;

// Protocol constants
export const PROTOCOL_FEE_BPS = 200; // 2%
export const MIN_INITIAL_LIQUIDITY = BigInt(10 * 10 ** 6); // 10 USDC (6 decimals)
export const DISPUTE_PERIOD_SECONDS = 24 * 60 * 60; // 24 hours

// Supported chain IDs
export const SUPPORTED_CHAIN_IDS = [POLYGON_CHAIN_ID, POLYGON_AMOY_CHAIN_ID] as const;
export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

/**
 * Check if a chain ID is supported
 */
export function isSupportedChain(chainId: number): chainId is SupportedChainId {
  return SUPPORTED_CHAIN_IDS.includes(chainId as SupportedChainId);
}

/**
 * Get contract addresses for a specific chain
 */
export function getContractAddresses(chainId: SupportedChainId) {
  return CONTRACT_ADDRESSES[chainId];
}

/**
 * Chain configuration for wagmi v2
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
} as const;
