# Implementation Plan: UI/UX Improvements

## Overview

This plan implements UI/UX improvements for the Debate Platform, focusing on modal-based authentication, optimistic updates, toast notifications, and enhanced error handling. Tasks build incrementally on the existing codebase.

## Tasks

- [-] 1. Modal system foundation
  - [ ] 1.1 Create ModalOverlay base component
    - Implement overlay with backdrop dimming
    - Add click-outside-to-close behavior
    - Add Escape key handler
    - Implement focus trap for accessibility
    - Support size variants (sm, md, lg)
    - _Requirements: 1.3, 1.4, 1.7_
  - [ ] 1.2 Write property test for focus trap
    - **Property 3: Focus Trap Integrity**
    - **Validates: Requirements 1.7**
  - [ ] 1.3 Create BottomSheet component for mobile
    - Implement slide-up animation
    - Add swipe-to-dismiss gesture
    - Support snap points
    - _Requirements: 8.1_
  - [ ] 1.4 Create responsive Modal wrapper
    - Detect viewport size
    - Render BottomSheet on mobile (<640px)
    - Render ModalOverlay on tablet/desktop
    - _Requirements: 8.1, 8.2_
  - [ ] 1.5 Write property test for responsive modal rendering
    - **Property 24: Responsive Modal Rendering**
    - **Validates: Requirements 8.1, 8.2**

- [ ] 2. Checkpoint - Ensure modal foundation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Auth modal implementation
  - [ ] 3.1 Create AuthModalContext and provider
    - Implement context with isOpen, view, openSignIn, openSignUp, close
    - Track returnUrl for post-auth redirect
    - _Requirements: 1.1, 1.2_
  - [ ] 3.2 Create AuthModal component
    - Integrate with Neon Auth AuthView
    - Handle sign-in and sign-up views
    - Display loading state on submit button
    - Display error messages within modal
    - _Requirements: 1.1, 1.2, 1.8, 2.1_
  - [ ] 3.3 Write property test for modal open state
    - **Property 1: Modal Open State Consistency**
    - **Validates: Requirements 1.1, 1.2, 1.3**
  - [ ] 3.4 Write property test for modal close state
    - **Property 2: Modal Close State Consistency**
    - **Validates: Requirements 1.4, 1.5**
  - [ ] 3.5 Write property test for auth error display
    - **Property 4: Auth Error Display Without Modal Close**
    - **Validates: Requirements 1.8**
  - [ ] 3.6 Update navigation to use auth modal
    - Replace Link to /auth/* with modal triggers
    - Add AuthModalProvider to app root
    - Update SignedOut section in Navigation
    - _Requirements: 1.1, 1.2_
  - [ ] 3.7 Implement protected action auth gate
    - Create useRequireAuth hook
    - Open sign-in modal when unauthenticated user attempts protected action
    - _Requirements: 2.6_
  - [ ] 3.8 Write property test for protected action auth gate
    - **Property 8: Protected Action Auth Gate**
    - **Validates: Requirements 2.6**

- [ ] 4. Checkpoint - Ensure auth modal tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Toast notification system
  - [ ] 5.1 Create ToastContext and provider
    - Implement toast queue with max 3 visible
    - Support success, error, info variants
    - Handle auto-dismiss for success (3s)
    - Persist error toasts until dismissed
    - _Requirements: 6.2, 6.3, 6.4, 6.5_
  - [ ] 5.2 Create Toast component
    - Implement paper-clean styling
    - Add dismiss button
    - Support action button
    - Add slide-in/out animations
    - _Requirements: 6.1, 6.6, 6.7_
  - [ ] 5.3 Create ToastContainer component
    - Position in bottom-right corner
    - Stack toasts vertically
    - Handle toast transitions
    - _Requirements: 6.1, 6.4_
  - [ ] 5.4 Write property test for success toast auto-dismiss
    - **Property 17: Success Toast Auto-Dismiss**
    - **Validates: Requirements 6.2**
  - [ ] 5.5 Write property test for error toast persistence
    - **Property 18: Error Toast Persistence**
    - **Validates: Requirements 6.3**
  - [ ] 5.6 Write property test for toast stack limit
    - **Property 19: Toast Stack Limit**
    - **Validates: Requirements 6.4**
  - [ ] 5.7 Add ToastProvider to app root
    - Wrap app with ToastProvider
    - Create useToast hook for easy access
    - _Requirements: 6.1_

- [ ] 6. Checkpoint - Ensure toast system tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Optimistic updates implementation
  - [ ] 7.1 Create useOptimisticStance hook
    - Implement optimistic update for pre/post stance
    - Handle rollback on error
    - Reconcile with server response
    - _Requirements: 3.1, 3.4, 3.5_
  - [ ] 7.2 Create useOptimisticReaction hook
    - Implement optimistic update for reactions
    - Increment/decrement count immediately
    - Handle rollback on error
    - _Requirements: 3.2, 3.4, 3.5_
  - [ ] 7.3 Create useOptimisticComment hook
    - Implement optimistic update for comments
    - Add pending comment to list immediately
    - Handle rollback on error
    - _Requirements: 3.3, 3.4, 3.5_
  - [ ] 7.4 Write property test for optimistic update immediacy
    - **Property 9: Optimistic Update Immediacy**
    - **Validates: Requirements 3.1, 3.2, 3.3**
  - [ ] 7.5 Write property test for optimistic update rollback
    - **Property 10: Optimistic Update Rollback**
    - **Validates: Requirements 3.4**
  - [ ] 7.6 Write property test for optimistic update reconciliation
    - **Property 11: Optimistic Update Reconciliation**
    - **Validates: Requirements 3.5**
  - [ ] 7.7 Implement duplicate submission prevention
    - Disable submit buttons during pending mutations
    - Track pending state in mutation hooks
    - _Requirements: 3.6_
  - [ ] 7.8 Write property test for loading state during submission
    - **Property 5: Loading State During Auth**
    - **Validates: Requirements 2.1, 3.6**

- [ ] 8. Checkpoint - Ensure optimistic update tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Enhanced loading states
  - [ ] 9.1 Enhance SkeletonLoader component
    - Add variants: text, heading, paragraph, avatar, button, card
    - Match paper-clean aesthetic
    - Support custom dimensions
    - _Requirements: 4.1, 4.3_
  - [ ] 9.2 Implement minimum loading duration
    - Create useMinimumLoading hook
    - Ensure loading state shows for at least 200ms
    - _Requirements: 4.6_
  - [ ] 9.3 Write property test for skeleton display
    - **Property 12: Skeleton Display During Loading**
    - **Validates: Requirements 4.1, 4.3**
  - [ ] 9.4 Write property test for minimum loading duration
    - **Property 14: Minimum Loading Duration**
    - **Validates: Requirements 4.6**
  - [ ] 9.5 Update debate list loading state
    - Use enhanced skeleton loaders
    - Apply minimum loading duration
    - _Requirements: 4.1_
  - [ ] 9.6 Update debate view loading state
    - Use enhanced skeleton loaders for all sections
    - Apply minimum loading duration
    - _Requirements: 4.1, 4.3_

- [ ] 10. Error handling improvements
  - [ ] 10.1 Enhance ErrorBoundary component
    - Add onError callback for logging
    - Add onReset callback for recovery
    - Create paper-clean fallback UI
    - Add "Return to Home" button
    - _Requirements: 5.4, 5.5, 5.6_
  - [ ] 10.2 Write property test for error boundary fallback
    - **Property 16: Error Boundary Fallback**
    - **Validates: Requirements 5.4**
  - [ ] 10.3 Create ErrorMessage component
    - Support inline, block, and toast variants
    - Add retry button option
    - _Requirements: 5.1, 5.2_
  - [ ] 10.4 Write property test for error state with retry
    - **Property 13: Error State with Retry**
    - **Validates: Requirements 4.5, 5.1, 5.2**
  - [ ] 10.5 Implement form input preservation
    - Preserve form values on submission error
    - Clear only on successful submission
    - _Requirements: 5.3_
  - [ ] 10.6 Write property test for form input preservation
    - **Property 15: Form Input Preservation on Error**
    - **Validates: Requirements 5.3**

- [ ] 11. Checkpoint - Ensure error handling tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Form validation enhancements
  - [ ] 12.1 Create FormField component
    - Support text, email, password, textarea types
    - Display error messages below field
    - Show character count for limited fields
    - Clear errors on valid input
    - _Requirements: 7.1, 7.2, 7.5_
  - [ ] 12.2 Create useFormValidation hook
    - Validate on blur and submit
    - Track touched and dirty state
    - Focus first invalid field on submit
    - _Requirements: 7.3, 7.4_
  - [ ] 12.3 Write property test for form validation behavior
    - **Property 21: Form Validation Behavior**
    - **Validates: Requirements 7.1, 7.2, 7.3**
  - [ ] 12.4 Write property test for invalid form focus
    - **Property 22: Invalid Form Focus**
    - **Validates: Requirements 7.4**
  - [ ] 12.5 Write property test for character count display
    - **Property 23: Character Count Display**
    - **Validates: Requirements 7.5**
  - [ ] 12.6 Update debate creation form
    - Use FormField component
    - Add character count for resolution
    - Implement validation
    - _Requirements: 7.1, 7.3, 7.5_

- [ ] 13. Checkpoint - Ensure form validation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Real-time updates enhancement
  - [ ] 14.1 Create SSEProvider and context
    - Manage SSE connection lifecycle
    - Track connection status
    - Implement automatic reconnection with exponential backoff
    - _Requirements: 9.4, 9.5_
  - [ ] 14.2 Create useSSE hook
    - Subscribe to specific event types
    - Handle event parsing
    - Return connection status
    - _Requirements: 9.4_
  - [ ] 14.3 Write property test for SSE reconnection
    - **Property 26: SSE Reconnection**
    - **Validates: Requirements 9.5**
  - [ ] 14.4 Implement connection status indicator
    - Show subtle indicator when disconnected
    - Hide when connected
    - _Requirements: 9.6_
  - [ ] 14.5 Wire SSE to market data updates
    - Update market chart on stance events
    - Update within 5 seconds of event
    - _Requirements: 9.1_
  - [ ] 14.6 Wire SSE to comment updates
    - Add new comments without refresh
    - _Requirements: 9.2_
  - [ ] 14.7 Write property test for real-time event propagation
    - **Property 27: Real-Time Event Propagation**
    - **Validates: Requirements 9.1, 9.2, 9.3**

- [ ] 15. Checkpoint - Ensure real-time update tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Navigation improvements
  - [ ] 16.1 Implement scroll position restoration
    - Create useScrollRestoration hook
    - Save scroll position before navigation
    - Restore on back navigation
    - _Requirements: 10.1_
  - [ ] 16.2 Write property test for scroll restoration
    - **Property 28: Scroll Position Restoration**
    - **Validates: Requirements 10.1**
  - [ ] 16.3 Implement deep link navigation
    - Parse URL hash on page load
    - Scroll to corresponding section
    - _Requirements: 10.2_
  - [ ] 16.4 Write property test for deep link navigation
    - **Property 29: Deep Link Navigation**
    - **Validates: Requirements 10.2**
  - [ ] 16.5 Implement data prefetch on hover
    - Create usePrefetch hook
    - Prefetch debate data on link hover (100ms delay)
    - _Requirements: 10.3_
  - [ ] 16.6 Write property test for data prefetch
    - **Property 30: Data Prefetch on Hover**
    - **Validates: Requirements 10.3**
  - [ ] 16.7 Implement unsaved changes warning
    - Create useUnsavedChanges hook
    - Show confirmation dialog on navigation
    - _Requirements: 10.4_
  - [ ] 16.8 Write property test for unsaved changes warning
    - **Property 31: Unsaved Changes Warning**
    - **Validates: Requirements 10.4**
  - [ ] 16.9 Implement modal URL sync
    - Update URL when modal opens/closes
    - Parse URL on load to restore modal state
    - _Requirements: 10.5_
  - [ ] 16.10 Write property test for modal URL sync
    - **Property 32: Modal URL Sync**
    - **Validates: Requirements 10.5**

- [ ] 17. Integration and wiring
  - [ ] 17.1 Wire auth modal to existing flows
    - Update all auth-required actions to use modal
    - Add success toast on auth completion
    - _Requirements: 1.5, 2.2_
  - [ ] 17.2 Write property test for toast on auth success
    - **Property 6: Toast Display on Auth Success**
    - **Validates: Requirements 2.2, 1.5**
  - [ ] 17.3 Wire optimistic updates to existing mutations
    - Update stance recording to use optimistic hooks
    - Update reaction adding to use optimistic hooks
    - Update comment posting to use optimistic hooks
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ] 17.4 Wire toast notifications to all user actions
    - Show success toast on stance recorded
    - Show success toast on comment posted
    - Show error toast on failures
    - _Requirements: 6.2, 6.3_
  - [ ] 17.5 Update all forms to use enhanced validation
    - Debate creation form
    - Comment form
    - Stance input
    - _Requirements: 7.1, 7.3_

- [ ] 18. Session and cache management
  - [ ] 18.1 Implement session persistence
    - Verify auth state persists across refresh
    - Handle session expiry gracefully
    - _Requirements: 2.5_
  - [ ] 18.2 Write property test for session persistence
    - **Property 7: Session Persistence Across Refresh**
    - **Validates: Requirements 2.5**
  - [ ] 18.3 Implement cache clearing on sign out
    - Clear all user-specific cached data
    - Redirect to home page
    - _Requirements: 2.4_

- [ ] 19. Final polish and accessibility
  - [ ] 19.1 Ensure all modals have proper ARIA attributes
    - Add role="dialog"
    - Add aria-modal="true"
    - Add aria-labelledby for title
    - _Requirements: 1.7_
  - [ ] 19.2 Ensure touch targets are 44px minimum
    - Audit all interactive elements
    - Increase padding where needed
    - _Requirements: 8.4_
  - [ ] 19.3 Add keyboard navigation support
    - Ensure all actions are keyboard accessible
    - Add visible focus indicators
    - _Requirements: 1.7_
  - [ ] 19.4 Test responsive behavior
    - Verify modal renders correctly on all breakpoints
    - Verify toast positioning on mobile
    - _Requirements: 8.1, 8.2_

- [ ] 20. Final checkpoint - Full system verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks including property-based tests are required for comprehensive validation
- All property tests use fast-check with minimum 100 iterations
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation

### Implementation Order Rationale
1. **Modal foundation first** - Base components needed for auth modal
2. **Auth modal** - Core UX improvement, enables protected action gates
3. **Toast system** - Needed for feedback on all subsequent features
4. **Optimistic updates** - Improves perceived performance
5. **Loading states** - Polish for data fetching
6. **Error handling** - Graceful degradation
7. **Form validation** - Better user input experience
8. **Real-time updates** - Enhanced SSE integration
9. **Navigation** - Final polish for routing
10. **Integration** - Wire everything together

### Testing Strategy
- Property tests validate universal behaviors
- Unit tests cover specific edge cases
- Integration tests verify full user flows
- All tests use React Testing Library + fast-check

