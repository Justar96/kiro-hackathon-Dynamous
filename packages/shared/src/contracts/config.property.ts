/**
 * Property-based tests for configuration validation
 * 
 * Feature: production-wiring-e2e
 * 
 * Tests the following properties:
 * - Property 1: Configuration Validation - No Zero Addresses
 * - Property 2: Configuration Loading from Environment
 * - Property 3: Address Validation Rejects Invalid Addresses
 * 
 * **Validates: Requirements 1.1, 1.4, 5.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  isValidAddress,
  isZeroAddress,
  validateContractAddresses,
  validateConfig,
  loadConfigFromEnv,
  loadContractAddressesFromEnv,
  getConfigForEnvironment,
  ZERO_ADDRESS,
  LOCAL_CHAIN_ID,
  POLYGON_CHAIN_ID,
  POLYGON_AMOY_CHAIN_ID,
  type ContractAddresses,
  type Environment,
  type NetworkConfig,
} from './config';
import type { Address } from './types';

// ============ Arbitraries (Generators) ============

/**
 * Generate a valid Ethereum address (40 hex chars with 0x prefix)
 */
const validAddressArb = fc.hexaString({ minLength: 40, maxLength: 40 }).map(
  (hex) => `0x${hex}` as Address
);

/**
 * Generate a valid non-zero Ethereum address
 */
const nonZeroAddressArb = validAddressArb.filter(
  (addr) => !isZeroAddress(addr)
);

/**
 * Generate an invalid address (wrong format)
 */
const invalidAddressArb = fc.oneof(
  // Missing 0x prefix
  fc.hexaString({ minLength: 40, maxLength: 40 }),
  // Wrong length (too short)
  fc.hexaString({ minLength: 1, maxLength: 39 }).map((hex) => `0x${hex}`),
  // Wrong length (too long)
  fc.hexaString({ minLength: 41, maxLength: 50 }).map((hex) => `0x${hex}`),
  // Invalid characters
  fc.stringOf(fc.constantFrom('g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'), { minLength: 40, maxLength: 40 }).map((s) => `0x${s}`),
  // Empty string
  fc.constant(''),
  // Just 0x
  fc.constant('0x'),
  // Random string
  fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.startsWith('0x') || s.length !== 42)
);

/**
 * Generate valid contract addresses (all non-zero)
 */
const validContractAddressesArb: fc.Arbitrary<ContractAddresses> = fc.record({
  marketFactory: nonZeroAddressArb,
  conditionalTokens: nonZeroAddressArb,
  orderBook: nonZeroAddressArb,
  ctfExchange: nonZeroAddressArb,
  settlementVault: nonZeroAddressArb,
  usdc: nonZeroAddressArb,
});

/**
 * Generate contract addresses with at least one zero address
 */
const contractAddressesWithZeroArb: fc.Arbitrary<ContractAddresses> = fc.record({
  marketFactory: fc.oneof(nonZeroAddressArb, fc.constant(ZERO_ADDRESS)),
  conditionalTokens: fc.oneof(nonZeroAddressArb, fc.constant(ZERO_ADDRESS)),
  orderBook: fc.oneof(nonZeroAddressArb, fc.constant(ZERO_ADDRESS)),
  ctfExchange: fc.oneof(nonZeroAddressArb, fc.constant(ZERO_ADDRESS)),
  settlementVault: fc.oneof(nonZeroAddressArb, fc.constant(ZERO_ADDRESS)),
  usdc: fc.oneof(nonZeroAddressArb, fc.constant(ZERO_ADDRESS)),
}).filter((addrs) => {
  // Ensure at least one is zero
  return Object.values(addrs).some((addr) => isZeroAddress(addr));
});

/**
 * Generate an environment type
 */
const environmentArb: fc.Arbitrary<Environment> = fc.constantFrom('local', 'testnet', 'mainnet');

/**
 * Generate a production environment (testnet or mainnet)
 */
const productionEnvironmentArb: fc.Arbitrary<Environment> = fc.constantFrom('testnet', 'mainnet');

// ============ Property Tests ============

describe('Feature: production-wiring-e2e - Configuration Properties', () => {
  describe('Property 1: Configuration Validation - No Zero Addresses', () => {
    /**
     * **Property 1: Configuration Validation - No Zero Addresses**
     * 
     * *For any* production configuration (testnet or mainnet), all contract addresses
     * in the Config_Manager SHALL be non-zero addresses.
     * 
     * **Validates: Requirements 1.1**
     */
    it('should reject zero addresses in production environments (testnet/mainnet)', () => {
      fc.assert(
        fc.property(
          contractAddressesWithZeroArb,
          productionEnvironmentArb,
          (addresses, environment) => {
            const result = validateContractAddresses(addresses, environment);
            
            // Count zero addresses
            const zeroCount = Object.values(addresses).filter((addr) => isZeroAddress(addr)).length;
            
            // Should have errors for each zero address in production
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThanOrEqual(zeroCount);
            
            // Each error should mention zero address
            for (const error of result.errors) {
              expect(error.message).toContain('Zero address not allowed');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept all non-zero addresses in any environment', () => {
      fc.assert(
        fc.property(
          validContractAddressesArb,
          environmentArb,
          (addresses, environment) => {
            const result = validateContractAddresses(addresses, environment);
            
            // Should have no errors for valid non-zero addresses
            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow zero addresses in local environment with warnings', () => {
      fc.assert(
        fc.property(
          contractAddressesWithZeroArb,
          (addresses) => {
            const result = validateContractAddresses(addresses, 'local');
            
            // Should be valid (no errors) but have warnings
            expect(result.valid).toBe(true);
            expect(result.warnings.length).toBeGreaterThan(0);
            
            // Warnings should mention zero address
            for (const warning of result.warnings) {
              expect(warning.message).toContain('Zero address detected');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Configuration Loading from Environment', () => {
    /**
     * **Property 2: Configuration Loading from Environment**
     * 
     * *For any* set of valid Ethereum addresses provided via environment variables,
     * the Config_Manager SHALL correctly load and return those exact addresses
     * in the configuration object.
     * 
     * **Validates: Requirements 1.4**
     */
    it('should load exact addresses from environment variables', () => {
      fc.assert(
        fc.property(
          validContractAddressesArb,
          (addresses) => {
            const env: Record<string, string> = {
              CHAIN_ID: String(LOCAL_CHAIN_ID),
              EXCHANGE_ADDRESS: addresses.ctfExchange,
              VAULT_ADDRESS: addresses.settlementVault,
              CTF_ADDRESS: addresses.conditionalTokens,
              USDC_ADDRESS: addresses.usdc,
              MARKET_FACTORY_ADDRESS: addresses.marketFactory,
              ORDER_BOOK_ADDRESS: addresses.orderBook,
            };

            const loaded = loadContractAddressesFromEnv(env, LOCAL_CHAIN_ID);

            // All addresses should match exactly
            expect(loaded.ctfExchange.toLowerCase()).toBe(addresses.ctfExchange.toLowerCase());
            expect(loaded.settlementVault.toLowerCase()).toBe(addresses.settlementVault.toLowerCase());
            expect(loaded.conditionalTokens.toLowerCase()).toBe(addresses.conditionalTokens.toLowerCase());
            expect(loaded.usdc.toLowerCase()).toBe(addresses.usdc.toLowerCase());
            expect(loaded.marketFactory.toLowerCase()).toBe(addresses.marketFactory.toLowerCase());
            expect(loaded.orderBook.toLowerCase()).toBe(addresses.orderBook.toLowerCase());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should load complete config from environment with correct chain ID', () => {
      fc.assert(
        fc.property(
          validContractAddressesArb,
          fc.constantFrom(LOCAL_CHAIN_ID, POLYGON_AMOY_CHAIN_ID, POLYGON_CHAIN_ID),
          (addresses, chainId) => {
            const env: Record<string, string> = {
              CHAIN_ID: String(chainId),
              RPC_URL: 'https://test-rpc.example.com',
              EXCHANGE_ADDRESS: addresses.ctfExchange,
              VAULT_ADDRESS: addresses.settlementVault,
              CTF_ADDRESS: addresses.conditionalTokens,
              USDC_ADDRESS: addresses.usdc,
              MARKET_FACTORY_ADDRESS: addresses.marketFactory,
              ORDER_BOOK_ADDRESS: addresses.orderBook,
            };

            const config = loadConfigFromEnv(env);

            // Chain ID should match
            expect(config.chainId).toBe(chainId);
            
            // RPC URL should be loaded
            expect(config.rpcUrl).toBe('https://test-rpc.example.com');
            
            // Addresses should be loaded
            expect(config.contracts.ctfExchange.toLowerCase()).toBe(addresses.ctfExchange.toLowerCase());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use VITE_ prefixed env vars for frontend compatibility', () => {
      fc.assert(
        fc.property(
          validContractAddressesArb,
          (addresses) => {
            const env: Record<string, string> = {
              VITE_CHAIN_ID: String(LOCAL_CHAIN_ID),
              VITE_EXCHANGE_ADDRESS: addresses.ctfExchange,
              VITE_VAULT_ADDRESS: addresses.settlementVault,
              VITE_CTF_ADDRESS: addresses.conditionalTokens,
              VITE_USDC_ADDRESS: addresses.usdc,
              VITE_MARKET_FACTORY_ADDRESS: addresses.marketFactory,
              VITE_ORDER_BOOK_ADDRESS: addresses.orderBook,
            };

            const loaded = loadContractAddressesFromEnv(env, LOCAL_CHAIN_ID);

            // All addresses should match (VITE_ prefix should work)
            expect(loaded.ctfExchange.toLowerCase()).toBe(addresses.ctfExchange.toLowerCase());
            expect(loaded.settlementVault.toLowerCase()).toBe(addresses.settlementVault.toLowerCase());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return correct environment for each chain ID', () => {
      fc.assert(
        fc.property(
          validContractAddressesArb,
          (addresses) => {
            // Test mainnet
            const mainnetEnv = { CHAIN_ID: String(POLYGON_CHAIN_ID) };
            const mainnetConfig = loadConfigFromEnv(mainnetEnv);
            expect(mainnetConfig.environment).toBe('mainnet');

            // Test testnet
            const testnetEnv = { CHAIN_ID: String(POLYGON_AMOY_CHAIN_ID) };
            const testnetConfig = loadConfigFromEnv(testnetEnv);
            expect(testnetConfig.environment).toBe('testnet');

            // Test local
            const localEnv = { CHAIN_ID: String(LOCAL_CHAIN_ID) };
            const localConfig = loadConfigFromEnv(localEnv);
            expect(localConfig.environment).toBe('local');
          }
        ),
        { numRuns: 10 } // Fewer runs since this is deterministic
      );
    });
  });

  describe('Property 3: Address Validation Rejects Invalid Addresses', () => {
    /**
     * **Property 3: Address Validation Rejects Invalid Addresses**
     * 
     * *For any* string that is not a valid Ethereum address (wrong length,
     * invalid characters, missing 0x prefix), the Config_Manager validation
     * SHALL reject it with an appropriate error.
     * 
     * **Validates: Requirements 5.3**
     */
    it('should reject addresses with invalid format', () => {
      fc.assert(
        fc.property(
          invalidAddressArb,
          (invalidAddress) => {
            const isValid = isValidAddress(invalidAddress);
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept all valid address formats', () => {
      fc.assert(
        fc.property(
          validAddressArb,
          (validAddress) => {
            const isValid = isValidAddress(validAddress);
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify zero addresses', () => {
      fc.assert(
        fc.property(
          nonZeroAddressArb,
          (nonZeroAddress) => {
            expect(isZeroAddress(nonZeroAddress)).toBe(false);
            expect(isZeroAddress(ZERO_ADDRESS)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate complete config and reject invalid addresses', () => {
      // Create a config with an invalid address
      const invalidConfig: NetworkConfig = {
        environment: 'local',
        chainId: LOCAL_CHAIN_ID,
        chainName: 'Test',
        rpcUrl: 'http://localhost:8545',
        contracts: {
          marketFactory: '0xinvalid' as Address, // Invalid!
          conditionalTokens: ZERO_ADDRESS,
          orderBook: ZERO_ADDRESS,
          ctfExchange: ZERO_ADDRESS,
          settlementVault: ZERO_ADDRESS,
          usdc: ZERO_ADDRESS,
        },
        confirmations: {
          deposit: 1,
          settlement: 1,
        },
      };

      const result = validateConfig(invalidConfig);
      
      // Should have at least one error for the invalid address
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'contracts.marketFactory')).toBe(true);
    });

    it('should reject config with empty RPC URL', () => {
      fc.assert(
        fc.property(
          validContractAddressesArb,
          (addresses) => {
            const config: NetworkConfig = {
              environment: 'local',
              chainId: LOCAL_CHAIN_ID,
              chainName: 'Test',
              rpcUrl: '', // Empty!
              contracts: addresses,
              confirmations: {
                deposit: 1,
                settlement: 1,
              },
            };

            const result = validateConfig(config);
            
            // Should have error for empty RPC URL
            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.field === 'rpcUrl')).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('getConfigForEnvironment', () => {
    it('should return correct defaults for each environment', () => {
      fc.assert(
        fc.property(
          environmentArb,
          (environment) => {
            const config = getConfigForEnvironment(environment);
            
            expect(config.environment).toBe(environment);
            
            // Check chain ID matches environment
            if (environment === 'mainnet') {
              expect(config.chainId).toBe(POLYGON_CHAIN_ID);
            } else if (environment === 'testnet') {
              expect(config.chainId).toBe(POLYGON_AMOY_CHAIN_ID);
            } else {
              expect(config.chainId).toBe(LOCAL_CHAIN_ID);
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
