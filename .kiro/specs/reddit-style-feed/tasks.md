# Implementation Plan: Reddit-Style Feed

## Overview

This plan transforms the debate index page into a Reddit-style infinite scroll feed with compact debate cards and relocated trending section. Tasks are ordered to build incrementally: backend pagination first, then core feed components, then interactions, and finally polish.

## Tasks

- [x] 1. Add backend pagination support
  - [x] 1.1 Add cursor-based pagination to debates endpoint
    - Modify `/api/debates` to accept `cursor` and `limit` query params
    - Return `{ debates, nextCursor, hasMore, totalCount }` response shape
    - Implement cursor logic using debate ID or createdAt timestamp
    - _Requirements: 1.1, 5.4_

  - [x] 1.2 Create `useInfiniteDebates` hook
    - Wrap TanStack Query's `useInfiniteQuery` with debate-specific logic
    - Handle cursor extraction from response for `getNextPageParam`
    - Support filter param for 'all' vs 'my-debates'
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Implement CompactDebateCard component
  - [x] 2.1 Create CompactDebateCard base structure
    - Build card with resolution, status badge, support/oppose bar
    - Add mind change delta indicator
    - Include mini sparkline component
    - Ensure max-height constraint for feed density
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 2.2 Write property test for card data display
    - **Property 3: Debate Card Data Display**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6, 2.8**

  - [x] 2.3 Add Quick Stance buttons to card
    - Render buttons only for authenticated users
    - Stop event propagation to prevent navigation
    - Show user's existing stance if present
    - _Requirements: 3.3, 3.4, 3.6_

  - [x] 2.4 Write property test for quick stance interaction
    - **Property 4: Quick Stance Interaction**
    - **Validates: Requirements 3.3, 3.4, 3.5, 3.6**

- [x] 3. Checkpoint - Verify card component
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Build InfiniteFeed component
  - [x] 4.1 Create InfiniteFeed container with Intersection Observer
    - Set up scroll container with ref
    - Add Intersection Observer watching sentinel element 200px from bottom
    - Trigger `fetchNextPage` when sentinel intersects
    - _Requirements: 1.1_

  - [x] 4.2 Add loading and end states
    - Show spinner at bottom when `isFetchingNextPage`
    - Show "No more debates" when `!hasNextPage`
    - Show skeleton cards when `isLoading`
    - Show error with retry button when `isError`
    - _Requirements: 1.2, 1.3, 5.1, 5.2, 5.3_

  - [x] 4.3 Write property test for infinite scroll state machine
    - **Property 1: Infinite Scroll State Machine**
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [x] 4.4 Write property test for loading state rendering
    - **Property 7: Loading State Rendering**
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 5. Implement scroll restoration
  - [x] 5.1 Create useScrollRestoration hook
    - Save scroll position to sessionStorage on scroll
    - Restore position on component mount
    - Use debounced save to avoid excessive writes
    - _Requirements: 1.4, 1.5_

  - [x] 5.2 Write property test for scroll position preservation
    - **Property 2: Scroll Position Preservation**
    - **Validates: Requirements 1.4, 1.5**

- [x] 6. Checkpoint - Verify infinite scroll
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Add virtualization for large lists
  - [x] 7.1 Integrate react-virtual for feed virtualization
    - Install `@tanstack/react-virtual`
    - Wrap feed items with virtualizer
    - Only render visible items + buffer
    - Activate when list exceeds 50 items
    - _Requirements: 5.4_

  - [x] 7.2 Write property test for virtualization threshold
    - **Property 8: Virtualization Threshold**
    - **Validates: Requirements 5.4**

- [x] 8. Relocate Trending section to right rail
  - [x] 8.1 Create TrendingRail component
    - Compact list format (not cards)
    - Show resolution, support %, mind changes
    - Limit to 5 items max
    - Sort by activity (mind changes, recency)
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 8.2 Write property test for trending section data
    - **Property 6: Trending Section Data**
    - **Validates: Requirements 4.2, 4.3, 4.4**

  - [x] 8.3 Update IndexRightRail to include TrendingRail
    - Add TrendingRail at top of right rail
    - Remove TrendingDebatesCard from center column
    - _Requirements: 4.1_

- [x] 9. Checkpoint - Verify trending relocation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Add responsive behavior
  - [x] 10.1 Implement mobile-responsive layout
    - Hide trending on viewports < 768px
    - Full-width cards on mobile
    - Larger touch targets (44px min)
    - Larger quick stance buttons on mobile
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 10.2 Write property test for responsive layout
    - **Property 9: Responsive Layout Adaptation**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 11. Wire up index page
  - [x] 11.1 Update index route to use new components
    - Replace DebateIndexList with InfiniteFeed
    - Remove TrendingDebatesCard from center
    - Update IndexRightRail with TrendingRail
    - Connect quick stance handlers
    - _Requirements: All_

  - [x] 11.2 Add prefetch on hover
    - Prefetch debate data after 100ms hover
    - Use existing usePrefetch hook
    - _Requirements: 5.5_

  - [x] 11.3 Write property test for card navigation
    - **Property 5: Card Navigation**
    - **Validates: Requirements 3.2**

- [x] 12. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The existing `DebateIndexRow` and `TrendingDebatesCard` components can be referenced but will be replaced
