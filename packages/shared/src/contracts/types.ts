/**
 * TypeScript types for on-chain settlement contracts
 * These types are derived from the contract ABIs and provide type safety for frontend interactions
 */

// Market State enum (matches IMarket.State in Solidity)
export enum MarketState {
  ACTIVE = 0,
  PENDING_RESOLUTION = 1,
  DISPUTED = 2,
  RESOLVED = 3,
}

// Market Outcome enum (matches IMarket.Outcome in Solidity)
export enum MarketOutcome {
  UNRESOLVED = 0,
  YES = 1,
  NO = 2,
  INVALID = 3,
}

// Order Side enum (matches IOrderBook.Side in Solidity)
export enum OrderSide {
  BUY = 0,
  SELL = 1,
}

// Token type for frontend display
export type TokenType = 'YES' | 'NO';

// Address type
export type Address = `0x${string}`;

// Bytes32 type
export type Bytes32 = `0x${string}`;

/**
 * Market data structure
 */
export interface Market {
  address: Address;
  questionId: Bytes32;
  question: string;
  resolutionCriteria: string;
  endTime: Date;
  state: MarketState;
  outcome: MarketOutcome;
  yesTokenId: bigint;
  noTokenId: bigint;
  conditionId: Bytes32;
}

/**
 * Order data structure (matches IOrderBook.Order in Solidity)
 */
export interface Order {
  id: bigint;
  maker: Address;
  marketId: Bytes32;
  tokenId: bigint;
  side: OrderSide;
  price: bigint; // In basis points (1-9999)
  quantity: bigint;
  filled: bigint;
  timestamp: bigint;
  active: boolean;
}

/**
 * Order book level for display
 */
export interface OrderBookLevel {
  price: number; // 0.01 - 0.99
  quantity: bigint;
  orderCount: number;
}

/**
 * Order book state
 */
export interface OrderBookState {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  midPrice: number | null;
  spread: number | null;
  lastTradePrice: number | null;
}

/**
 * User position in a market
 */
export interface Position {
  marketAddress: Address;
  marketQuestion: string;
  yesBalance: bigint;
  noBalance: bigint;
  avgEntryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  marketState: MarketState;
}

/**
 * Open order for display
 */
export interface OpenOrder {
  orderId: bigint;
  marketAddress: Address;
  tokenType: TokenType;
  side: OrderSide;
  price: number;
  quantity: bigint;
  filled: bigint;
  timestamp: Date;
}

/**
 * Trade history entry
 */
export interface TradeHistory {
  id: string;
  marketAddress: Address;
  tokenType: TokenType;
  side: OrderSide;
  price: number;
  quantity: bigint;
  timestamp: Date;
  txHash: Address;
}

/**
 * Market creation parameters
 */
export interface CreateMarketParams {
  question: string;
  resolutionCriteria: string;
  endTime: bigint;
  initialLiquidity: bigint;
}

/**
 * Place order parameters
 */
export interface PlaceOrderParams {
  marketId: Bytes32;
  tokenId: bigint;
  side: OrderSide;
  price: bigint;
  quantity: bigint;
}

// ============================================
// Utility functions for price/amount conversions
// ============================================

export const USDC_DECIMALS = 6;
export const BPS_DENOMINATOR = 10000;

/**
 * Convert a decimal price (0.01-0.99) to basis points (100-9900)
 */
export const priceToBasisPoints = (price: number): bigint =>
  BigInt(Math.round(price * BPS_DENOMINATOR));

/**
 * Convert basis points (100-9900) to decimal price (0.01-0.99)
 */
export const basisPointsToPrice = (bp: bigint): number =>
  Number(bp) / BPS_DENOMINATOR;

/**
 * Convert a human-readable USDC amount to contract units (6 decimals)
 */
export const toUsdcUnits = (amount: number): bigint =>
  BigInt(Math.round(amount * 10 ** USDC_DECIMALS));

/**
 * Convert contract units (6 decimals) to human-readable USDC amount
 */
export const fromUsdcUnits = (units: bigint): number =>
  Number(units) / 10 ** USDC_DECIMALS;

/**
 * Calculate implied probability from price
 */
export const priceToImpliedProbability = (price: number): number =>
  Math.round(price * 100);

/**
 * Calculate mid-price from best bid and ask
 */
export const calculateMidPrice = (
  bestBid: number | null,
  bestAsk: number | null
): number | null => {
  if (bestBid === null || bestAsk === null) return null;
  return (bestBid + bestAsk) / 2;
};

/**
 * Calculate spread from best bid and ask
 */
export const calculateSpread = (
  bestBid: number | null,
  bestAsk: number | null
): number | null => {
  if (bestBid === null || bestAsk === null) return null;
  return bestAsk - bestBid;
};

/**
 * Calculate unrealized P&L
 */
export const calculateUnrealizedPnL = (
  entryPrice: number,
  currentPrice: number,
  quantity: bigint
): number => {
  return (currentPrice - entryPrice) * Number(quantity);
};

/**
 * Format price for display (e.g., "0.65" or "65¢")
 */
export const formatPrice = (price: number, format: 'decimal' | 'cents' = 'decimal'): string => {
  if (format === 'cents') {
    return `${Math.round(price * 100)}¢`;
  }
  return price.toFixed(2);
};

/**
 * Format USDC amount for display
 */
export const formatUsdc = (units: bigint): string => {
  const amount = fromUsdcUnits(units);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};


// ============================================
// CTFExchange Types
// ============================================

// Signature type enum (matches ICTFExchange.SignatureType in Solidity)
export enum SignatureType {
  EOA = 0,            // Standard ECDSA signature
  POLY_PROXY = 1,     // Polymarket proxy wallet
  POLY_GNOSIS_SAFE = 2, // Gnosis Safe multisig
}

// Match type enum (matches ICTFExchange.MatchType in Solidity)
export enum MatchType {
  COMPLEMENTARY = 0,  // BUY vs SELL - standard swap
  MINT = 1,           // BUY vs BUY - mint new tokens
  MERGE = 2,          // SELL vs SELL - merge tokens
}

/**
 * EIP-712 signed order structure (matches ICTFExchange.SignedOrder)
 */
export interface CTFSignedOrder {
  salt: bigint;           // Unique entropy for order
  maker: Address;         // Address providing funds
  signer: Address;        // Address that signed (can differ for AA wallets)
  taker: Address;         // Specific taker or 0x0 for public
  marketId: Bytes32;      // Market identifier
  tokenId: bigint;        // CTF ERC-1155 token ID
  side: OrderSide;        // BUY or SELL
  makerAmount: bigint;    // Amount maker is offering
  takerAmount: bigint;    // Amount maker wants in return
  expiration: bigint;     // Order expiry timestamp
  nonce: bigint;          // Replay protection
  feeRateBps: bigint;     // Fee rate in basis points
  sigType: SignatureType; // Signature type
  signature: `0x${string}`; // The signature
}

/**
 * Order status tracking (matches ICTFExchange.OrderStatus)
 */
export interface CTFOrderStatus {
  isFilledOrCancelled: boolean;
  remaining: bigint;
}

/**
 * Token registry entry (matches ICTFExchange.TokenInfo)
 */
export interface CTFTokenInfo {
  complement: bigint;     // Complement token ID (YES <-> NO)
  conditionId: Bytes32;   // CTF condition ID
}

// ============================================
// SettlementVault Types
// ============================================

/**
 * Settlement epoch data (matches ISettlementVault.Epoch)
 */
export interface SettlementEpoch {
  merkleRoot: Bytes32;
  timestamp: bigint;
  totalAmount: bigint;
}

/**
 * Withdrawal proof for claiming from an epoch
 */
export interface WithdrawalProof {
  epochId: number;
  amount: bigint;
  proof: Bytes32[];
}

/**
 * Deposit status for tracking pending deposits
 */
export interface DepositStatus {
  txHash: `0x${string}`;
  user: Address;
  amount: bigint;
  blockNumber: number;
  confirmations: number;
  indexed: boolean;
}

// ============================================
// EIP-712 Domain and Types
// ============================================

/**
 * EIP-712 domain for CTFExchange
 */
export interface CTFExchangeDomain {
  name: 'CTFExchange';
  version: '1';
  chainId: number;
  verifyingContract: Address;
}

/**
 * EIP-712 order type definition
 */
export const CTF_ORDER_TYPES = {
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

// ============================================
// Trading Event Types
// ============================================

/**
 * Order added event data
 */
export interface OrderAddedEvent {
  orderId: string;
  maker: Address;
  marketId: Bytes32;
  tokenId: bigint;
  side: OrderSide;
  price: bigint;
  quantity: bigint;
  timestamp: number;
}

/**
 * Order removed event data
 */
export interface OrderRemovedEvent {
  orderId: string;
  marketId: Bytes32;
  tokenId: bigint;
}

/**
 * Order updated event data
 */
export interface OrderUpdatedEvent {
  orderId: string;
  marketId: Bytes32;
  tokenId: bigint;
  filled: bigint;
  remaining: bigint;
}

/**
 * Trade event data
 */
export interface TradeEvent {
  id: string;
  maker: Address;
  taker: Address;
  marketId: Bytes32;
  tokenId: bigint;
  amount: bigint;
  price: bigint;
  matchType: MatchType;
  timestamp: number;
}

/**
 * Price update event data
 */
export interface PriceUpdateEvent {
  marketId: Bytes32;
  tokenId: bigint;
  lastPrice: bigint;
  bestBid: bigint | null;
  bestAsk: bigint | null;
}

/**
 * Balance update event data
 */
export interface BalanceUpdateEvent {
  user: Address;
  tokenId: bigint;
  available: bigint;
  locked: bigint;
}

/**
 * Epoch committed event data
 */
export interface EpochCommittedEvent {
  epochId: number;
  merkleRoot: Bytes32;
  totalAmount: bigint;
  timestamp: number;
}
