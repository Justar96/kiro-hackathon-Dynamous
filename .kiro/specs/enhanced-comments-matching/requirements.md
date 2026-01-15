# Requirements Document

## Introduction

This specification covers the remaining features for Thesis: an enhanced comment system with threading, comment reactions, and real-time updates (Phase 4), plus an opponent matching system with queuing and notifications (Phase 5). These features complete the platform's social interaction and matchmaking capabilities.

## Glossary

- **Comment_Service**: The backend service responsible for managing spectator comments on debates
- **Reaction_Service**: The backend service responsible for managing reactions on arguments and comments
- **Matching_Service**: The backend service responsible for opponent matching and queue management
- **Notification_Service**: The backend service responsible for user notifications
- **Comment_Thread**: A hierarchical structure of comments where replies are nested under parent comments
- **Comment_Reaction**: A user's reaction to a comment (agree, insightful, or funny)
- **Opponent_Queue**: A list of debates seeking opponents, ordered by creation time
- **Match_Request**: A user's expression of interest in joining a debate as the opposing side

## Requirements

### Requirement 1: Comment Threading Display

**User Story:** As a spectator, I want to see comments organized in threads, so that I can follow conversations and understand reply context.

#### Acceptance Criteria

1. WHEN the Comment_Service retrieves comments for a debate, THE Comment_Service SHALL return comments with their parent-child relationships intact
2. WHEN a comment has replies, THE Comment_Service SHALL include a count of direct replies for that comment
3. WHEN building a comment tree, THE Comment_Service SHALL organize comments hierarchically with top-level comments as roots
4. WHEN a parent comment is deleted, THE Comment_Service SHALL preserve child comments with a "deleted parent" indicator

### Requirement 2: Comment Reactions

**User Story:** As a spectator, I want to react to comments, so that I can express agreement or disagreement without writing a reply.

#### Acceptance Criteria

1. WHEN a user adds a reaction to a comment, THE Reaction_Service SHALL store the reaction with comment ID, user ID, and reaction type
2. WHEN a user attempts to add a duplicate reaction type to the same comment, THE Reaction_Service SHALL reject the request with an appropriate error
3. WHEN retrieving comment reactions, THE Reaction_Service SHALL return counts for each reaction type (support, oppose)
4. WHEN a user removes a reaction, THE Reaction_Service SHALL delete the reaction and update counts accordingly
5. THE Reaction_Service SHALL support two comment reaction types: support and oppose

### Requirement 3: Real-time Comment Updates

**User Story:** As a spectator, I want to see new comments appear in real-time, so that I can follow the discussion without refreshing.

#### Acceptance Criteria

1. WHEN a new comment is added, THE Broadcast_Module SHALL send a comment event to all connected clients for that debate
2. WHEN a comment reaction is added or removed, THE Broadcast_Module SHALL send a comment-reaction event with updated counts
3. WHEN a client connects to the SSE stream, THE Broadcast_Module SHALL include comment events in the event types handled
4. WHEN broadcasting comment events, THE Broadcast_Module SHALL include the full comment data and parent ID for threading

### Requirement 4: Opponent Queue Management

**User Story:** As a debate creator, I want my debate to be visible to potential opponents, so that I can find someone to debate with.

#### Acceptance Criteria

1. WHEN a debate is created without an opponent, THE Matching_Service SHALL add it to the opponent queue
2. WHEN an opponent joins a debate, THE Matching_Service SHALL remove the debate from the opponent queue
3. WHEN listing the opponent queue, THE Matching_Service SHALL return debates ordered by creation time (oldest first)
4. WHEN a debate is concluded or cancelled, THE Matching_Service SHALL remove it from the opponent queue
5. THE Matching_Service SHALL allow filtering the queue by topic keywords or tags

### Requirement 5: Auto-matching Algorithm

**User Story:** As a user, I want to be matched with suitable opponents, so that I can have balanced and engaging debates.

#### Acceptance Criteria

1. WHEN a user requests auto-matching, THE Matching_Service SHALL find debates where the user can take the opposing side
2. WHEN matching, THE Matching_Service SHALL prioritize debates with similar reputation levels (within 20 points)
3. WHEN matching, THE Matching_Service SHALL exclude debates where the user is already the creator
4. WHEN no suitable matches exist, THE Matching_Service SHALL return an empty result without error
5. WHEN multiple matches exist, THE Matching_Service SHALL return the oldest debate first (FIFO)

### Requirement 6: Match Notifications

**User Story:** As a debate creator, I want to be notified when someone joins my debate, so that I can start debating promptly.

#### Acceptance Criteria

1. WHEN an opponent joins a debate, THE Notification_Service SHALL create a notification for the debate creator
2. WHEN a notification is created, THE Notification_Service SHALL store it with user ID, type, message, and read status
3. WHEN retrieving notifications, THE Notification_Service SHALL return unread notifications first, then by creation time
4. WHEN a user marks a notification as read, THE Notification_Service SHALL update the read status
5. THE Notification_Service SHALL support notification types: opponent_joined, debate_started, your_turn

### Requirement 7: Notification Delivery

**User Story:** As a user, I want to receive notifications in real-time, so that I can respond quickly to debate events.

#### Acceptance Criteria

1. WHEN a notification is created, THE Broadcast_Module SHALL send a notification event to the target user's SSE connection
2. WHEN a user connects to the SSE stream, THE Broadcast_Module SHALL support user-specific notification channels
3. WHEN broadcasting notifications, THE Broadcast_Module SHALL include notification ID, type, message, and timestamp
4. IF a user is not connected, THEN THE Notification_Service SHALL store the notification for later retrieval

