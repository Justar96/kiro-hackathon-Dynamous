# Implementation Plan: Real-Time Data Handling

## Overview

This implementation plan transforms the partial SSE implementation into a comprehensive real-time data layer. The approach is incremental: first fixing existing broadcast gaps, then adding new event types, and finally implementing frontend cache integration and index page polling.

## Tasks

- [x] 1. Backend Broadcast Infrastructure
  - [x] 1.1 Create unified broadcast module
    - Create `packages/backend/src/broadcast.ts`
    - Export `broadcastDebateEvent<T>()` function with typed payloads
    - Export `getConnectionCount()` for debugging
    - Move existing `debateConnections` Map to this module
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 1.2 Define SSE event type schemas
    - Create `packages/shared/src/sse-events.ts`
    - Define interfaces for all 7 event types: market, comment, argument, reaction, round, steelman, debate-join
    - Export type union `SSEEvent`
    - _Requirements: 1.3, 1.5_

  - [x] 1.3 Write property test for event schema compliance
    - **Property 2: Event Schema Compliance**
    - Generate random payloads, verify serialization contains required fields
    - **Validates: Requirements 1.5, 2.6, 3.2, 4.2, 5.2, 6.4, 10.3, 11.2**

  - [x] 1.4 Add broadcast calls to existing mutation endpoints
    - Add `broadcastDebateEvent('market', ...)` after stance recording in POST `/api/debates/:id/stance/post`
    - Add `broadcastDebateEvent('market', ...)` after quick stance in POST `/api/debates/:id/stance/quick`
    - Verify existing comment broadcast uses new module
    - _Requirements: 2.1, 2.2, 6.1_

- [x] 2. Argument and Round Broadcasts
  - [x] 2.1 Add argument broadcast
    - Add `broadcastDebateEvent('argument', ...)` after argument submission in POST `/api/debates/:id/arguments`
    - Include argumentId, roundNumber, side, content, debaterId, createdAt in payload
    - _Requirements: 3.1, 3.2_

  - [x] 2.2 Add round transition broadcast
    - Identify where round transitions occur in debate service
    - Add `broadcastDebateEvent('round', ...)` when debate advances to new round
    - Add `broadcastDebateEvent('round', { status: 'concluded' })` when debate concludes
    - _Requirements: 5.1, 5.2, 5.5_

  - [x] 2.3 Write property test for broadcast trigger consistency
    - **Property 3: Broadcast Trigger Consistency**
    - Verify mutations trigger corresponding broadcasts
    - **Validates: Requirements 2.1, 2.2, 3.1, 4.1, 5.1, 6.1, 10.1, 10.2, 11.1**

- [x] 3. Reaction and Steelman Broadcasts
  - [x] 3.1 Add reaction broadcast
    - Add `broadcastDebateEvent('reaction', ...)` after reaction add/remove in POST/DELETE `/api/arguments/:id/react`
    - Need to get debateId from argument's round
    - Include argumentId, reactionType, updated counts in payload
    - _Requirements: 4.1, 4.2_

  - [x] 3.2 Add steelman broadcasts
    - Add `broadcastDebateEvent('steelman', { status: 'pending' })` after steelman submission
    - Add `broadcastDebateEvent('steelman', { status: 'approved'|'rejected' })` after steelman review
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 3.3 Add debate-join broadcast
    - Add `broadcastDebateEvent('debate-join', ...)` after user joins as oppose debater
    - Include opposeDebaterId, opposeDebaterUsername in payload
    - _Requirements: 11.1, 11.2_

- [x] 4. Checkpoint - Backend Broadcasts Complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all 7 event types are being broadcast from appropriate endpoints

- [x] 5. Frontend SSE Enhancement
  - [x] 5.1 Create useSSEQuerySync hook
    - Create `packages/frontend/src/lib/useSSEQuerySync.ts`
    - Accept eventType, queryKey, updateFn, shouldUpdate predicate
    - Use queryClient.setQueryData for cache updates
    - Return isConnected, lastUpdate
    - _Requirements: 9.1, 9.6_

  - [x] 5.2 Enhance SSEProvider with circuit breaker
    - Add errorCount tracking to SSEProvider state
    - Implement circuit breaker: after 3 consecutive errors, pause for 60 seconds
    - Add `connectionStatus: 'circuit-breaker'` state
    - Add `reconnect()` method for manual retry
    - _Requirements: 8.6, 12.3_

  - [x] 5.3 Write property test for exponential backoff
    - **Property 7: Exponential Backoff Reconnection**
    - Generate random failure counts, verify delay calculation
    - **Validates: Requirements 8.1**

  - [x] 5.4 Write property test for circuit breaker
    - **Property 9: Circuit Breaker Activation**
    - Generate error sequences, verify circuit breaker activates after 3 consecutive errors
    - **Validates: Requirements 12.3**

- [x] 6. Frontend Cache Integration Hooks
  - [x] 6.1 Create useSSEMarket hook
    - Create `packages/frontend/src/lib/useSSEMarket.ts`
    - Use useSSEQuerySync with market event type
    - Update queryKeys.market.byDebate cache
    - _Requirements: 2.3, 2.5_

  - [x] 6.2 Create useSSEArguments hook
    - Create `packages/frontend/src/lib/useSSEArguments.ts`
    - Use useSSEQuerySync with argument event type
    - Update debate full query cache to include new argument
    - Handle deduplication for argument author
    - _Requirements: 3.3, 3.4, 3.5_

  - [x] 6.3 Write property test for deduplication
    - **Property 5: Optimistic Update Deduplication**
    - Generate optimistic IDs and matching broadcasts, verify no duplicates
    - **Validates: Requirements 3.5, 6.2**

  - [x] 6.4 Create useSSEReactions hook
    - Create `packages/frontend/src/lib/useSSEReactions.ts`
    - Use useSSEQuerySync with reaction event type
    - Update only counts, not user's own reaction state
    - _Requirements: 4.3, 4.4_

  - [x] 6.5 Create useSSERound hook
    - Create `packages/frontend/src/lib/useSSERound.ts`
    - Use useSSEQuerySync with round event type
    - Update debate cache with new round state
    - Trigger toast notification on round transition
    - _Requirements: 5.3, 5.4, 5.6_

  - [x] 6.6 Create useSSESteelman hook
    - Create `packages/frontend/src/lib/useSSESteelman.ts`
    - Use useSSEQuerySync with steelman event type
    - Update steelman status cache
    - _Requirements: 10.4, 10.5, 10.6_

  - [x] 6.7 Enhance useSSEComments for deduplication
    - Update existing `packages/frontend/src/lib/useSSEComments.ts`
    - Ensure optimistic comment deduplication works correctly
    - Handle threaded comment insertion
    - _Requirements: 6.2, 6.3, 6.5_

- [x] 7. Checkpoint - Frontend Hooks Complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all hooks properly update TanStack Query cache

- [x] 8. Integrate Hooks into Components
  - [x] 8.1 Integrate useSSEMarket in debate detail page
    - Add useSSEMarket hook call in DebateView component
    - Verify market prices update in real-time in RightMarginRail
    - _Requirements: 2.3, 2.4, 2.5_

  - [x] 8.2 Integrate useSSEArguments in debate detail page
    - Add useSSEArguments hook call in DebateDossierContent
    - Verify new arguments appear in RoundSection
    - Add highlight animation for new arguments
    - _Requirements: 3.3, 3.4, 3.6_

  - [x] 8.3 Integrate useSSEReactions in argument components
    - Add useSSEReactions hook where reactions are displayed
    - Verify reaction counts update in real-time
    - _Requirements: 4.3, 4.5_

  - [x] 8.4 Integrate useSSERound in debate detail page
    - Add useSSERound hook call in DebateView
    - Verify round transitions update UI
    - Verify toast notifications appear
    - _Requirements: 5.3, 5.4, 5.6_

  - [x] 8.5 Integrate useSSESteelman in steelman components
    - Add useSSESteelman hook where steelman status is displayed
    - Verify status updates for steelman author
    - _Requirements: 10.4, 10.5, 10.6_

  - [ ] 8.6 Write property test for cache preservation
    - **Property 11: Cache Preservation on Update**
    - Generate partial updates, verify unchanged fields preserved
    - **Validates: Requirements 9.3**

- [x] 9. Index Page Polling
  - [x] 9.1 Create useIndexPolling hook
    - Create `packages/frontend/src/lib/useIndexPolling.ts`
    - Use TanStack Query's refetchInterval option
    - Implement tab visibility detection to pause/resume polling
    - Default interval: 15 seconds
    - _Requirements: 7.1, 7.2, 7.6_

  - [x] 9.2 Write property test for polling pause on tab hidden
    - **Property 12: Polling Pause on Tab Hidden**
    - Verify polling pauses when tab hidden, resumes when visible
    - **Validates: Requirements 7.6**

  - [x] 9.3 Integrate polling in index page
    - Add useIndexPolling hook in HomePage component
    - Update debatesWithMarketQueryOptions to support refetchInterval
    - Add manual refresh button
    - _Requirements: 7.1, 7.5_

  - [x] 9.4 Add loading indicator for refresh
    - Add subtle loading state during refetch
    - Update TrendingDebatesCard to show refresh indicator
    - _Requirements: 7.3, 7.4_

- [x] 10. Error Handling and Recovery
  - [x] 10.1 Implement malformed event handling
    - Wrap JSON.parse in try-catch in SSE event handlers
    - Log errors and continue processing
    - _Requirements: 12.1_

  - [x] 10.2 Implement cache update fallback
    - Wrap setQueryData in try-catch
    - Trigger full invalidation on failure
    - _Requirements: 12.2_

  - [ ] 10.3 Implement 404 fallback to polling
    - Detect 404 response from SSE endpoint
    - Switch to polling mode for that debate
    - _Requirements: 12.6_

  - [x] 10.4 Add connection status UI
    - Update ConnectionStatus component to show all states
    - Add circuit-breaker state with retry button
    - _Requirements: 8.2, 12.4_

  - [x] 10.5 Implement reconnection cache invalidation
    - On successful reconnect, invalidate stale queries
    - Fetch fresh data for critical queries
    - _Requirements: 8.3_

- [x] 11. Checkpoint - Error Handling Complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify error scenarios are handled gracefully

- [x] 12. Connection Cleanup and Optimization
  - [x] 12.1 Implement connection cleanup on navigation
    - Verify SSE connection closes on component unmount
    - Clear all event listeners
    - _Requirements: 8.5_

  - [x] 12.2 Add backend connection cleanup
    - Implement periodic cleanup of stale connections
    - Remove connections that haven't received heartbeat in 60 seconds
    - _Requirements: 1.6_

  - [x] 12.3 Optimize re-render prevention
    - Use shallow comparison in cache updates
    - Skip updates when data matches current cache
    - _Requirements: 9.4_

  - [ ] 12.4 Write property test for connection cleanup
    - **Property 8: Connection Cleanup on Navigation**
    - Verify EventSource is closed on unmount
    - **Validates: Requirements 8.5**

- [x] 13. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all real-time features work end-to-end
  - Test reconnection scenarios
  - Test circuit breaker behavior

## Notes

- All tasks including property-based tests are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
