/**
 * SSE Event Type Schemas
 * 
 * Defines interfaces for all SSE event types used in real-time updates.
 * Requirements: 1.3, 1.5, 3.2, 7.3, 9.1, 9.2, 9.3
 */

import type { Comment, Side, SteelmanStatus, ReactionCounts, RoundNumber, CommentReactionType, CommentReactionCounts, NotificationType } from './types';

// ============================================================================
// Base Event Interface
// ============================================================================

export interface SSEEventBase {
  timestamp: string;
  debateId: string;
}

// ============================================================================
// Event Type Definitions
// ============================================================================

export type SSEEventType = 'market' | 'comment' | 'argument' | 'reaction' | 'round' | 'steelman' | 'debate-join' | 'comment-reaction' | 'notification' | 'reputation' | 'order_added' | 'order_removed' | 'order_updated' | 'trade' | 'price_update' | 'balance_update' | 'epoch_committed';

// ============================================================================
// Market Event (Requirement 2.6)
// ============================================================================

export interface MarketEventData {
  supportPrice: number;
  opposePrice: number;
  totalVotes: number;
  mindChangeCount: number;
}

export interface MarketEvent extends SSEEventBase {
  event: 'market';
  data: MarketEventData;
}

// ============================================================================
// Comment Event (Requirement 6.4)
// ============================================================================

export interface CommentEventData {
  action: 'add';
  comment: Comment;
  parentId: string | null;
}

export interface CommentEvent extends SSEEventBase {
  event: 'comment';
  data: CommentEventData;
}

// ============================================================================
// Argument Event (Requirement 3.2)
// ============================================================================

export interface ArgumentEventData {
  argumentId: string;
  roundNumber: RoundNumber;
  side: Side;
  content: string;
  debaterId: string;
  createdAt: string;
}

export interface ArgumentEvent extends SSEEventBase {
  event: 'argument';
  data: ArgumentEventData;
}

// ============================================================================
// Reaction Event (Requirement 4.2)
// ============================================================================

export interface ReactionEventData {
  argumentId: string;
  reactionType: 'agree' | 'strong_reasoning';
  counts: ReactionCounts;
}

export interface ReactionEvent extends SSEEventBase {
  event: 'reaction';
  data: ReactionEventData;
}

// ============================================================================
// Round Event (Requirement 5.2)
// ============================================================================

export interface RoundEventData {
  newRoundNumber: RoundNumber;
  currentTurn: Side;
  previousRoundCompleted: boolean;
  status?: 'active' | 'concluded';
}

export interface RoundEvent extends SSEEventBase {
  event: 'round';
  data: RoundEventData;
}

// ============================================================================
// Steelman Event (Requirement 10.3)
// ============================================================================

export interface SteelmanEventData {
  steelmanId: string;
  roundNumber: 2 | 3;
  status: SteelmanStatus;
  rejectionReason?: string;
  authorId: string;
}

export interface SteelmanEvent extends SSEEventBase {
  event: 'steelman';
  data: SteelmanEventData;
}

// ============================================================================
// Debate Join Event (Requirement 11.2)
// ============================================================================

export interface DebateJoinEventData {
  opposeDebaterId: string;
  opposeDebaterUsername: string;
}

export interface DebateJoinEvent extends SSEEventBase {
  event: 'debate-join';
  data: DebateJoinEventData;
}

// ============================================================================
// Comment Reaction Event (Requirement 3.2)
// ============================================================================

export interface CommentReactionEventData {
  commentId: string;
  reactionType: CommentReactionType;
  counts: CommentReactionCounts;
}

export interface CommentReactionEvent extends SSEEventBase {
  event: 'comment-reaction';
  data: CommentReactionEventData;
}

// ============================================================================
// Notification Event (Requirement 7.3)
// ============================================================================

export interface NotificationEventData {
  id: string;
  type: NotificationType;
  message: string;
  debateId?: string;
  createdAt: string;
}

export interface NotificationEvent {
  event: 'notification';
  timestamp: string;
  userId: string;
  data: NotificationEventData;
}

// ============================================================================
// Reputation Event (Requirement 4.1)
// ============================================================================

export interface ReputationEventData {
  userId: string;
  previousScore: number;
  newScore: number;
  changeAmount: number;
  reason: string;
  debateId?: string;
}

export interface ReputationEvent {
  event: 'reputation';
  timestamp: string;
  userId: string;
  data: ReputationEventData;
}

// ============================================================================
// Trading Event Types (Requirements 9.1, 9.2, 9.3)
// ============================================================================

/**
 * Match type for trades in the hybrid CLOB system.
 */
export enum MatchType {
  COMPLEMENTARY = 0,  // BUY vs SELL
  MINT = 1,           // BUY vs BUY (prices sum >= 1)
  MERGE = 2,          // SELL vs SELL (prices sum <= 1)
}

/**
 * Order side enum for trading.
 */
export enum TradingSide {
  BUY = 0,
  SELL = 1,
}

/**
 * Signature type for order validation.
 */
export enum SignatureType {
  EOA = 0,
  POLY_PROXY = 1,
  POLY_GNOSIS_SAFE = 2,
}

/**
 * Signed order structure matching the CTFExchange contract.
 */
export interface SignedOrder {
  salt: string;           // bigint as string for JSON serialization
  maker: string;
  signer: string;
  taker: string;
  marketId: string;
  tokenId: string;        // bigint as string
  side: TradingSide;
  makerAmount: string;    // bigint as string
  takerAmount: string;    // bigint as string
  expiration: string;     // bigint as string
  nonce: string;          // bigint as string
  feeRateBps: string;     // bigint as string
  sigType: SignatureType;
  signature: string;
}

/**
 * Order book entry with remaining quantity.
 */
export interface OrderBookEntry {
  id: string;
  order: SignedOrder;
  remaining: string;      // bigint as string
  timestamp: number;
}

/**
 * Trade record from matching engine.
 */
export interface TradeRecord {
  id: string;
  takerOrderHash: string;
  makerOrderHash: string;
  maker: string;
  taker: string;
  tokenId: string;        // bigint as string
  amount: string;         // bigint as string
  price: string;          // bigint as string
  matchType: MatchType;
  timestamp: number;
}

/**
 * User balance with available and locked amounts.
 */
export interface UserBalance {
  available: string;      // bigint as string
  locked: string;         // bigint as string
}

/**
 * Price level in order book.
 */
export interface PriceLevel {
  price: string;          // bigint as string
  quantity: string;       // bigint as string
  orderCount: number;
}

// ============================================================================
// Trading SSE Event Data Types
// ============================================================================

/**
 * Data for order_added event (Requirement 9.1)
 */
export interface OrderAddedEventData {
  entry: OrderBookEntry;
  marketId: string;
}

/**
 * Data for order_removed event (Requirement 9.2)
 */
export interface OrderRemovedEventData {
  orderId: string;
  marketId: string;
  tokenId: string;
}

/**
 * Data for order_updated event (Requirement 9.2)
 */
export interface OrderUpdatedEventData {
  orderId: string;
  marketId: string;
  tokenId: string;
  filled: string;         // bigint as string
  remaining: string;      // bigint as string
}

/**
 * Data for trade event (Requirement 9.3)
 */
export interface TradeEventData {
  trade: TradeRecord;
  marketId: string;
}

/**
 * Data for price_update event (Requirement 9.3)
 */
export interface PriceUpdateEventData {
  marketId: string;
  tokenId: string;        // bigint as string
  price: string;          // bigint as string
  bestBid: PriceLevel | null;
  bestAsk: PriceLevel | null;
}

/**
 * Data for balance_update event
 */
export interface BalanceUpdateEventData {
  user: string;
  tokenId: string;        // bigint as string
  balance: UserBalance;
}

/**
 * Data for epoch_committed event (Requirement 4.7)
 */
export interface EpochCommittedEventData {
  epochId: number;
  merkleRoot: string;
  totalAmount: string;    // bigint as string
  tradeCount: number;
  txHash: string;
}

// ============================================================================
// Trading SSE Event Interfaces
// ============================================================================

export interface OrderAddedEvent {
  event: 'order_added';
  timestamp: string;
  data: OrderAddedEventData;
}

export interface OrderRemovedEvent {
  event: 'order_removed';
  timestamp: string;
  data: OrderRemovedEventData;
}

export interface OrderUpdatedEvent {
  event: 'order_updated';
  timestamp: string;
  data: OrderUpdatedEventData;
}

export interface TradeEvent {
  event: 'trade';
  timestamp: string;
  data: TradeEventData;
}

export interface PriceUpdateEvent {
  event: 'price_update';
  timestamp: string;
  data: PriceUpdateEventData;
}

export interface BalanceUpdateEvent {
  event: 'balance_update';
  timestamp: string;
  userId: string;
  data: BalanceUpdateEventData;
}

export interface EpochCommittedEvent {
  event: 'epoch_committed';
  timestamp: string;
  data: EpochCommittedEventData;
}

/**
 * Union type for all trading SSE events.
 * Used for type-safe event handling in the trading system.
 */
export type TradingEvent =
  | OrderAddedEvent
  | OrderRemovedEvent
  | OrderUpdatedEvent
  | TradeEvent
  | PriceUpdateEvent
  | BalanceUpdateEvent
  | EpochCommittedEvent;

// ============================================================================
// Union Type for All SSE Events
// ============================================================================

export type SSEEvent =
  | MarketEvent
  | CommentEvent
  | ArgumentEvent
  | ReactionEvent
  | RoundEvent
  | SteelmanEvent
  | DebateJoinEvent
  | CommentReactionEvent
  | NotificationEvent
  | ReputationEvent
  | OrderAddedEvent
  | OrderRemovedEvent
  | OrderUpdatedEvent
  | TradeEvent
  | PriceUpdateEvent
  | BalanceUpdateEvent
  | EpochCommittedEvent;

// ============================================================================
// Type Guards
// ============================================================================

export function isMarketEvent(event: SSEEvent): event is MarketEvent {
  return event.event === 'market';
}

export function isCommentEvent(event: SSEEvent): event is CommentEvent {
  return event.event === 'comment';
}

export function isArgumentEvent(event: SSEEvent): event is ArgumentEvent {
  return event.event === 'argument';
}

export function isReactionEvent(event: SSEEvent): event is ReactionEvent {
  return event.event === 'reaction';
}

export function isRoundEvent(event: SSEEvent): event is RoundEvent {
  return event.event === 'round';
}

export function isSteelmanEvent(event: SSEEvent): event is SteelmanEvent {
  return event.event === 'steelman';
}

export function isDebateJoinEvent(event: SSEEvent): event is DebateJoinEvent {
  return event.event === 'debate-join';
}

export function isCommentReactionEvent(event: SSEEvent): event is CommentReactionEvent {
  return event.event === 'comment-reaction';
}

export function isNotificationEvent(event: SSEEvent): event is NotificationEvent {
  return event.event === 'notification';
}

export function isReputationEvent(event: SSEEvent): event is ReputationEvent {
  return event.event === 'reputation';
}

export function isOrderAddedEvent(event: SSEEvent): event is OrderAddedEvent {
  return event.event === 'order_added';
}

export function isOrderRemovedEvent(event: SSEEvent): event is OrderRemovedEvent {
  return event.event === 'order_removed';
}

export function isOrderUpdatedEvent(event: SSEEvent): event is OrderUpdatedEvent {
  return event.event === 'order_updated';
}

export function isTradeEvent(event: SSEEvent): event is TradeEvent {
  return event.event === 'trade';
}

export function isPriceUpdateEvent(event: SSEEvent): event is PriceUpdateEvent {
  return event.event === 'price_update';
}

export function isBalanceUpdateEvent(event: SSEEvent): event is BalanceUpdateEvent {
  return event.event === 'balance_update';
}

export function isEpochCommittedEvent(event: SSEEvent): event is EpochCommittedEvent {
  return event.event === 'epoch_committed';
}

/**
 * Type guard to check if an event is a trading event.
 */
export function isTradingEvent(event: SSEEvent): event is TradingEvent {
  return (
    event.event === 'order_added' ||
    event.event === 'order_removed' ||
    event.event === 'order_updated' ||
    event.event === 'trade' ||
    event.event === 'price_update' ||
    event.event === 'balance_update' ||
    event.event === 'epoch_committed'
  );
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Required fields for each event type
 */
export const SSE_EVENT_REQUIRED_FIELDS: Record<SSEEventType, string[]> = {
  market: ['supportPrice', 'opposePrice', 'totalVotes', 'mindChangeCount'],
  comment: ['action', 'comment', 'parentId'],
  argument: ['argumentId', 'roundNumber', 'side', 'content', 'debaterId', 'createdAt'],
  reaction: ['argumentId', 'reactionType', 'counts'],
  round: ['newRoundNumber', 'currentTurn', 'previousRoundCompleted'],
  steelman: ['steelmanId', 'roundNumber', 'status', 'authorId'],
  'debate-join': ['opposeDebaterId', 'opposeDebaterUsername'],
  'comment-reaction': ['commentId', 'reactionType', 'counts'],
  notification: ['id', 'type', 'message', 'createdAt'],
  reputation: ['userId', 'previousScore', 'newScore', 'changeAmount', 'reason'],
  // Trading event required fields
  order_added: ['entry', 'marketId'],
  order_removed: ['orderId', 'marketId', 'tokenId'],
  order_updated: ['orderId', 'marketId', 'tokenId', 'filled', 'remaining'],
  trade: ['trade', 'marketId'],
  price_update: ['marketId', 'tokenId', 'price'],
  balance_update: ['user', 'tokenId', 'balance'],
  epoch_committed: ['epochId', 'merkleRoot', 'totalAmount', 'tradeCount', 'txHash'],
};

/**
 * Validate that an event payload contains all required fields
 */
export function validateEventPayload(eventType: SSEEventType, data: unknown): boolean {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  
  const requiredFields = SSE_EVENT_REQUIRED_FIELDS[eventType];
  const dataObj = data as Record<string, unknown>;
  
  return requiredFields.every(field => field in dataObj);
}
