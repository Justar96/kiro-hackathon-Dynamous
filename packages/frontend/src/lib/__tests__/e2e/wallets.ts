/**
 * Test Wallet Utilities for E2E Tests
 *
 * Provides test wallets with known private keys and EIP-712 signing capabilities
 * for end-to-end testing of the trading system.
 *
 * Requirements: 6.3
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  type Address,
  type Hex,
  type WalletClient,
  type PublicClient,
  type TransactionReceipt,
  type Chain,
  parseEther,
} from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

// ============================================
// Types
// ============================================

export interface TestWallet {
  /** Wallet address */
  address: Address;
  /** Private key (hex string with 0x prefix) */
  privateKey: Hex;
  /** The underlying viem account */
  account: PrivateKeyAccount;
  /** Wallet client for signing transactions */
  walletClient: WalletClient;
  /** Public client for reading blockchain state */
  publicClient: PublicClient;
  /** Sign EIP-712 typed data */
  signTypedData: <T extends Record<string, unknown>>(params: SignTypedDataParams<T>) => Promise<Hex>;
  /** Send a transaction */
  sendTransaction: (params: SendTransactionParams) => Promise<Hex>;
  /** Wait for a transaction receipt */
  waitForTransaction: (hash: Hex) => Promise<TransactionReceipt>;
  /** Get ETH balance */
  getBalance: () => Promise<bigint>;
}

export interface SignTypedDataParams<T extends Record<string, unknown>> {
  /** EIP-712 domain */
  domain: {
    name?: string;
    version?: string;
    chainId?: number;
    verifyingContract?: Address;
    salt?: Hex;
  };
  /** Type definitions */
  types: Record<string, Array<{ name: string; type: string }>>;
  /** Primary type name */
  primaryType: string;
  /** Message to sign */
  message: T;
}

export interface SendTransactionParams {
  /** Recipient address */
  to: Address;
  /** Value in wei */
  value?: bigint;
  /** Transaction data */
  data?: Hex;
  /** Gas limit */
  gas?: bigint;
  /** Gas price */
  gasPrice?: bigint;
  /** Max fee per gas (EIP-1559) */
  maxFeePerGas?: bigint;
  /** Max priority fee per gas (EIP-1559) */
  maxPriorityFeePerGas?: bigint;
}

export interface TestWalletConfig {
  /** RPC URL to connect to */
  rpcUrl: string;
  /** Chain ID */
  chainId?: number;
}

// ============================================
// Anvil Default Test Accounts
// ============================================

/**
 * Anvil's default test accounts derived from the standard mnemonic:
 * "test test test test test test test test test test test junk"
 */
export const ANVIL_ACCOUNTS = {
  deployer: {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address,
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex,
  },
  alice: {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address,
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as Hex,
  },
  bob: {
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as Address,
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' as Hex,
  },
  charlie: {
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906' as Address,
    privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6' as Hex,
  },
  operator: {
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65' as Address,
    privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a' as Hex,
  },
} as const;

// ============================================
// Implementation
// ============================================

/**
 * Create a test wallet from a private key
 *
 * @param privateKey - Private key (hex string with 0x prefix)
 * @param config - Wallet configuration
 * @returns TestWallet instance
 */
export function createTestWallet(privateKey: Hex, config: TestWalletConfig): TestWallet {
  const account = privateKeyToAccount(privateKey);
  const chainId = config.chainId ?? 31337;

  const chain: Chain = {
    ...foundry,
    id: chainId,
    rpcUrls: {
      default: { http: [config.rpcUrl] },
    },
  };

  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(config.rpcUrl),
  });

  /**
   * Sign EIP-712 typed data
   */
  const signTypedData = async <T extends Record<string, unknown>>(
    params: SignTypedDataParams<T>
  ): Promise<Hex> => {
    return walletClient.signTypedData({
      account,
      domain: params.domain,
      types: params.types,
      primaryType: params.primaryType,
      message: params.message,
    });
  };

  /**
   * Send a transaction
   */
  const sendTransaction = async (params: SendTransactionParams): Promise<Hex> => {
    return walletClient.sendTransaction({
      account,
      to: params.to,
      value: params.value,
      data: params.data,
      gas: params.gas,
      gasPrice: params.gasPrice,
      maxFeePerGas: params.maxFeePerGas,
      maxPriorityFeePerGas: params.maxPriorityFeePerGas,
    });
  };

  /**
   * Wait for a transaction receipt
   */
  const waitForTransaction = async (hash: Hex): Promise<TransactionReceipt> => {
    return publicClient.waitForTransactionReceipt({ hash });
  };

  /**
   * Get ETH balance
   */
  const getBalance = async (): Promise<bigint> => {
    return publicClient.getBalance({ address: account.address });
  };

  return {
    address: account.address,
    privateKey,
    account,
    walletClient,
    publicClient,
    signTypedData,
    sendTransaction,
    waitForTransaction,
    getBalance,
  };
}

/**
 * Create all standard test wallets for E2E testing
 *
 * @param config - Wallet configuration
 * @returns Object with named test wallets
 */
export function createTestWallets(config: TestWalletConfig): {
  deployer: TestWallet;
  alice: TestWallet;
  bob: TestWallet;
  charlie: TestWallet;
  operator: TestWallet;
} {
  return {
    deployer: createTestWallet(ANVIL_ACCOUNTS.deployer.privateKey, config),
    alice: createTestWallet(ANVIL_ACCOUNTS.alice.privateKey, config),
    bob: createTestWallet(ANVIL_ACCOUNTS.bob.privateKey, config),
    charlie: createTestWallet(ANVIL_ACCOUNTS.charlie.privateKey, config),
    operator: createTestWallet(ANVIL_ACCOUNTS.operator.privateKey, config),
  };
}

// ============================================
// EIP-712 Order Signing
// ============================================

/**
 * Order structure for EIP-712 signing
 */
export interface OrderStruct {
  salt: bigint;
  maker: Address;
  signer: Address;
  taker: Address;
  tokenId: bigint;
  makerAmount: bigint;
  takerAmount: bigint;
  expiration: bigint;
  nonce: bigint;
  feeRateBps: bigint;
  side: number;
  signatureType: number;
}

/**
 * EIP-712 domain for CTFExchange orders
 */
export function getOrderDomain(chainId: number, exchangeAddress: Address) {
  return {
    name: 'CTFExchange',
    version: '1',
    chainId,
    verifyingContract: exchangeAddress,
  };
}

/**
 * EIP-712 types for CTFExchange orders
 */
export const ORDER_TYPES = {
  Order: [
    { name: 'salt', type: 'uint256' },
    { name: 'maker', type: 'address' },
    { name: 'signer', type: 'address' },
    { name: 'taker', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'makerAmount', type: 'uint256' },
    { name: 'takerAmount', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'feeRateBps', type: 'uint256' },
    { name: 'side', type: 'uint8' },
    { name: 'signatureType', type: 'uint8' },
  ],
} as const;

/**
 * Sign an order using EIP-712
 *
 * @param wallet - Test wallet to sign with
 * @param order - Order to sign
 * @param chainId - Chain ID
 * @param exchangeAddress - CTFExchange contract address
 * @returns Signature hex string
 */
export async function signOrder(
  wallet: TestWallet,
  order: OrderStruct,
  chainId: number,
  exchangeAddress: Address
): Promise<Hex> {
  const domain = getOrderDomain(chainId, exchangeAddress);

  return wallet.signTypedData({
    domain,
    types: ORDER_TYPES,
    primaryType: 'Order',
    message: {
      salt: order.salt,
      maker: order.maker,
      signer: order.signer,
      taker: order.taker,
      tokenId: order.tokenId,
      makerAmount: order.makerAmount,
      takerAmount: order.takerAmount,
      expiration: order.expiration,
      nonce: order.nonce,
      feeRateBps: order.feeRateBps,
      side: order.side,
      signatureType: order.signatureType,
    },
  });
}

/**
 * Generate a random salt for orders
 */
export function generateSalt(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''));
}

/**
 * Create an order with default values
 */
export function createOrder(params: {
  maker: Address;
  tokenId: bigint;
  makerAmount: bigint;
  takerAmount: bigint;
  side: number;
  marketId?: string;
  expiration?: bigint;
  nonce?: bigint;
  feeRateBps?: bigint;
}): OrderStruct {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const oneHour = 3600n;

  return {
    salt: generateSalt(),
    maker: params.maker,
    signer: params.maker,
    taker: '0x0000000000000000000000000000000000000000' as Address, // Any taker
    tokenId: params.tokenId,
    makerAmount: params.makerAmount,
    takerAmount: params.takerAmount,
    expiration: params.expiration ?? now + oneHour,
    nonce: params.nonce ?? 0n,
    feeRateBps: params.feeRateBps ?? 0n,
    side: params.side,
    signatureType: 0, // EOA
  };
}
