/**
 * Order Signing Utility for CTFExchange
 * 
 * Implements EIP-712 typed data signing for off-chain orders that can be
 * settled on-chain via the CTFExchange contract.
 * 
 * Requirements: 2.1, 2.2
 */

import { type Address, type Hex, hashTypedData, type TypedDataDomain } from 'viem';
import { type SignTypedDataParameters } from 'wagmi/actions';

// ============================================
// Enums matching Solidity contract
// ============================================

export enum Side {
  BUY = 0,
  SELL = 1,
}

export enum SignatureType {
  EOA = 0,
  POLY_PROXY = 1,
  POLY_GNOSIS_SAFE = 2,
}

// ============================================
// Types
// ============================================

/**
 * Order parameters for creating a new order (before signing)
 */
export interface OrderParams {
  marketId: Hex;
  tokenId: bigint;
  side: Side;
  makerAmount: bigint;
  takerAmount: bigint;
  expiration?: bigint;
  feeRateBps?: bigint;
}

/**
 * Unsigned order with all fields populated
 */
export interface UnsignedOrder {
  salt: bigint;
  maker: Address;
  signer: Address;
  taker: Address;
  marketId: Hex;
  tokenId: bigint;
  side: Side;
  makerAmount: bigint;
  takerAmount: bigint;
  expiration: bigint;
  nonce: bigint;
  feeRateBps: bigint;
  sigType: SignatureType;
}

/**
 * Signed order ready for submission
 */
export interface SignedOrder extends UnsignedOrder {
  signature: Hex;
}

/**
 * EIP-712 domain for CTFExchange
 */
export interface CTFExchangeDomain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
}

// ============================================
// Constants
// ============================================

/**
 * EIP-712 domain name (must match contract)
 */
export const DOMAIN_NAME = 'CTFExchange';

/**
 * EIP-712 domain version (must match contract)
 */
export const DOMAIN_VERSION = '1';

/**
 * EIP-712 Order type definition (must match contract ORDER_TYPEHASH)
 */
export const ORDER_TYPES = {
  Order: [
    { name: 'salt', type: 'uint256' },
    { name: 'maker', type: 'address' },
    { name: 'signer', type: 'address' },
    { name: 'taker', type: 'address' },
    { name: 'marketId', type: 'bytes32' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'side', type: 'uint8' },
    { name: 'makerAmount', type: 'uint256' },
    { name: 'takerAmount', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'feeRateBps', type: 'uint256' },
    { name: 'sigType', type: 'uint8' },
  ],
} as const;

/**
 * Default order expiration (24 hours from now)
 */
export const DEFAULT_EXPIRATION_SECONDS = 24n * 60n * 60n;

/**
 * Default fee rate in basis points (0 = no fee)
 */
export const DEFAULT_FEE_RATE_BPS = 0n;

/**
 * Zero address for public orders (any taker)
 */
export const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000';

// ============================================
// Order Signer Class
// ============================================

/**
 * OrderSigner handles EIP-712 order creation and signing for CTFExchange.
 * 
 * Usage:
 * ```typescript
 * const signer = new OrderSigner(chainId, exchangeAddress);
 * const order = signer.createOrder(maker, nonce, params);
 * const hash = signer.hashOrder(order);
 * // Sign using wagmi's signTypedData
 * ```
 */
export class OrderSigner {
  private readonly domain: TypedDataDomain;

  constructor(
    public readonly chainId: number,
    public readonly exchangeAddress: Address,
  ) {
    this.domain = {
      name: DOMAIN_NAME,
      version: DOMAIN_VERSION,
      chainId: BigInt(chainId),
      verifyingContract: exchangeAddress,
    };
  }

  /**
   * Get the EIP-712 domain for this signer
   */
  getDomain(): TypedDataDomain {
    return this.domain;
  }

  /**
   * Get the EIP-712 type definitions
   */
  getTypes(): typeof ORDER_TYPES {
    return ORDER_TYPES;
  }

  /**
   * Generate a random salt for order uniqueness
   */
  generateSalt(): bigint {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''));
  }

  /**
   * Create an unsigned order from parameters
   * 
   * @param maker - The address providing funds (order creator)
   * @param nonce - The user's current nonce for replay protection
   * @param params - Order parameters (marketId, tokenId, side, amounts)
   * @param sigType - Signature type (default: EOA)
   * @returns Unsigned order ready for signing
   */
  createOrder(
    maker: Address,
    nonce: bigint,
    params: OrderParams,
    sigType: SignatureType = SignatureType.EOA,
  ): UnsignedOrder {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const expiration = params.expiration ?? now + DEFAULT_EXPIRATION_SECONDS;

    return {
      salt: this.generateSalt(),
      maker,
      signer: maker, // For EOA, signer is the same as maker
      taker: ZERO_ADDRESS, // Public order (any taker)
      marketId: params.marketId,
      tokenId: params.tokenId,
      side: params.side,
      makerAmount: params.makerAmount,
      takerAmount: params.takerAmount,
      expiration,
      nonce,
      feeRateBps: params.feeRateBps ?? DEFAULT_FEE_RATE_BPS,
      sigType,
    };
  }

  /**
   * Compute the EIP-712 hash of an order
   * 
   * This hash is what gets signed and must match the contract's hashOrder function.
   * 
   * @param order - The order to hash
   * @returns The EIP-712 typed data hash
   */
  hashOrder(order: UnsignedOrder): Hex {
    return hashTypedData({
      domain: this.domain,
      types: ORDER_TYPES,
      primaryType: 'Order',
      message: {
        salt: order.salt,
        maker: order.maker,
        signer: order.signer,
        taker: order.taker,
        marketId: order.marketId,
        tokenId: order.tokenId,
        side: order.side,
        makerAmount: order.makerAmount,
        takerAmount: order.takerAmount,
        expiration: order.expiration,
        nonce: order.nonce,
        feeRateBps: order.feeRateBps,
        sigType: order.sigType,
      },
    });
  }

  /**
   * Get the parameters for wagmi's signTypedData action
   * 
   * @param order - The order to sign
   * @returns Parameters for signTypedData
   */
  getSignTypedDataParams(order: UnsignedOrder): SignTypedDataParameters {
    return {
      domain: this.domain,
      types: ORDER_TYPES,
      primaryType: 'Order',
      message: {
        salt: order.salt,
        maker: order.maker,
        signer: order.signer,
        taker: order.taker,
        marketId: order.marketId,
        tokenId: order.tokenId,
        side: order.side,
        makerAmount: order.makerAmount,
        takerAmount: order.takerAmount,
        expiration: order.expiration,
        nonce: order.nonce,
        feeRateBps: order.feeRateBps,
        sigType: order.sigType,
      },
    };
  }

  /**
   * Create a signed order by attaching a signature to an unsigned order
   * 
   * @param order - The unsigned order
   * @param signature - The EIP-712 signature
   * @returns The signed order
   */
  attachSignature(order: UnsignedOrder, signature: Hex): SignedOrder {
    return {
      ...order,
      signature,
    };
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Calculate the price of an order in normalized units (0-1)
 * 
 * For BUY orders: price = makerAmount / takerAmount (USDC per token)
 * For SELL orders: price = takerAmount / makerAmount (USDC per token)
 * 
 * @param order - The order to calculate price for
 * @returns Price as a number between 0 and 1
 */
export function calculateOrderPrice(order: UnsignedOrder | SignedOrder): number {
  const ONE = 1e18;
  
  if (order.side === Side.BUY) {
    // BUY: paying makerAmount USDC for takerAmount tokens
    if (order.takerAmount === 0n) return 0;
    return Number((order.makerAmount * BigInt(ONE)) / order.takerAmount) / ONE;
  } else {
    // SELL: selling makerAmount tokens for takerAmount USDC
    if (order.makerAmount === 0n) return 0;
    return Number((order.takerAmount * BigInt(ONE)) / order.makerAmount) / ONE;
  }
}

/**
 * Check if an order has expired
 * 
 * @param order - The order to check
 * @returns True if the order has expired
 */
export function isOrderExpired(order: UnsignedOrder | SignedOrder): boolean {
  if (order.expiration === 0n) return false; // No expiration
  const now = BigInt(Math.floor(Date.now() / 1000));
  return order.expiration < now;
}

/**
 * Serialize an order for API submission
 * 
 * Converts bigint fields to strings for JSON serialization.
 * 
 * @param order - The signed order to serialize
 * @returns JSON-serializable order object
 */
export function serializeOrder(order: SignedOrder): Record<string, unknown> {
  return {
    salt: order.salt.toString(),
    maker: order.maker,
    signer: order.signer,
    taker: order.taker,
    marketId: order.marketId,
    tokenId: order.tokenId.toString(),
    side: order.side,
    makerAmount: order.makerAmount.toString(),
    takerAmount: order.takerAmount.toString(),
    expiration: order.expiration.toString(),
    nonce: order.nonce.toString(),
    feeRateBps: order.feeRateBps.toString(),
    sigType: order.sigType,
    signature: order.signature,
  };
}

/**
 * Deserialize an order from API response
 * 
 * Converts string fields back to bigint.
 * 
 * @param data - The serialized order data
 * @returns The signed order with proper types
 */
export function deserializeOrder(data: Record<string, unknown>): SignedOrder {
  return {
    salt: BigInt(data.salt as string),
    maker: data.maker as Address,
    signer: data.signer as Address,
    taker: data.taker as Address,
    marketId: data.marketId as Hex,
    tokenId: BigInt(data.tokenId as string),
    side: data.side as Side,
    makerAmount: BigInt(data.makerAmount as string),
    takerAmount: BigInt(data.takerAmount as string),
    expiration: BigInt(data.expiration as string),
    nonce: BigInt(data.nonce as string),
    feeRateBps: BigInt(data.feeRateBps as string),
    sigType: data.sigType as SignatureType,
    signature: data.signature as Hex,
  };
}
