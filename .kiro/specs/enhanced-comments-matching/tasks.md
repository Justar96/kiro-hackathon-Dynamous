# Implementation Plan: Enhanced Comments & Opponent Matching

## Overview

This plan implements the enhanced comment system (threading, reactions, real-time updates) and opponent matching system (queue, auto-matching, notifications) in incremental steps. Each task builds on previous work, with property tests validating correctness.

## Tasks

- [x] 1. Database schema extensions
  - [x] 1.1 Add comment_reactions table and enum
    - Create migration with `comment_reaction_type` enum ('support', 'oppose')
    - Create `comment_reactions` table with id, commentId, userId, type, createdAt
    - Add unique index on (commentId, userId, type)
    - _Requirements: 2.1, 2.5_
  - [x] 1.2 Add notifications table and enum
    - Create `notification_type` enum ('opponent_joined', 'debate_started', 'your_turn')
    - Create `notifications` table with id, userId, type, message, debateId, read, createdAt
    - Add index on (userId, read, createdAt)
    - _Requirements: 6.2_
  - [x] 1.3 Add soft delete to comments table
    - Add `deletedAt` timestamp column to comments table
    - _Requirements: 1.4_

- [x] 2. Shared types extensions
  - [x] 2.1 Add comment reaction types
    - Add CommentReactionType, CommentReaction, CommentReactionCounts, CreateCommentReactionInput
    - _Requirements: 2.1, 2.3, 2.5_
  - [x] 2.2 Add notification types
    - Add NotificationType, Notification, CreateNotificationInput
    - _Requirements: 6.2, 6.5_
  - [x] 2.3 Add comment threading types
    - Add CommentWithReplies interface with replyCount, replies, isParentDeleted
    - _Requirements: 1.1, 1.2, 1.4_

- [x] 3. Comment service threading extensions
  - [x] 3.1 Implement getCommentTree method
    - Build hierarchical tree from flat comment list
    - Include replyCount for each comment
    - Handle deleted parents with isParentDeleted flag
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 3.2 Write property test for comment tree structure
    - **Property 1: Comment Tree Structure Preservation**
    - **Validates: Requirements 1.1, 1.3**
  - [x] 3.3 Write property test for reply count accuracy
    - **Property 2: Reply Count Accuracy**
    - **Validates: Requirements 1.2**
  - [x] 3.4 Implement softDeleteComment method
    - Set deletedAt timestamp instead of hard delete
    - Preserve child comments
    - _Requirements: 1.4_
  - [x] 3.5 Write property test for deleted parent indicator
    - **Property 3: Deleted Parent Indicator**
    - **Validates: Requirements 1.4**

- [x] 4. Checkpoint - Comment threading complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Comment reaction service extensions
  - [x] 5.1 Implement addCommentReaction method
    - Validate comment exists
    - Check for duplicate reaction (same user, comment, type)
    - Store reaction with nanoid
    - _Requirements: 2.1, 2.2_
  - [x] 5.2 Implement removeCommentReaction method
    - Delete reaction and return success/failure
    - _Requirements: 2.4_
  - [x] 5.3 Implement getCommentReactionCounts method
    - Aggregate counts by type (support, oppose)
    - _Requirements: 2.3_
  - [x] 5.4 Implement getUserCommentReactions method
    - Return which reaction types user has given
    - _Requirements: 2.3_
  - [x] 5.5 Write property test for reaction uniqueness
    - **Property 4: Comment Reaction Uniqueness**
    - **Validates: Requirements 2.1, 2.2**
  - [x] 5.6 Write property test for reaction count consistency
    - **Property 5: Comment Reaction Count Consistency**
    - **Validates: Requirements 2.3, 2.4**

- [ ] 6. Checkpoint - Comment reactions complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Broadcast module extensions
  - [ ] 7.1 Add comment-reaction event type
    - Extend EventType and BroadcastPayload
    - Include commentId, reactionType, counts
    - _Requirements: 3.2_
  - [ ] 7.2 Add notification event type
    - Extend EventType and BroadcastPayload
    - Include id, type, message, debateId, createdAt
    - _Requirements: 7.3_
  - [ ] 7.3 Implement user-specific connections
    - Add userConnections Map
    - Implement addUserConnection, removeUserConnection
    - Implement broadcastToUser function
    - _Requirements: 7.1, 7.2_
  - [ ] 7.4 Write property test for broadcast payload completeness
    - **Property 12: Broadcast Payload Completeness**
    - **Validates: Requirements 3.4**
  - [ ] 7.5 Write property test for comment reaction broadcast
    - **Property 13: Comment Reaction Broadcast**
    - **Validates: Requirements 3.2**

- [ ] 8. Checkpoint - Broadcast extensions complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Matching service implementation
  - [ ] 9.1 Create matching.service.ts with getOpponentQueue
    - Query debates without opponents, status active
    - Order by createdAt ascending (FIFO)
    - Include creator info (username, reputation)
    - _Requirements: 4.1, 4.3_
  - [ ] 9.2 Implement queue filtering
    - Filter by keywords in resolution
    - Filter by max reputation difference
    - _Requirements: 4.5_
  - [ ] 9.3 Implement findMatches method
    - Exclude user's own debates
    - Prioritize by reputation similarity (within 20 points first)
    - Return oldest first within priority groups
    - _Requirements: 5.1, 5.2, 5.3, 5.5_
  - [ ] 9.4 Implement queue lifecycle hooks
    - onDebateCreated: add to queue if no opponent
    - onOpponentJoined: remove from queue
    - onDebateConcluded: remove from queue
    - _Requirements: 4.1, 4.2, 4.4_
  - [ ] 9.5 Write property test for queue membership invariant
    - **Property 6: Queue Membership Invariant**
    - **Validates: Requirements 4.1, 4.2, 4.4**
  - [ ] 9.6 Write property test for queue FIFO ordering
    - **Property 7: Queue FIFO Ordering**
    - **Validates: Requirements 4.3, 5.5**
  - [ ] 9.7 Write property test for self-exclusion
    - **Property 8: Self-Exclusion from Matches**
    - **Validates: Requirements 5.3**
  - [ ] 9.8 Write property test for reputation prioritization
    - **Property 9: Reputation-Based Match Prioritization**
    - **Validates: Requirements 5.2**

- [ ] 10. Checkpoint - Matching service complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Notification service implementation
  - [ ] 11.1 Create notification.service.ts with createNotification
    - Store notification with all required fields
    - Broadcast to user if connected
    - _Requirements: 6.1, 6.2, 7.1_
  - [ ] 11.2 Implement getUserNotifications
    - Return unread first, then by createdAt descending
    - Support unreadOnly filter
    - _Requirements: 6.3_
  - [ ] 11.3 Implement markAsRead and markAllAsRead
    - Update read status
    - Return affected count
    - _Requirements: 6.4_
  - [ ] 11.4 Implement getUnreadCount
    - Return count of unread notifications for user
    - _Requirements: 6.3_
  - [ ] 11.5 Write property test for notification storage completeness
    - **Property 10: Notification Storage Completeness**
    - **Validates: Requirements 6.2, 7.4**
  - [ ] 11.6 Write property test for notification ordering
    - **Property 11: Notification Ordering**
    - **Validates: Requirements 6.3**

- [ ] 12. Checkpoint - Notification service complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. API endpoints integration
  - [ ] 13.1 Add comment threading endpoint
    - GET /api/debates/:id/comments/tree - returns threaded comments
    - _Requirements: 1.1, 1.2, 1.3_
  - [ ] 13.2 Add comment reaction endpoints
    - POST /api/comments/:id/react - add reaction
    - DELETE /api/comments/:id/react - remove reaction
    - GET /api/comments/:id/reactions - get counts and user reactions
    - Broadcast comment-reaction events
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.2_
  - [ ] 13.3 Add matching endpoints
    - GET /api/matching/queue - list opponent queue
    - GET /api/matching/find - find matches for current user
    - _Requirements: 4.1, 4.3, 5.1_
  - [ ] 13.4 Add notification endpoints
    - GET /api/notifications - get user notifications
    - POST /api/notifications/:id/read - mark as read
    - POST /api/notifications/read-all - mark all as read
    - GET /api/notifications/count - get unread count
    - _Requirements: 6.3, 6.4_
  - [ ] 13.5 Add user SSE stream for notifications
    - GET /api/users/stream - SSE stream for user notifications
    - _Requirements: 7.1, 7.2_
  - [ ] 13.6 Wire matching hooks to debate service
    - Call matching service on debate create/join/conclude
    - Create notifications on opponent join
    - _Requirements: 4.1, 4.2, 4.4, 6.1_

- [ ] 14. Final checkpoint - All features complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All property tests are required for comprehensive correctness validation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use fast-check library (already in project)
- All services follow existing singleton pattern with class + instance export
