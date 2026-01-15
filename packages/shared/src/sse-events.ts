/**
 * SSE Event Type Schemas
 * 
 * Defines interfaces for all SSE event types used in real-time updates.
 * Requirements: 1.3, 1.5, 3.2, 7.3
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

export type SSEEventType = 'market' | 'comment' | 'argument' | 'reaction' | 'round' | 'steelman' | 'debate-join' | 'comment-reaction' | 'notification' | 'reputation';

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
  | ReputationEvent;

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
