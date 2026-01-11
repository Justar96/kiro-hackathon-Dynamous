# Implementation Plan: Auth & Profile Enhancements

## Overview

This plan implements enhancements to the authentication experience and user profile dropdown menu. Tasks build incrementally, starting with the custom dropdown component, then sign-up enhancements, and finally auth modal styling.

## Tasks

- [-] 1. Custom Profile Dropdown Foundation
  - [x] 1.1 Create UserAvatar component
    - Implement avatar with image or initial fallback
    - Support size variants (sm, md, lg)
    - Use platform styling (rounded-subtle, text-primary bg for initials)
    - _Requirements: 5.1_
  - [x] 1.2 Create ProfileDropdown component structure
    - Implement dropdown state management (open/close)
    - Create trigger button with avatar
    - Create dropdown menu container
    - Position dropdown below trigger
    - _Requirements: 1.1_
  - [x] 1.3 Write property test for dropdown toggle behavior

    - **Property 1: Dropdown Toggle Behavior**
    - **Validates: Requirements 1.1**
  - [x] 1.4 Implement click outside and Escape to close
    - Add click outside listener
    - Add Escape key handler
    - Clean up listeners on unmount
    - _Requirements: 1.7_
  - [x] 1.5 Write property test for dropdown close behavior

    - **Property 3: Dropdown Close on Outside Click/Escape**
    - **Validates: Requirements 1.7**

- [x] 2. Checkpoint - Ensure dropdown foundation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Profile Dropdown Content
  - [x] 3.1 Create dropdown header with user info
    - Display avatar (image or initial)
    - Display user's display name
    - Display user's email in secondary text
    - Fetch platform user data for additional info
    - _Requirements: 1.2, 5.1, 5.2, 5.3_
  - [x] 3.2 Write property test for user info display

    - **Property 2: Dropdown User Info Display**
    - **Validates: Requirements 1.2, 5.1, 5.2, 5.3**
  - [x] 3.3 Add sandbox status indicator
    - Show badge when user is in sandbox mode
    - Display debates progress (X/5)
    - Hide when sandbox completed
    - _Requirements: 5.4_
  - [x] 3.4 Write property test for sandbox status display

    - **Property 9: Sandbox Status Display**
    - **Validates: Requirements 5.4**
  - [x] 3.5 Add reputation score display
    - Show reputation score in header
    - Format score appropriately
    - _Requirements: 5.5_


  - [x] 3.6 Write property test for reputation score display

    - **Property 10: Reputation Score Display**
    - **Validates: Requirements 5.5**
  - [x] 3.7 Add navigation menu items
    - Add "View Profile" link to /users/$userId
    - Add "My Debates" link (filtered view)
    - Style menu items with paper-clean aesthetic
    - _Requirements: 1.3, 1.4_
  - [x] 3.8 Add Sign Out action
    - Implement sign out button
    - Call auth sign out method
    - Clear cached data on sign out
    - Show confirmation toast
    - _Requirements: 1.5_

- [x] 4. Checkpoint - Ensure dropdown content tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Responsive Behavior
  - [x] 5.1 Implement responsive trigger display
    - Show only avatar on mobile (<640px)
    - Show avatar + name on tablet/desktop (≥640px)
    - Use Tailwind responsive classes
    - _Requirements: 1.9, 4.1, 4.2_
  - [x] 5.2 Write property test for responsive trigger

    - **Property 5: Responsive Trigger Display**
    - **Validates: Requirements 1.9, 4.1, 4.2**
  - [x] 5.3 Ensure touch targets are 44px minimum
    - Audit trigger button size
    - Audit menu item sizes
    - Add appropriate padding
    - _Requirements: 1.8, 4.4_
  - [x] 5.4 Write property test for touch targets

    - **Property 4: Touch Target Minimum Size**
    - **Validates: Requirements 1.8, 4.4**
  - [x] 5.5 Implement viewport-aware positioning
    - Detect if dropdown would overflow viewport
    - Adjust position to stay within bounds
    - _Requirements: 4.3_
  - [x] 5.6 Write property test for viewport bounds

    - **Property 8: Dropdown Menu Viewport Bounds**
    - **Validates: Requirements 4.3**

- [x] 6. Checkpoint - Ensure responsive behavior tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Sign-Up Flow Enhancements
  - [x] 7.1 Add username field to AuthProvider
    - Configure additionalFields with username
    - Set required: true
    - Add placeholder text
    - _Requirements: 2.1_
  - [x] 7.2 Implement username validation
    - Validate minimum 3 characters
    - Validate alphanumeric + underscore only
    - Display inline error messages
    - _Requirements: 2.2_
  - [x] 7.3 Write property test for username validation

    - **Property 6: Username Validation**
    - **Validates: Requirements 2.2**
  - [x] 7.4 Implement username uniqueness check
    - Add API endpoint for username availability
    - Check on blur or debounced input
    - Display availability status
    - _Requirements: 2.3_
  - [x] 7.5 Create user profile on sign-up success
    - Hook into auth success callback
    - Create platform user record with username
    - _Requirements: 2.4_
  - [x] 7.6 Create onboarding welcome toast
    - Display welcome message after sign-up
    - Explain sandbox mode (0.5× vote weight)
    - Explain 5 debates to unlock full weight
    - Auto-dismiss after reading time
    - _Requirements: 2.5, 2.6, 2.7_

- [x] 8. Checkpoint - Ensure sign-up flow tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Auth Modal Styling
  - [x] 9.1 Create CSS overrides for Neon Auth UI
    - Override font-family variables
    - Override color variables
    - Override border-radius variables
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 9.2 Write property test for auth modal styling

    - **Property 7: Auth Modal Styling Consistency**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.8**
  - [x] 9.3 Style error and success states
    - Apply oppose color (#DC2626) to errors
    - Apply support color (#059669) to success
    - _Requirements: 3.5, 3.6_
  - [x] 9.4 Style OAuth buttons
    - Apply consistent button styling
    - Match platform aesthetic
    - _Requirements: 3.7_
  - [x] 9.5 Style links with accent color
    - Apply accent color (#2563EB) to links
    - Add hover state styling
    - _Requirements: 3.8_

- [x] 10. Checkpoint - Ensure auth modal styling tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Integration and Wiring
  - [x] 11.1 Replace UserButton with ProfileDropdown in navigation
    - Remove Neon Auth UserButton import
    - Add ProfileDropdown component
    - Wire up user session data
    - _Requirements: 1.1_
  - [x] 11.2 Wire dropdown to user profile data
    - Fetch platform user data
    - Pass to dropdown component
    - Handle loading state
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [x] 11.3 Test full sign-up to profile flow
    - Verify username collection
    - Verify profile creation
    - Verify onboarding toast
    - Verify dropdown shows correct data
    - _Requirements: 2.1, 2.4, 2.5_

- [x] 12. Final Checkpoint - Full system verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests use fast-check with minimum 100 iterations when implemented
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- CSS overrides use custom properties for maintainability

### Implementation Order Rationale
1. **Dropdown foundation first** - Core component structure and behavior
2. **Dropdown content** - User info, navigation, sign out
3. **Responsive behavior** - Mobile/desktop adaptations
4. **Sign-up enhancements** - Username collection and onboarding
5. **Auth modal styling** - Visual alignment with platform
6. **Integration** - Wire everything together

### Testing Strategy
- Property tests validate universal behaviors
- Unit tests cover specific edge cases
- Integration tests verify full user flows
- All tests use React Testing Library + fast-check
