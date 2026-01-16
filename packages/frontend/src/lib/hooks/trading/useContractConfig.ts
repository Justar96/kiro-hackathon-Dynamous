/**
 * useContractConfig Hook
 *
 * Hook for checking contract configuration status.
 * Validates that required contract addresses are configured.
 *
 * Requirements: 1.3, 5.4
 */

import { useMemo } from 'react';
import { type Address } from 'viem';

// ============================================
// Types
// ============================================

export interface ContractConfigStatus {
  /** Whether all required contracts are configured */
  isConfigured: boolean;
  /** List of missing contract address names */
  missingAddresses: string[];
  /** List of configuration errors */
  errors: string[];
  /** Individual contract configuration status */
  contracts: {
    exchange: { address: Address; configured: boolean };
    vault: { address: Address; configured: boolean };
    usdc: { address: Address; configured: boolean };
    conditionalTokens: { address: Address; configured: boolean };
    marketFactory: { address: Address; configured: boolean };
  };
}

// ============================================
// Constants
// ============================================

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

// Required contracts for trading functionality
const REQUIRED_CONTRACTS = ['exchange', 'vault', 'usdc'] as const;

// ============================================
// Helper Functions
// ============================================

/**
 * Get contract address from environment
 */
function getEnvAddress(envVar: string): Address {
  const value = import.meta.env[envVar];
  if (value && typeof value === 'string' && value !== ZERO_ADDRESS) {
    return value as Address;
  }
  return ZERO_ADDRESS;
}

/**
 * Check if an address is configured (not zero address)
 */
function isAddressConfigured(address: Address): boolean {
  return address !== ZERO_ADDRESS;
}

/**
 * Validate address format
 */
function isValidAddressFormat(address: string): boolean {
  if (!address.startsWith('0x')) return false;
  if (address.length !== 42) return false;
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

// ============================================
// Hook Implementation
// ============================================

/**
 * Hook for checking contract configuration status
 *
 * @returns Contract configuration status
 */
export function useContractConfig(): ContractConfigStatus {
  return useMemo(() => {
    const missingAddresses: string[] = [];
    const errors: string[] = [];

    // Get all contract addresses
    const exchangeAddress = getEnvAddress('VITE_EXCHANGE_ADDRESS');
    const vaultAddress = getEnvAddress('VITE_VAULT_ADDRESS');
    const usdcAddress = getEnvAddress('VITE_USDC_ADDRESS');
    const ctfAddress = getEnvAddress('VITE_CTF_ADDRESS');
    const marketFactoryAddress = getEnvAddress('VITE_MARKET_FACTORY_ADDRESS');

    // Build contracts status
    const contracts = {
      exchange: {
        address: exchangeAddress,
        configured: isAddressConfigured(exchangeAddress),
      },
      vault: {
        address: vaultAddress,
        configured: isAddressConfigured(vaultAddress),
      },
      usdc: {
        address: usdcAddress,
        configured: isAddressConfigured(usdcAddress),
      },
      conditionalTokens: {
        address: ctfAddress,
        configured: isAddressConfigured(ctfAddress),
      },
      marketFactory: {
        address: marketFactoryAddress,
        configured: isAddressConfigured(marketFactoryAddress),
      },
    };

    // Check required contracts
    for (const contractName of REQUIRED_CONTRACTS) {
      const contract = contracts[contractName];
      if (!contract.configured) {
        missingAddresses.push(contractName);
      }
    }

    // Validate address formats for configured addresses
    const allAddresses = [
      { name: 'exchange', address: exchangeAddress },
      { name: 'vault', address: vaultAddress },
      { name: 'usdc', address: usdcAddress },
      { name: 'conditionalTokens', address: ctfAddress },
      { name: 'marketFactory', address: marketFactoryAddress },
    ];

    for (const { name, address } of allAddresses) {
      if (address !== ZERO_ADDRESS && !isValidAddressFormat(address)) {
        errors.push(`Invalid address format for ${name}: ${address}`);
      }
    }

    // Check for environment-specific issues
    const chainId = import.meta.env.VITE_CHAIN_ID;
    if (chainId) {
      const parsedChainId = parseInt(chainId, 10);
      if (isNaN(parsedChainId)) {
        errors.push(`Invalid chain ID: ${chainId}`);
      }
    }

    const isConfigured = missingAddresses.length === 0 && errors.length === 0;

    return {
      isConfigured,
      missingAddresses,
      errors,
      contracts,
    };
  }, []);
}

/**
 * Hook for checking if trading is available
 * Returns true only if all required contracts are configured
 */
export function useTradingAvailable(): boolean {
  const config = useContractConfig();
  return config.isConfigured;
}

export default useContractConfig;
