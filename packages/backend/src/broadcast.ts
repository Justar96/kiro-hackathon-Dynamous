/**
 * Unified Broadcast Module for SSE Events
 * 
 * Centralizes all SSE broadcast functionality for Thesis.
 * Requirements: 1.1, 1.2, 1.4, 3.2, 7.1, 7.2, 7.3
 */

import type { MarketPrice, Comment, Side, SteelmanStatus, ReactionCounts, CommentReactionType, CommentReactionCounts, NotificationType } from '@thesis/shared';

// ============================================================================
// Event Type Definitions
// ============================================================================

export type EventType = 'market' | 'comment' | 'argument' | 'reaction' | 'round' | 'steelman' | 'debate-join' | 'comment-reaction' | 'notification' | 'reputation';

export interface BroadcastPayload {
  market: MarketPrice;
  comment: { action: 'add'; comment: Comment; parentId: string | null };
  argument: {
    argumentId: string;
    roundNumber: 1 | 2 | 3;
    side: Side;
    content: string;
    debaterId: string;
    createdAt: Date;
  };
  reaction: {
    argumentId: string;
    reactionType: 'agree' | 'strong_reasoning';
    counts: ReactionCounts;
  };
  round: {
    debateId: string;
    newRoundNumber: 1 | 2 | 3;
    currentTurn: Side;
    previousRoundCompleted: boolean;
    status?: 'active' | 'concluded';
  };
  steelman: {
    steelmanId: string;
    debateId: string;
    roundNumber: 2 | 3;
    status: SteelmanStatus;
    rejectionReason?: string;
    authorId: string;
  };
  'debate-join': {
    debateId: string;
    opposeDebaterId: string;
    opposeDebaterUsername: string;
  };
  'comment-reaction': {
    commentId: string;
    reactionType: CommentReactionType;
    counts: CommentReactionCounts;
  };
  notification: {
    id: string;
    type: NotificationType;
    message: string;
    debateId?: string;
    createdAt: string;
  };
  reputation: {
    userId: string;
    previousScore: number;
    newScore: number;
    changeAmount: number;
    reason: string;
    debateId?: string;
  };
}

// ============================================================================
// Connection Management
// ============================================================================

/**
 * Store active SSE connections per debate
 * Map<debateId, Set<sendFunction>>
 */
const debateConnections = new Map<string, Set<(data: string) => void>>();

/**
 * Track last heartbeat time for each connection
 * Used for stale connection cleanup (Requirement 1.6)
 */
const connectionHeartbeats = new Map<(data: string) => void, number>();

/**
 * Heartbeat timeout in milliseconds (60 seconds)
 * Connections without heartbeat response within this time are considered stale
 */
const HEARTBEAT_TIMEOUT = 60000;

/**
 * Cleanup interval in milliseconds (30 seconds)
 */
const CLEANUP_INTERVAL = 30000;

/**
 * Add a connection to a debate's connection pool
 */
export function addConnection(debateId: string, sendFn: (data: string) => void): void {
  if (!debateConnections.has(debateId)) {
    debateConnections.set(debateId, new Set());
  }
  debateConnections.get(debateId)!.add(sendFn);
  // Record initial heartbeat time
  connectionHeartbeats.set(sendFn, Date.now());
}

/**
 * Remove a connection from a debate's connection pool
 */
export function removeConnection(debateId: string, sendFn: (data: string) => void): void {
  const connections = debateConnections.get(debateId);
  if (connections) {
    connections.delete(sendFn);
    if (connections.size === 0) {
      debateConnections.delete(debateId);
    }
  }
  // Clean up heartbeat tracking
  connectionHeartbeats.delete(sendFn);
}

/**
 * Update heartbeat timestamp for a connection
 * Called when a heartbeat response is received
 */
export function updateConnectionHeartbeat(sendFn: (data: string) => void): void {
  connectionHeartbeats.set(sendFn, Date.now());
}

/**
 * Get the number of active connections for a debate
 * Useful for debugging and monitoring
 */
export function getConnectionCount(debateId: string): number {
  return debateConnections.get(debateId)?.size ?? 0;
}

/**
 * Get total connection count across all debates
 */
export function getTotalConnectionCount(): number {
  let total = 0;
  for (const connections of debateConnections.values()) {
    total += connections.size;
  }
  return total;
}

/**
 * Clean up stale connections that haven't received heartbeat in HEARTBEAT_TIMEOUT
 * Requirement 1.6: Remove connections that haven't received heartbeat in 60 seconds
 */
export function cleanupStaleConnections(): number {
  const now = Date.now();
  let removedCount = 0;

  for (const [debateId, connections] of debateConnections.entries()) {
    const staleConnections: Array<(data: string) => void> = [];

    for (const sendFn of connections) {
      const lastHeartbeat = connectionHeartbeats.get(sendFn);
      if (!lastHeartbeat || now - lastHeartbeat > HEARTBEAT_TIMEOUT) {
        staleConnections.push(sendFn);
      }
    }

    for (const staleFn of staleConnections) {
      connections.delete(staleFn);
      connectionHeartbeats.delete(staleFn);
      removedCount++;
    }

    if (connections.size === 0) {
      debateConnections.delete(debateId);
    }
  }

  return removedCount;
}

/**
 * Start periodic cleanup of stale connections
 * Returns a function to stop the cleanup interval
 */
export function startConnectionCleanup(): () => void {
  const intervalId = setInterval(() => {
    const removed = cleanupStaleConnections();
    if (removed > 0) {
      console.log(`[SSE] Cleaned up ${removed} stale connection(s)`);
    }
  }, CLEANUP_INTERVAL);

  return () => clearInterval(intervalId);
}

// ============================================================================
// Broadcast Functions
// ============================================================================

/**
 * Broadcast a typed event to all clients connected to a debate's SSE stream
 * 
 * Requirements:
 * - 1.1: Export broadcastDebateEvent function with typed payloads
 * - 1.2: Send event to all clients connected to that debate's SSE stream
 * - 1.4: Skip broadcast without error when no clients connected
 * - 1.5: Use consistent JSON serialization format
 * - 1.6: Remove failed connections and continue broadcasting
 */
export function broadcastDebateEvent<T extends EventType>(
  debateId: string,
  eventType: T,
  payload: BroadcastPayload[T]
): void {
  const connections = debateConnections.get(debateId);
  
  // Requirement 1.4: Skip broadcast without error when no clients connected
  if (!connections || connections.size === 0) {
    return;
  }

  // Requirement 1.5: Consistent JSON serialization format
  const message = JSON.stringify({
    event: eventType,
    data: payload,
    timestamp: new Date().toISOString(),
    debateId,
  });

  const failedConnections: Array<(data: string) => void> = [];

  for (const send of connections) {
    try {
      send(message);
    } catch {
      // Requirement 1.6: Track failed connections for removal
      failedConnections.push(send);
    }
  }

  // Requirement 1.6: Remove failed connections from the pool
  for (const failed of failedConnections) {
    connections.delete(failed);
  }

  // Clean up empty connection sets
  if (connections.size === 0) {
    debateConnections.delete(debateId);
  }
}

/**
 * Broadcast market price update
 * Convenience wrapper for market events
 */
export function broadcastMarketUpdate(debateId: string, marketPrice: MarketPrice): void {
  broadcastDebateEvent(debateId, 'market', marketPrice);
}

/**
 * Broadcast comment update
 * Convenience wrapper for comment events
 */
export function broadcastCommentUpdate(
  debateId: string,
  comment: Comment,
  parentId: string | null = null
): void {
  broadcastDebateEvent(debateId, 'comment', {
    action: 'add',
    comment,
    parentId,
  });
}

/**
 * Broadcast round transition update
 * Convenience wrapper for round events
 * Requirements: 5.1, 5.2, 5.5
 */
export function broadcastRoundUpdate(
  debateId: string,
  newRoundNumber: 1 | 2 | 3,
  currentTurn: Side,
  previousRoundCompleted: boolean,
  status?: 'active' | 'concluded'
): void {
  broadcastDebateEvent(debateId, 'round', {
    debateId,
    newRoundNumber,
    currentTurn,
    previousRoundCompleted,
    status,
  });
}

/**
 * Broadcast reputation update to a specific user
 * Convenience wrapper for reputation events
 * Requirement 4.1: Broadcast reputation changes to affected users
 */
export function broadcastReputationUpdate(
  userId: string,
  previousScore: number,
  newScore: number,
  changeAmount: number,
  reason: string,
  debateId?: string
): boolean {
  return broadcastToUser(userId, 'reputation', {
    userId,
    previousScore,
    newScore,
    changeAmount,
    reason,
    debateId,
  });
}

// ============================================================================
// Export connection map for SSE endpoint use
// ============================================================================

/**
 * Get the connections map for direct access in SSE endpoint
 * This allows the SSE stream handler to manage connections directly
 */
export function getDebateConnections(): Map<string, Set<(data: string) => void>> {
  return debateConnections;
}

// ============================================================================
// User-Specific Connection Management
// Requirements: 7.1, 7.2
// ============================================================================

/**
 * Store active SSE connections per user for notifications
 * Map<userId, Set<sendFunction>>
 */
const userConnections = new Map<string, Set<(data: string) => void>>();

/**
 * Track last heartbeat time for user connections
 */
const userConnectionHeartbeats = new Map<(data: string) => void, number>();

/**
 * Add a connection to a user's notification channel
 * Requirement 7.2: Support user-specific notification channels
 */
export function addUserConnection(userId: string, sendFn: (data: string) => void): void {
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }
  userConnections.get(userId)!.add(sendFn);
  // Record initial heartbeat time
  userConnectionHeartbeats.set(sendFn, Date.now());
}

/**
 * Remove a connection from a user's notification channel
 */
export function removeUserConnection(userId: string, sendFn: (data: string) => void): void {
  const connections = userConnections.get(userId);
  if (connections) {
    connections.delete(sendFn);
    if (connections.size === 0) {
      userConnections.delete(userId);
    }
  }
  // Clean up heartbeat tracking
  userConnectionHeartbeats.delete(sendFn);
}

/**
 * Update heartbeat timestamp for a user connection
 */
export function updateUserConnectionHeartbeat(sendFn: (data: string) => void): void {
  userConnectionHeartbeats.set(sendFn, Date.now());
}

/**
 * Get the number of active connections for a user
 */
export function getUserConnectionCount(userId: string): number {
  return userConnections.get(userId)?.size ?? 0;
}

/**
 * Check if a user has any active connections
 */
export function isUserConnected(userId: string): boolean {
  return getUserConnectionCount(userId) > 0;
}

/**
 * Broadcast an event to a specific user's SSE connections
 * Requirement 7.1: Send notification event to target user's SSE connection
 * Requirement 7.3: Include notification ID, type, message, and timestamp
 * 
 * @param userId - The target user's ID
 * @param eventType - The type of event to broadcast
 * @param payload - The event payload
 * @returns true if at least one connection received the message, false if user not connected
 */
export function broadcastToUser<T extends EventType>(
  userId: string,
  eventType: T,
  payload: BroadcastPayload[T]
): boolean {
  const connections = userConnections.get(userId);
  
  // Return false if user has no active connections
  if (!connections || connections.size === 0) {
    return false;
  }

  // Consistent JSON serialization format
  const message = JSON.stringify({
    event: eventType,
    data: payload,
    timestamp: new Date().toISOString(),
    userId,
  });

  const failedConnections: Array<(data: string) => void> = [];
  let successCount = 0;

  for (const send of connections) {
    try {
      send(message);
      successCount++;
    } catch {
      // Track failed connections for removal
      failedConnections.push(send);
    }
  }

  // Remove failed connections from the pool
  for (const failed of failedConnections) {
    connections.delete(failed);
    userConnectionHeartbeats.delete(failed);
  }

  // Clean up empty connection sets
  if (connections.size === 0) {
    userConnections.delete(userId);
  }

  return successCount > 0;
}

/**
 * Broadcast a notification to a user
 * Convenience wrapper for notification events
 * Requirements: 7.1, 7.3
 */
export function broadcastNotification(
  userId: string,
  notification: BroadcastPayload['notification']
): boolean {
  return broadcastToUser(userId, 'notification', notification);
}

/**
 * Broadcast a comment reaction event to all clients connected to a debate
 * Convenience wrapper for comment-reaction events
 * Requirement 3.2
 */
export function broadcastCommentReaction(
  debateId: string,
  commentId: string,
  reactionType: CommentReactionType,
  counts: CommentReactionCounts
): void {
  broadcastDebateEvent(debateId, 'comment-reaction', {
    commentId,
    reactionType,
    counts,
  });
}

/**
 * Get the user connections map for direct access
 */
export function getUserConnections(): Map<string, Set<(data: string) => void>> {
  return userConnections;
}

/**
 * Clean up stale user connections
 */
export function cleanupStaleUserConnections(): number {
  const now = Date.now();
  let removedCount = 0;

  for (const [userId, connections] of userConnections.entries()) {
    const staleConnections: Array<(data: string) => void> = [];

    for (const sendFn of connections) {
      const lastHeartbeat = userConnectionHeartbeats.get(sendFn);
      if (!lastHeartbeat || now - lastHeartbeat > HEARTBEAT_TIMEOUT) {
        staleConnections.push(sendFn);
      }
    }

    for (const staleFn of staleConnections) {
      connections.delete(staleFn);
      userConnectionHeartbeats.delete(staleFn);
      removedCount++;
    }

    if (connections.size === 0) {
      userConnections.delete(userId);
    }
  }

  return removedCount;
}
