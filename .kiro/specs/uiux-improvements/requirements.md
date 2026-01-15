# Requirements Document

## Introduction

This specification covers UI/UX improvements and enhanced frontend-backend wiring for Thesis. The focus areas include:

1. Sign-in modal experience - replacing full-page auth with a modal overlay for seamless authentication
2. Improved authentication patterns - better loading states, error handling, and user feedback
3. Enhanced frontend-backend wiring - optimistic updates, better caching strategies, and real-time sync
4. UI polish and consistency - ensuring all components follow the paper-clean aesthetic

## Glossary

- **Auth_Modal**: A modal overlay component for sign-in/sign-up that appears over the current page without navigation
- **Optimistic_Update**: A UI pattern where changes appear immediately before server confirmation, then reconcile on response
- **Toast_Notification**: A subtle, non-blocking notification that appears briefly to confirm actions
- **Loading_Skeleton**: A placeholder UI that mimics the shape of content while data loads
- **Error_Boundary**: A React component that catches JavaScript errors and displays a fallback UI
- **Query_Invalidation**: The process of marking cached data as stale to trigger a refetch
- **Mutation_Hook**: A TanStack Query hook for performing create/update/delete operations with proper state management

## Requirements

### Requirement 1: Sign-In Modal

**User Story:** As a user, I want to sign in via a modal overlay, so that I can authenticate without losing my current page context.

#### Acceptance Criteria

1. WHEN a user clicks "Sign In" from any page THEN THE System SHALL display a modal overlay with the sign-in form
2. WHEN a user clicks "Sign Up" from any page THEN THE System SHALL display a modal overlay with the sign-up form
3. WHEN the modal is open THEN THE System SHALL dim the background and prevent scrolling on the underlying page
4. WHEN a user clicks outside the modal or presses Escape THEN THE System SHALL close the modal and return to the previous state
5. WHEN a user successfully authenticates THEN THE System SHALL close the modal and refresh the user session
6. THE Modal SHALL follow the paper-clean aesthetic with warm off-white background and subtle shadows
7. WHEN the modal is open THEN THE System SHALL trap focus within the modal for accessibility
8. IF authentication fails THEN THE System SHALL display an error message within the modal without closing it

### Requirement 2: Authentication State Management

**User Story:** As a user, I want clear feedback during authentication, so that I know the status of my sign-in attempt.

#### Acceptance Criteria

1. WHEN authentication is in progress THEN THE System SHALL display a loading indicator on the submit button
2. WHEN authentication succeeds THEN THE System SHALL display a brief success toast notification
3. WHEN authentication fails THEN THE System SHALL display an error message with actionable guidance
4. WHEN a user signs out THEN THE System SHALL clear all cached user data and redirect appropriately
5. THE System SHALL persist authentication state across page refreshes
6. WHEN a protected action requires authentication THEN THE System SHALL open the sign-in modal automatically

### Requirement 3: Optimistic Updates for User Actions

**User Story:** As a user, I want my actions to feel instant, so that the interface feels responsive and modern.

#### Acceptance Criteria

1. WHEN a user submits a stance vote THEN THE System SHALL immediately update the UI before server confirmation
2. WHEN a user adds a reaction THEN THE System SHALL immediately show the reaction count increment
3. WHEN a user posts a comment THEN THE System SHALL immediately display the comment in the thread
4. IF an optimistic update fails THEN THE System SHALL revert the UI and display an error toast
5. WHEN an optimistic update succeeds THEN THE System SHALL reconcile with server data silently
6. THE System SHALL prevent duplicate submissions during pending mutations

### Requirement 4: Enhanced Loading States

**User Story:** As a user, I want meaningful loading indicators, so that I understand what content is being fetched.

#### Acceptance Criteria

1. WHEN debate data is loading THEN THE System SHALL display skeleton loaders matching the paper-clean aesthetic
2. WHEN market data is loading THEN THE System SHALL display a subtle pulse animation on the market chart area
3. WHEN comments are loading THEN THE System SHALL display skeleton comment blocks
4. THE Loading_Skeleton components SHALL match the exact dimensions of the content they replace
5. WHEN data fails to load THEN THE System SHALL display a retry button with error context
6. THE System SHALL show loading states for a minimum of 200ms to prevent flash of loading content

### Requirement 5: Error Handling and Recovery

**User Story:** As a user, I want graceful error handling, so that I can recover from failures without losing my work.

#### Acceptance Criteria

1. WHEN an API request fails THEN THE System SHALL display a contextual error message
2. WHEN a network error occurs THEN THE System SHALL offer a retry option
3. WHEN a form submission fails THEN THE System SHALL preserve the user's input
4. THE Error_Boundary SHALL catch rendering errors and display a fallback UI
5. WHEN an error occurs THEN THE System SHALL log it for debugging without exposing technical details to users
6. IF a critical error occurs THEN THE System SHALL offer a "Return to Home" option

### Requirement 6: Toast Notification System

**User Story:** As a user, I want subtle notifications for my actions, so that I receive feedback without disruption.

#### Acceptance Criteria

1. THE Toast_Notification SHALL appear in the bottom-right corner of the viewport
2. THE Toast_Notification SHALL auto-dismiss after 3 seconds for success messages
3. THE Toast_Notification SHALL persist until dismissed for error messages
4. WHEN multiple toasts are queued THEN THE System SHALL stack them vertically with a maximum of 3 visible
5. THE Toast_Notification SHALL support success, error, and info variants
6. THE Toast_Notification SHALL follow the paper-clean aesthetic with minimal styling
7. THE Toast_Notification SHALL be dismissible via click or swipe on mobile

### Requirement 7: Form Validation and Feedback

**User Story:** As a user, I want clear validation feedback, so that I can correct errors before submission.

#### Acceptance Criteria

1. WHEN a form field has an error THEN THE System SHALL display the error message below the field
2. WHEN a user corrects an error THEN THE System SHALL clear the error message immediately
3. THE System SHALL validate required fields on blur and on submit
4. WHEN a form is invalid THEN THE System SHALL focus the first invalid field
5. THE System SHALL display character counts for fields with limits (resolution text, arguments)
6. THE Validation_Messages SHALL be concise and actionable

### Requirement 8: Responsive Modal Behavior

**User Story:** As a mobile user, I want modals to work well on small screens, so that I can authenticate on any device.

#### Acceptance Criteria

1. WHEN the viewport is mobile-sized THEN THE Modal SHALL display as a bottom sheet
2. WHEN the viewport is tablet or larger THEN THE Modal SHALL display as a centered overlay
3. THE Modal SHALL be scrollable if content exceeds viewport height
4. THE Modal SHALL have appropriate touch targets (minimum 44px) on mobile
5. WHEN the keyboard opens on mobile THEN THE Modal SHALL adjust to remain visible

### Requirement 9: Real-Time Data Synchronization

**User Story:** As a user, I want to see live updates, so that I'm always viewing current debate data.

#### Acceptance Criteria

1. WHEN another user submits a stance THEN THE System SHALL update the market chart within 5 seconds
2. WHEN a new comment is posted THEN THE System SHALL display it without requiring a page refresh
3. WHEN a debate round advances THEN THE System SHALL update the debate status in real-time
4. THE System SHALL use SSE (Server-Sent Events) for real-time updates
5. WHEN the SSE connection drops THEN THE System SHALL attempt to reconnect automatically
6. THE System SHALL indicate connection status subtly in the UI

### Requirement 10: Navigation and Routing Improvements

**User Story:** As a user, I want smooth navigation, so that moving between pages feels seamless.

#### Acceptance Criteria

1. WHEN navigating between pages THEN THE System SHALL preserve scroll position on back navigation
2. WHEN a debate link is shared THEN THE System SHALL deep-link to the correct section
3. THE System SHALL prefetch debate data on hover for faster navigation
4. WHEN a user navigates away from an unsaved form THEN THE System SHALL warn before losing changes
5. THE System SHALL update the URL when modal state changes for shareability

