# Implementation Plan: Unified Round Section

## Overview

This plan implements the UX redesign that consolidates three separate round sections into a single dynamic component. The implementation follows an incremental approach, building core utilities first, then components, and finally integrating into the debate page.

## Tasks

- [x] 1. Create core utility functions and types
  - [x] 1.1 Create UnifiedRoundSection types and interfaces
    - Add types file at `packages/frontend/src/components/UnifiedRoundSection.types.ts`
    - Define `UnifiedRoundSectionProps`, `RoundStep`, `RoundStepState`, `RoundSummary`
    - Export shared types for child components
    - _Requirements: 1.1, 2.4_

  - [x] 1.2 Implement round state derivation utilities
    - Create `deriveRoundStates` function
    - Create `canNavigateToRound` function
    - Create `generateExcerpt` function for history summaries
    - Create `getRoundLabel` helper
    - _Requirements: 2.1, 2.3, 3.5, 4.3_

  - [x] 1.3 Write property test for round state derivation
    - **Property 2: Round State Derivation Correctness**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 2. Implement RoundProgressIndicator component
  - [x] 2.1 Create RoundProgressIndicator component
    - Create `packages/frontend/src/components/RoundProgressIndicator.tsx`
    - Display "Round X of 3" with current turn indicator
    - Show visual states for each round step (completed/active/pending)
    - Handle "viewing history" state when viewedRound !== currentRound
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.2 Write property test for progress indicator
    - **Property 2: Round State Derivation Correctness** (rendering aspect)
    - **Validates: Requirements 2.1, 2.2**

- [x] 3. Implement RoundNavigator component
  - [x] 3.1 Create RoundNavigator component
    - Create `packages/frontend/src/components/RoundNavigator.tsx`
    - Render horizontal stepper with three tabs (Opening, Rebuttal, Closing)
    - Apply visual states from `deriveRoundStates`
    - Disable navigation to unavailable rounds
    - Handle click events to update viewedRound
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Write property test for navigation logic
    - **Property 3: Navigation State Transitions**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5**

- [x] 4. Implement RoundHistory component
  - [x] 4.1 Create RoundHistory component
    - Create `packages/frontend/src/components/RoundHistory.tsx`
    - Render collapsed summary of completed rounds
    - Show truncated excerpts using `generateExcerpt`
    - Handle expand/collapse toggle
    - Handle click to navigate to full round view
    - Hide when no history exists (Round 1)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 4.2 Write property test for history visibility
    - **Property 4: History Visibility Rules**
    - **Validates: Requirements 4.1, 4.3, 4.5**

- [x] 5. Checkpoint - Core components complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement ActiveRoundView component
  - [x] 6.1 Create ActiveRoundView component
    - Create `packages/frontend/src/components/ActiveRoundView.tsx`
    - Display round header with title and description
    - Render ArgumentBlock components for support/oppose
    - Show ArgumentSubmissionForm when appropriate
    - Handle citation hover and mind changed callbacks
    - _Requirements: 1.1, 7.1, 7.4_

  - [x] 6.2 Create ArgumentSubmissionForm component
    - Create `packages/frontend/src/components/ArgumentSubmissionForm.tsx`
    - Display textarea with character counter
    - Show correct limit based on round type (2000/1500/1000)
    - Handle submit with loading state
    - _Requirements: 7.2, 7.3_

  - [x] 6.3 Write property test for form visibility
    - **Property 6: Argument Form Visibility**
    - **Validates: Requirements 7.1, 7.4**

  - [x] 6.4 Write property test for character limits
    - **Property 7: Character Limit Display**
    - **Validates: Requirements 7.2**

- [x] 7. Implement UnifiedRoundSection container
  - [x] 7.1 Create UnifiedRoundSection component
    - Create `packages/frontend/src/components/UnifiedRoundSection.tsx`
    - Manage viewedRound state
    - Compose RoundProgressIndicator, RoundNavigator, RoundHistory, ActiveRoundView
    - Handle round navigation callbacks
    - Handle argument submission
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 7.2 Write property test for round display
    - **Property 1: Round Display Matches Debate State**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

- [x] 8. Checkpoint - UnifiedRoundSection complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Handle state preservation and transitions
  - [x] 9.1 Implement state preservation during updates
    - Preserve viewedRound when SSE events arrive
    - Preserve "This changed my mind" attribution state
    - Handle round completion auto-transition
    - _Requirements: 3.6, 5.4, 5.5, 7.5_

  - [x] 9.2 Write property test for state preservation
    - **Property 5: State Preservation During Updates**
    - **Validates: Requirements 3.6, 5.4, 5.5**

  - [x] 9.3 Write property test for round completion transition
    - **Property 8: Round Completion Triggers Transition**
    - **Validates: Requirements 7.3, 7.5**

- [x] 10. Update LeftNavRail for unified TOC
  - [x] 10.1 Modify LeftNavRail TOC structure
    - Update `packages/frontend/src/components/LeftNavRail.tsx`
    - Replace three round entries with single "Debate Rounds" entry
    - Add round indicator "(X/3)" to label
    - Maintain Resolution, Outcome, Discussion entries
    - _Requirements: 8.1, 8.3, 8.4_

  - [x] 10.2 Write property test for TOC label
    - **Property 9: TOC Label Generation**
    - **Validates: Requirements 8.3**

- [x] 11. Integrate into debate page
  - [x] 11.1 Update DebateView to use UnifiedRoundSection
    - Modify `packages/frontend/src/routes/debates.$debateId.tsx`
    - Replace three RoundSection components with UnifiedRoundSection
    - Update TOC sections array
    - Wire up all callbacks (citation hover, mind changed, argument submit)
    - _Requirements: 1.1, 8.1, 8.2_

  - [x] 11.2 Update loading skeleton
    - Modify `DebateViewPending` to match new unified structure
    - Show single round skeleton instead of three
    - _Requirements: 4.1_

- [x] 12. Add mobile responsiveness
  - [x] 12.1 Add mobile styles for RoundNavigator
    - Implement compact tab interface for mobile
    - Add touch/swipe support if feasible
    - _Requirements: 6.1_

  - [x] 12.2 Add mobile styles for RoundHistory
    - Implement bottom sheet or expandable section
    - Ensure progress indicator stays visible
    - _Requirements: 6.2, 6.3, 6.4_

- [x] 13. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Verify mobile responsiveness
  - Test with real debate data

## Notes

- All tasks including property tests are required
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties using fast-check
- Existing `ArgumentBlock` component is reused without modification
- Mobile swipe gestures (6.5) are optional enhancement
