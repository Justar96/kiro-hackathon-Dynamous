// Order types matching the Solidity contract
export enum Side {
  BUY = 0,
  SELL = 1,
}

export enum SignatureType {
  EOA = 0,
  POLY_PROXY = 1,
  POLY_GNOSIS_SAFE = 2,
}

export interface SignedOrder {
  salt: bigint;
  maker: string;
  signer: string;
  taker: string;
  marketId: string;
  tokenId: bigint;
  side: Side;
  makerAmount: bigint;
  takerAmount: bigint;
  expiration: bigint;
  nonce: bigint;
  feeRateBps: bigint;
  sigType: SignatureType;
  signature: string;
}

export interface OrderBookEntry {
  id: string;
  order: SignedOrder;
  remaining: bigint;
  timestamp: number;
}

/**
 * Match type for trades in the hybrid CLOB system.
 * 
 * - COMPLEMENTARY: Standard BUY vs SELL match
 * - MINT: Two BUY orders with prices summing >= 1.0 (triggers splitPosition on CTF)
 * - MERGE: Two SELL orders with prices summing <= 1.0 (triggers mergePositions on CTF)
 */
export enum MatchType {
  COMPLEMENTARY = 0,  // BUY vs SELL
  MINT = 1,           // BUY vs BUY (prices sum >= 1)
  MERGE = 2,          // SELL vs SELL (prices sum <= 1)
}

export interface Trade {
  id: string;
  takerOrderHash: string;
  makerOrderHash: string;
  maker: string;
  taker: string;
  tokenId: bigint;
  amount: bigint;
  price: bigint;
  matchType: MatchType;
  timestamp: number;
  /** Fee charged for this trade (in collateral units) */
  fee: bigint;
  /** Fee rate in basis points used for this trade */
  feeRateBps: bigint;
}

export interface UserBalance {
  available: bigint;
  locked: bigint;
}
