# Implementation Plan: Active Round Redesign

## Overview

This plan implements the active round UI redesign, replacing the tab-based navigation with a compact progress bar. Tasks focus on creating the new CompactProgressBar component, updating RoundSection to remove RoundNavigator, and adding engagement-focused improvements.

## Tasks

- [x] 1. Create CompactProgressBar component
  - [x] 1.1 Implement CompactProgressBar base component
    - Create component with progress text and round dots
    - Implement state derivation for dot states (pending, active, completed, viewing)
    - Add click handlers for round navigation
    - Style with compact single-line layout (max 40px height)
    - _Requirements: 2.1, 2.2, 2.3, 2.7_
  - [x] 1.2 Implement RoundDot sub-component
    - Create clickable dot with visual states
    - Add pulse animation for active round
    - Add checkmark/filled state for completed rounds
    - Implement disabled state for inaccessible rounds
    - Add hover feedback for clickable dots
    - _Requirements: 2.4, 2.5, 4.2, 4.3_
  - [x] 1.3 Write property test for round dot click navigation
    - **Property 1: Round Dot Click Navigation**
    - **Validates: Requirements 1.2, 1.3, 2.3, 4.1**
  - [x] 1.4 Write property test for disabled dots
    - **Property 2: Disabled Dots for Inaccessible Rounds**
    - **Validates: Requirements 4.2**
  - [x] 1.5 Write property test for completed round visual state
    - **Property 3: Completed Round Visual State**
    - **Validates: Requirements 2.5**

- [x] 2. Add history and turn indicators
  - [x] 2.1 Implement history viewing indicator
    - Add subtle badge/color when viewing completed round
    - Hide badge text on mobile, show color only
    - _Requirements: 2.6, 5.5_
  - [x] 2.2 Implement user turn highlighting
    - Add prominent highlight when it's user's turn
    - Style with accent color and subtle animation
    - _Requirements: 6.1_
  - [x] 2.3 Write property test for history viewing indicator
    - **Property 4: History Viewing Indicator**
    - **Validates: Requirements 2.6**
  - [x] 2.4 Write property test for user turn highlighting
    - **Property 8: User Turn Highlighting**
    - **Validates: Requirements 6.1**

- [x] 3. Checkpoint - Ensure progress bar tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Add mobile and keyboard support
  - [x] 4.1 Implement mobile abbreviated text
    - Use "R1 · Support" format on mobile viewports
    - Add responsive breakpoint detection
    - _Requirements: 5.1, 5.2_
  - [x] 4.2 Implement swipe gesture navigation
    - Add touch event handlers for horizontal swipe
    - Navigate to adjacent navigable round on swipe
    - Ensure minimum 44px touch targets for dots
    - _Requirements: 1.4, 5.3, 5.4_
  - [x] 4.3 Implement keyboard navigation
    - Add arrow key handlers for round navigation
    - Support Tab focus management
    - _Requirements: 4.5_
  - [x] 4.4 Write property test for mobile abbreviated text
    - **Property 7: Mobile Abbreviated Text**
    - **Validates: Requirements 5.1**
  - [x] 4.5 Write property test for swipe gesture navigation
    - **Property 5: Swipe Gesture Navigation**
    - **Validates: Requirements 1.4, 5.4**
  - [x] 4.6 Write property test for keyboard navigation
    - **Property 6: Keyboard Navigation**
    - **Validates: Requirements 4.5**

- [x] 5. Checkpoint - Ensure mobile/keyboard tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update RoundSection component
  - [x] 6.1 Remove RoundNavigator from RoundSection
    - Remove RoundNavigator import and usage
    - Remove RoundProgressIndicator (replaced by CompactProgressBar)
    - Integrate CompactProgressBar in header area
    - _Requirements: 1.1, 1.2_
  - [x] 6.2 Update RoundSection styling for seamless variant
    - Add variant prop ('card' | 'seamless')
    - Remove outer border/shadow in seamless mode
    - Use subtle background that blends with page
    - Remove divider between progress bar and header
    - _Requirements: 3.1, 3.2, 3.4_
  - [x] 6.3 Integrate round header with progress bar
    - Position header directly below progress bar
    - Maintain typography hierarchy
    - Ensure smooth scroll targets work
    - _Requirements: 3.3, 3.4, 4.4_

- [x] 7. Add engagement improvements
  - [x] 7.1 Add submission CTA when user can submit
    - Show clear call-to-action in progress area
    - Style prominently but not intrusively
    - _Requirements: 6.3_
  - [x] 7.2 Add argument activity indicators
    - Show argument count or activity in progress bar
    - Update on new submissions
    - _Requirements: 6.4_
  - [x] 7.3 Add concluded debate outcome display
    - Show winner/outcome prominently when concluded
    - Replace turn indicator with outcome
    - _Requirements: 6.5_
  - [x] 7.4 Write property test for submission CTA visibility
    - **Property 9: Submission CTA Visibility**
    - **Validates: Requirements 6.3**
  - [x] 7.5 Write property test for concluded debate outcome
    - **Property 10: Concluded Debate Outcome Display**
    - **Validates: Requirements 6.5**

- [x] 8. Checkpoint - Ensure engagement feature tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Update debate page integration
  - [x] 9.1 Update debate page to use seamless variant
    - Pass variant="seamless" to RoundSection
    - Adjust page layout spacing
    - _Requirements: 3.1, 3.2_
  - [x] 9.2 Add optional sticky progress bar
    - Implement sticky positioning on scroll
    - Add subtle shadow when sticky
    - _Requirements: 3.5_

- [x] 10. Cleanup and final polish
  - [x] 10.1 Remove deprecated components
    - Delete or deprecate RoundNavigator if no longer used
    - Clean up unused imports
    - _Requirements: 1.1_
  - [x] 10.2 Verify accessibility
    - Ensure ARIA labels on progress bar
    - Verify keyboard navigation works
    - Test with screen reader
    - _Requirements: 4.5_

- [x] 11. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All property tests are required for comprehensive validation
- All property tests use fast-check with minimum 100 iterations
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation

### Implementation Order Rationale
1. **CompactProgressBar first** - Core new component
2. **History/turn indicators** - Key visual feedback
3. **Mobile/keyboard support** - Accessibility and mobile UX
4. **RoundSection updates** - Integration of new component
5. **Engagement improvements** - Enhanced UX features
6. **Page integration** - Final wiring
7. **Cleanup** - Remove deprecated code

### Files to Modify
- `packages/frontend/src/components/debate/RoundSection.tsx` - Main integration
- `packages/frontend/src/components/debate/RoundSection.types.ts` - Type updates
- `packages/frontend/src/components/debate/RoundSection.utils.ts` - Utility functions
- `packages/frontend/src/routes/debates.$debateId.tsx` - Page integration

### New Files to Create
- `packages/frontend/src/components/debate/CompactProgressBar.tsx`
- `packages/frontend/src/components/debate/CompactProgressBar.property.tsx`

### Files to Potentially Remove/Deprecate
- `packages/frontend/src/components/debate/RoundNavigator.tsx` (may keep for backward compatibility)
- `packages/frontend/src/components/debate/RoundProgressIndicator.tsx` (functionality merged into CompactProgressBar)

