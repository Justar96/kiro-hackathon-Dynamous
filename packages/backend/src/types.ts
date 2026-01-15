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

export interface Trade {
  id: string;
  takerOrderHash: string;
  makerOrderHash: string;
  maker: string;
  taker: string;
  tokenId: bigint;
  amount: bigint;
  price: bigint;
  timestamp: number;
}

export interface UserBalance {
  available: bigint;
  locked: bigint;
}
