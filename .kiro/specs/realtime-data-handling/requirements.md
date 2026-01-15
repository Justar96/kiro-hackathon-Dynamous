# Requirements Document

## Introduction

This specification addresses gaps in the real-time data handling architecture of Thesis. The platform currently has partial SSE (Server-Sent Events) implementation for market prices and comments on the debate detail page, but lacks comprehensive real-time updates for critical user interactions including stance changes, argument submissions, reactions, and round transitions. Additionally, the index page has no real-time capabilities, causing stale market data in trending debates.

The goal is to create a unified, consistent real-time data layer that integrates SSE broadcasts with TanStack Query cache management, ensuring all users see live updates without manual refresh.

## Glossary

- **SSE**: Server-Sent Events - a server push technology enabling real-time updates over HTTP
- **TanStack_Query**: React data fetching library managing cache, queries, and mutations
- **Broadcast**: Server-side function that pushes updates to all connected SSE clients
- **Cache_Invalidation**: Process of marking cached data as stale to trigger refetch
- **Optimistic_Update**: UI update applied before server confirmation, rolled back on error
- **Market_Price**: Aggregated support/oppose percentages derived from user stances
- **Stance**: User's position on a debate (pre-read or post-read)
- **Mind_Change**: Difference between user's pre and post stance values
- **Query_Key**: Unique identifier for cached data in TanStack Query
- **Event_Source**: Browser API for receiving SSE events

## Requirements

### Requirement 1: Backend Broadcast Infrastructure

**User Story:** As a platform developer, I want a unified broadcast system, so that all real-time events are consistently pushed to connected clients.

#### Acceptance Criteria

1. THE Backend SHALL export a `broadcastDebateEvent` function that accepts debateId, eventType, and payload parameters
2. WHEN a broadcast is triggered, THE Backend SHALL send the event to all clients connected to that debate's SSE stream
3. THE Backend SHALL support the following event types: `market`, `comment`, `argument`, `reaction`, `round`, `steelman`
4. WHEN no clients are connected to a debate, THE Backend SHALL skip the broadcast without error
5. THE Backend SHALL use consistent JSON serialization format: `{ event: string, data: object }`
6. IF a client connection fails during broadcast, THEN THE Backend SHALL remove that connection from the pool and continue broadcasting to others

### Requirement 2: Market Price Real-Time Updates

**User Story:** As a debate viewer, I want to see market prices update in real-time when others vote, so that I can see live sentiment changes.

#### Acceptance Criteria

1. WHEN a user records a post-stance, THE Backend SHALL broadcast a `market` event with updated prices to all connected clients
2. WHEN a user records a quick stance from the index page, THE Backend SHALL broadcast a `market` event to the relevant debate stream
3. WHEN a `market` event is received, THE Frontend SHALL update the TanStack Query cache for that debate's market data
4. THE Frontend SHALL display market price changes with smooth CSS transitions (500ms duration)
5. WHEN the market price changes, THE Frontend SHALL update both the progress bar width and percentage labels
6. THE Market_Price broadcast payload SHALL include: supportPrice, opposePrice, totalVotes, mindChangeCount

### Requirement 3: Argument Submission Real-Time Updates

**User Story:** As a debate spectator, I want to see new arguments appear immediately when debaters submit them, so that I can follow the debate in real-time.

#### Acceptance Criteria

1. WHEN a debater submits an argument, THE Backend SHALL broadcast an `argument` event to all connected clients
2. THE `argument` event payload SHALL include: argumentId, roundNumber, side, content, debaterId, createdAt
3. WHEN an `argument` event is received, THE Frontend SHALL update the debate rounds cache to include the new argument
4. WHEN an `argument` event is received, THE Frontend SHALL display the new argument in the appropriate round section
5. IF the current user is the argument author, THEN THE Frontend SHALL deduplicate the optimistic update with the broadcast
6. WHEN a new argument appears, THE Frontend SHALL apply a subtle highlight animation to draw attention

### Requirement 4: Reaction Count Real-Time Updates

**User Story:** As a debate viewer, I want to see reaction counts update when others react to arguments, so that I can see which arguments resonate with the audience.

#### Acceptance Criteria

1. WHEN a user adds or removes a reaction, THE Backend SHALL broadcast a `reaction` event to all connected clients
2. THE `reaction` event payload SHALL include: argumentId, reactionType, counts (agree, strongReasoning)
3. WHEN a `reaction` event is received, THE Frontend SHALL update the reactions cache for that argument
4. THE Frontend SHALL NOT update the current user's own reaction state from broadcasts (only from their own actions)
5. WHEN reaction counts change, THE Frontend SHALL animate the count change with a brief scale effect

### Requirement 5: Round Transition Real-Time Updates

**User Story:** As a debate viewer, I want to be notified when the debate advances to a new round, so that I know when new content is available.

#### Acceptance Criteria

1. WHEN a debate advances to a new round, THE Backend SHALL broadcast a `round` event to all connected clients
2. THE `round` event payload SHALL include: debateId, newRoundNumber, currentTurn, previousRoundCompleted
3. WHEN a `round` event is received, THE Frontend SHALL update the debate cache with new round state
4. WHEN a `round` event is received, THE Frontend SHALL display a toast notification: "Round {N} has begun"
5. WHEN a debate concludes, THE Backend SHALL broadcast a `round` event with status: 'concluded'
6. WHEN a concluded event is received, THE Frontend SHALL update the UI to show final results

### Requirement 6: Comment Real-Time Updates Enhancement

**User Story:** As a debate viewer, I want comment updates to be more reliable and include edit/delete notifications, so that the comment section stays synchronized.

#### Acceptance Criteria

1. WHEN a comment is added, THE Backend SHALL broadcast a `comment` event with action: 'add'
2. THE Frontend SHALL deduplicate optimistic comments by checking for `optimistic-` ID prefix before adding broadcast comments
3. WHEN a `comment` event is received, THE Frontend SHALL update the comments cache using TanStack Query's setQueryData
4. THE `comment` event payload SHALL include: action, comment object, parentId (if reply)
5. WHEN a comment is a reply, THE Frontend SHALL insert it in the correct threaded position

### Requirement 7: Index Page Real-Time Updates

**User Story:** As a user browsing debates, I want the index page to show live market data, so that I can see which debates are most active right now.

#### Acceptance Criteria

1. THE Frontend SHALL implement polling for the debates list with a configurable interval (default: 15 seconds)
2. WHEN polling is enabled, THE Frontend SHALL use TanStack Query's refetchInterval option
3. THE Frontend SHALL provide a visual indicator when data is being refreshed (subtle loading state)
4. WHEN new market data arrives, THE Frontend SHALL update the TrendingDebatesCard with smooth transitions
5. THE Frontend SHALL allow users to manually refresh the list via a refresh button
6. WHILE the browser tab is not visible, THE Frontend SHALL pause polling to conserve resources

### Requirement 8: SSE Connection Management

**User Story:** As a user, I want reliable SSE connections that recover from network issues, so that I don't miss real-time updates.

#### Acceptance Criteria

1. WHEN an SSE connection fails, THE Frontend SHALL attempt reconnection with exponential backoff (1s, 2s, 4s... up to 30s max)
2. THE Frontend SHALL display a connection status indicator showing: connected, connecting, disconnected, error
3. WHEN reconnected after a disconnect, THE Frontend SHALL invalidate stale queries to fetch missed updates
4. THE Frontend SHALL send periodic heartbeat acknowledgments to detect stale connections
5. WHEN the user navigates away from a debate page, THE Frontend SHALL cleanly close the SSE connection
6. THE Frontend SHALL limit reconnection attempts to 10 before showing a "connection failed" message with manual retry option

### Requirement 9: TanStack Query Cache Integration

**User Story:** As a developer, I want SSE events to properly integrate with TanStack Query cache, so that the UI stays consistent and performant.

#### Acceptance Criteria

1. WHEN an SSE event is received, THE Frontend SHALL use queryClient.setQueryData to update the relevant cache
2. THE Frontend SHALL use query key factories consistently for all cache operations
3. WHEN updating cache from SSE, THE Frontend SHALL preserve existing data structure and only update changed fields
4. THE Frontend SHALL NOT trigger unnecessary re-renders when SSE data matches current cache
5. WHEN an SSE event contains data newer than cache, THE Frontend SHALL replace the cached data
6. THE Frontend SHALL implement a useSSEQuerySync hook that handles cache updates for any event type

### Requirement 10: Steelman Gate Real-Time Updates

**User Story:** As a debater, I want to be notified immediately when my opponent reviews my steelman, so that I can proceed with my argument.

#### Acceptance Criteria

1. WHEN a steelman is submitted, THE Backend SHALL broadcast a `steelman` event with status: 'pending'
2. WHEN a steelman is approved or rejected, THE Backend SHALL broadcast a `steelman` event with the review result
3. THE `steelman` event payload SHALL include: steelmanId, debateId, roundNumber, status, rejectionReason (if rejected)
4. WHEN a steelman event is received by the author, THE Frontend SHALL update the steelman status UI
5. WHEN a steelman is approved, THE Frontend SHALL enable the argument submission form
6. WHEN a steelman is rejected, THE Frontend SHALL display the rejection reason and allow resubmission

### Requirement 11: Debate Join Real-Time Updates

**User Story:** As a debate creator waiting for an opponent, I want to be notified when someone joins my debate, so that I know the debate can begin.

#### Acceptance Criteria

1. WHEN a user joins a debate as the oppose debater, THE Backend SHALL broadcast a `debate-join` event
2. THE `debate-join` event payload SHALL include: debateId, opposeDebaterId, opposeDebaterUsername
3. WHEN a `debate-join` event is received, THE Frontend SHALL update the debate cache with the new opponent
4. WHEN a `debate-join` event is received by the debate creator, THE Frontend SHALL display a toast: "{username} has joined as opponent"
5. THE Frontend SHALL update the "Seeking Opponents" section on the index page to remove the joined debate

### Requirement 12: Error Handling and Recovery

**User Story:** As a user, I want graceful error handling when real-time updates fail, so that I can still use the platform reliably.

#### Acceptance Criteria

1. IF an SSE event contains malformed JSON, THEN THE Frontend SHALL log the error and continue processing other events
2. IF a cache update fails, THEN THE Frontend SHALL trigger a full query invalidation as fallback
3. THE Frontend SHALL implement circuit breaker pattern: after 3 consecutive SSE errors, pause for 60 seconds
4. WHEN in circuit breaker state, THE Frontend SHALL show a banner: "Real-time updates paused. Click to retry."
5. THE Frontend SHALL track SSE error rates and log them for monitoring
6. IF the backend SSE endpoint returns 404, THEN THE Frontend SHALL fall back to polling mode
