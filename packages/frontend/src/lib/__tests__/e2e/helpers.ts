/**
 * E2E Test Helpers
 *
 * Utility functions for common E2E test operations like deposits,
 * order submission, settlement, and withdrawals.
 *
 * Requirements: 6.1, 6.2, 6.3
 */

import {
  type Address,
  type Hex,
  type TransactionReceipt,
  encodeFunctionData,
  parseUnits,
  erc20Abi,
} from 'viem';
import type { E2ETestContext } from './setup';
import type { TestWallet, OrderStruct } from './wallets';
import { signOrder, createOrder, generateSalt } from './wallets';

// ============================================
// Types
// ============================================

export interface OrderParams {
  /** Token ID to trade */
  tokenId: bigint;
  /** Side: 0 = BUY, 1 = SELL */
  side: number;
  /** Price in basis points (e.g., 6000 = 60%) */
  priceBps: number;
  /** Amount of tokens to trade */
  amount: bigint;
  /** Market ID (hex string) */
  marketId: string;
  /** Expiration timestamp (optional, defaults to 1 hour from now) */
  expiration?: bigint;
  /** Fee rate in basis points (optional, defaults to 0) */
  feeRateBps?: bigint;
}

export interface OrderResult {
  /** Order ID assigned by backend */
  orderId: string;
  /** Order status */
  status: 'accepted' | 'rejected';
  /** Trades executed (if any) */
  trades: Array<{
    id: string;
    amount: string;
    price: string;
    matchType: string;
  }>;
  /** Error message (if rejected) */
  error?: string;
  /** Error code (if rejected) */
  errorCode?: string;
}

export interface OrderBook {
  marketId: string;
  tokenId: string;
  bids: Array<{
    id: string;
    price: string;
    quantity: string;
    maker: string;
  }>;
  asks: Array<{
    id: string;
    price: string;
    quantity: string;
    maker: string;
  }>;
  timestamp: number;
}

export interface SettlementBatch {
  epochId: number;
  merkleRoot: string;
  entries: number;
  totalAmount: string;
}

export interface WithdrawalProof {
  epochId: number;
  address: string;
  amount: string;
  proof: string[];
  merkleRoot: string;
}

// ============================================
// Contract ABIs (minimal)
// ============================================

const settlementVaultAbi = [
  {
    type: 'function',
    name: 'deposit',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claim',
    inputs: [
      { name: 'epochId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'proof', type: 'bytes32[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'deposits',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// ============================================
// Deposit Helpers
// ============================================

/**
 * Approve USDC spending for the vault
 */
export async function approveUsdc(
  context: E2ETestContext,
  wallet: TestWallet,
  amount: bigint
): Promise<TransactionReceipt> {
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [context.contracts.settlementVault, amount],
  });

  const txHash = await wallet.sendTransaction({
    to: context.contracts.usdc,
    data,
  });

  return wallet.waitForTransaction(txHash);
}

/**
 * Deposit USDC to the settlement vault
 */
export async function deposit(
  context: E2ETestContext,
  wallet: TestWallet,
  amount: bigint
): Promise<TransactionReceipt> {
  // First approve
  await approveUsdc(context, wallet, amount);

  // Then deposit
  const data = encodeFunctionData({
    abi: settlementVaultAbi,
    functionName: 'deposit',
    args: [amount],
  });

  const txHash = await wallet.sendTransaction({
    to: context.contracts.settlementVault,
    data,
  });

  return wallet.waitForTransaction(txHash);
}

/**
 * Deposit USDC and wait for indexer to credit balance
 */
export async function depositAndWaitForCredit(
  context: E2ETestContext,
  wallet: TestWallet,
  amount: bigint,
  confirmations: number = 1
): Promise<TransactionReceipt> {
  const receipt = await deposit(context, wallet, amount);

  // Mine blocks for confirmations
  if (confirmations > 1) {
    await context.anvil.mineBlocks(confirmations);
  }

  // Wait a bit for indexer to process
  await new Promise((resolve) => setTimeout(resolve, 500));

  return receipt;
}

// ============================================
// Order Helpers
// ============================================

/**
 * Submit a signed order to the backend
 */
export async function submitOrder(
  context: E2ETestContext,
  wallet: TestWallet,
  params: OrderParams
): Promise<OrderResult> {
  // Calculate maker/taker amounts from price
  // Price is in basis points (e.g., 6000 = 60%)
  // For BUY: makerAmount = price * amount / 10000, takerAmount = amount
  // For SELL: makerAmount = amount, takerAmount = price * amount / 10000
  const SCALE = 10000n;
  const priceBps = BigInt(params.priceBps);

  let makerAmount: bigint;
  let takerAmount: bigint;

  if (params.side === 0) {
    // BUY: paying USDC for tokens
    makerAmount = (priceBps * params.amount) / SCALE;
    takerAmount = params.amount;
  } else {
    // SELL: selling tokens for USDC
    makerAmount = params.amount;
    takerAmount = (priceBps * params.amount) / SCALE;
  }

  // Create order struct
  const order = createOrder({
    maker: wallet.address,
    tokenId: params.tokenId,
    makerAmount,
    takerAmount,
    side: params.side,
    expiration: params.expiration,
    feeRateBps: params.feeRateBps,
  });

  // Sign the order
  const signature = await signOrder(
    wallet,
    order,
    context.chainId,
    context.contracts.ctfExchange
  );

  // Submit to backend
  const response = await fetch(`${context.backendUrl}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      salt: order.salt.toString(),
      maker: order.maker,
      signer: order.signer,
      taker: order.taker,
      marketId: params.marketId,
      tokenId: order.tokenId.toString(),
      side: order.side,
      makerAmount: order.makerAmount.toString(),
      takerAmount: order.takerAmount.toString(),
      expiration: order.expiration.toString(),
      nonce: order.nonce.toString(),
      feeRateBps: order.feeRateBps.toString(),
      sigType: order.signatureType,
      signature,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    return {
      orderId: '',
      status: 'rejected',
      trades: [],
      error: result.error,
      errorCode: result.errorCode,
    };
  }

  return {
    orderId: result.orderId,
    status: result.status || 'accepted',
    trades: result.trades || [],
  };
}

/**
 * Cancel an order
 */
export async function cancelOrder(
  context: E2ETestContext,
  wallet: TestWallet,
  orderId: string
): Promise<boolean> {
  const response = await fetch(`${context.backendUrl}/api/orders/${orderId}`, {
    method: 'DELETE',
    headers: {
      'X-Maker-Address': wallet.address,
    },
  });

  return response.ok;
}

// ============================================
// Order Book Helpers
// ============================================

/**
 * Get the current order book
 */
export async function getOrderBook(
  context: E2ETestContext,
  marketId: string,
  tokenId: bigint,
  depth: number = 10
): Promise<OrderBook> {
  const response = await fetch(
    `${context.backendUrl}/api/orderbook/${marketId}/${tokenId}?depth=${depth}`
  );

  if (!response.ok) {
    throw new Error(`Failed to get order book: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Wait for order book to contain a specific order
 */
export async function waitForOrderBook(
  context: E2ETestContext,
  marketId: string,
  tokenId: bigint,
  predicate: (orderBook: OrderBook) => boolean,
  timeoutMs: number = 5000
): Promise<OrderBook> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const orderBook = await getOrderBook(context, marketId, tokenId);
    if (predicate(orderBook)) {
      return orderBook;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Order book condition not met within ${timeoutMs}ms`);
}

/**
 * Wait for order book to have at least one bid
 */
export async function waitForBid(
  context: E2ETestContext,
  marketId: string,
  tokenId: bigint,
  timeoutMs: number = 5000
): Promise<OrderBook> {
  return waitForOrderBook(
    context,
    marketId,
    tokenId,
    (ob) => ob.bids.length > 0,
    timeoutMs
  );
}

/**
 * Wait for order book to have at least one ask
 */
export async function waitForAsk(
  context: E2ETestContext,
  marketId: string,
  tokenId: bigint,
  timeoutMs: number = 5000
): Promise<OrderBook> {
  return waitForOrderBook(
    context,
    marketId,
    tokenId,
    (ob) => ob.asks.length > 0,
    timeoutMs
  );
}

// ============================================
// Settlement Helpers
// ============================================

/**
 * Trigger settlement batch creation
 */
export async function triggerSettlement(
  context: E2ETestContext
): Promise<SettlementBatch> {
  const response = await fetch(`${context.backendUrl}/api/settlement/batch`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to trigger settlement: ${error.error}`);
  }

  return response.json();
}

/**
 * Get settlement epochs
 */
export async function getSettlementEpochs(
  context: E2ETestContext,
  limit: number = 10
): Promise<{
  currentEpoch: number;
  epochs: Array<{
    epochId: number;
    merkleRoot: string;
    tradeCount: number;
    status: string;
    timestamp: number;
  }>;
}> {
  const response = await fetch(
    `${context.backendUrl}/api/settlement/epochs?limit=${limit}`
  );

  if (!response.ok) {
    throw new Error(`Failed to get settlement epochs: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get withdrawal proof for an address
 */
export async function getWithdrawalProof(
  context: E2ETestContext,
  epochId: number,
  address: Address
): Promise<WithdrawalProof> {
  const response = await fetch(
    `${context.backendUrl}/api/settlement/proof/${epochId}/${address}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get withdrawal proof: ${error.error}`);
  }

  return response.json();
}

// ============================================
// Withdrawal Helpers
// ============================================

/**
 * Claim withdrawal using Merkle proof
 */
export async function claimWithdrawal(
  context: E2ETestContext,
  wallet: TestWallet,
  epochId: number
): Promise<TransactionReceipt> {
  // Get proof from backend
  const proof = await getWithdrawalProof(context, epochId, wallet.address);

  // Call claim on vault
  const data = encodeFunctionData({
    abi: settlementVaultAbi,
    functionName: 'claim',
    args: [
      BigInt(epochId),
      BigInt(proof.amount),
      proof.proof as Hex[],
    ],
  });

  const txHash = await wallet.sendTransaction({
    to: context.contracts.settlementVault,
    data,
  });

  return wallet.waitForTransaction(txHash);
}

// ============================================
// Balance Helpers
// ============================================

/**
 * Get USDC balance for an address
 */
export async function getUsdcBalance(
  context: E2ETestContext,
  address: Address
): Promise<bigint> {
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address],
  });

  const result = await context.wallets.deployer.publicClient.call({
    to: context.contracts.usdc,
    data,
  });

  if (!result.data) {
    return 0n;
  }

  return BigInt(result.data);
}

/**
 * Get vault deposit balance for an address
 */
export async function getVaultBalance(
  context: E2ETestContext,
  address: Address
): Promise<bigint> {
  const data = encodeFunctionData({
    abi: settlementVaultAbi,
    functionName: 'deposits',
    args: [address],
  });

  const result = await context.wallets.deployer.publicClient.call({
    to: context.contracts.settlementVault,
    data,
  });

  if (!result.data) {
    return 0n;
  }

  return BigInt(result.data);
}

/**
 * Get off-chain balance from backend
 */
export async function getOffChainBalance(
  context: E2ETestContext,
  address: Address,
  tokenId?: bigint
): Promise<{
  available: bigint;
  locked: bigint;
  total: bigint;
}> {
  const url = tokenId
    ? `${context.backendUrl}/api/balances/${address}/${tokenId}`
    : `${context.backendUrl}/api/balances/${address}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to get balance: ${response.statusText}`);
  }

  const data = await response.json();

  if (tokenId) {
    return {
      available: BigInt(data.available),
      locked: BigInt(data.locked),
      total: BigInt(data.total),
    };
  }

  // Return USDC balance (token ID 0 or first balance)
  const balances = data.balances || {};
  const firstBalance = Object.values(balances)[0] as {
    available: string;
    locked: string;
    total: string;
  } | undefined;

  if (!firstBalance) {
    return { available: 0n, locked: 0n, total: 0n };
  }

  return {
    available: BigInt(firstBalance.available),
    locked: BigInt(firstBalance.locked),
    total: BigInt(firstBalance.total),
  };
}

// ============================================
// Mining Helpers
// ============================================

/**
 * Mine blocks on Anvil
 */
export async function mineBlocks(
  context: E2ETestContext,
  count: number
): Promise<void> {
  await context.anvil.mineBlocks(count);
}

/**
 * Advance time on Anvil
 */
export async function advanceTime(
  context: E2ETestContext,
  seconds: number
): Promise<void> {
  await context.anvil.advanceTime(seconds);
}

// ============================================
// Utility Helpers
// ============================================

/**
 * Parse USDC amount (6 decimals)
 */
export function parseUsdc(amount: string | number): bigint {
  return parseUnits(amount.toString(), 6);
}

/**
 * Format USDC amount (6 decimals)
 */
export function formatUsdc(amount: bigint): string {
  const divisor = 10n ** 6n;
  const whole = amount / divisor;
  const fraction = amount % divisor;
  return `${whole}.${fraction.toString().padStart(6, '0')}`;
}

/**
 * Generate a random market ID
 */
export function generateMarketId(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')) as Hex;
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Condition not met within ${timeoutMs}ms`);
}
