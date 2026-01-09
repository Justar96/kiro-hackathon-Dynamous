# Design Document: UI/UX Improvements

## Overview

This document describes the technical design for UI/UX improvements to the Debate Platform, focusing on:

1. **Sign-in modal experience** - A modal-based authentication flow that keeps users in context
2. **Enhanced state management** - Optimistic updates, better caching, and real-time synchronization
3. **Improved feedback systems** - Toast notifications, loading states, and error handling
4. **Responsive patterns** - Mobile-first modal behavior and touch-friendly interactions

The design follows the existing paper-clean aesthetic while adding polish and responsiveness to user interactions.

### Tech Stack (Existing)
- **Frontend**: TanStack React (Query, Router) with Bun runtime
- **Backend**: Bun + Hono
- **Database**: Neon PostgreSQL with Drizzle ORM
- **Authentication**: Neon Auth (@neondatabase/neon-js)
- **Styling**: Tailwind CSS
- **Real-time**: Server-Sent Events (SSE)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  AuthModal   │  │ ToastProvider│  │ ErrorBoundary│  │ SSEProvider │ │
│  │  Component   │  │   Context    │  │   Wrapper    │  │   Context   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
│         │                 │                 │                 │         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Application Components                         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │  Debate  │  │  Stance  │  │ Comments │  │    Navigation    │  │  │
│  │  │   View   │  │  Input   │  │  Thread  │  │     Header       │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│              TanStack Query (Optimistic Updates + Cache)               │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ HTTP/SSE
┌──────────────────────────────┴──────────────────────────────────────────┐
│                      Backend (Hono + Bun)                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │  SSE Stream  │  │  API Routes  │  │  Validation Middleware       │  │
│  │   Manager    │  │  (existing)  │  │  (enhanced error responses)  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Modal System

#### AuthModal
A modal component for authentication that overlays the current page.

```typescript
interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: 'sign-in' | 'sign-up';
  onSuccess?: () => void;
  returnUrl?: string;
}

// Usage context
interface AuthModalContextValue {
  isOpen: boolean;
  view: 'sign-in' | 'sign-up';
  openSignIn: (returnUrl?: string) => void;
  openSignUp: (returnUrl?: string) => void;
  close: () => void;
}
```

#### ModalOverlay
Base modal component with accessibility features.

```typescript
interface ModalOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  trapFocus?: boolean;
}
```

#### BottomSheet
Mobile-specific modal variant that slides up from bottom.

```typescript
interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  snapPoints?: number[];  // Heights as percentages
  initialSnap?: number;
}
```

### Toast Notification System

#### ToastProvider
Context provider for managing toast notifications.

```typescript
interface ToastProviderProps {
  children: React.ReactNode;
  maxToasts?: number;        // Default: 3
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

interface ToastContextValue {
  showToast: (toast: ToastOptions) => string;
  dismissToast: (id: string) => void;
  dismissAll: () => void;
}

interface ToastOptions {
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;         // Default: 3000ms for success, null for error
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

#### Toast
Individual toast notification component.

```typescript
interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  onDismiss: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

### Loading States

#### SkeletonLoader
Enhanced skeleton component matching paper-clean aesthetic.

```typescript
interface SkeletonLoaderProps {
  variant: 'text' | 'heading' | 'paragraph' | 'avatar' | 'button' | 'card';
  width?: string | number;
  height?: string | number;
  lines?: number;            // For paragraph variant
  className?: string;
}
```

#### LoadingOverlay
Overlay for blocking interactions during critical operations.

```typescript
interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  blur?: boolean;
}
```

### Error Handling

#### ErrorBoundary (Enhanced)
Improved error boundary with recovery options.

```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onReset?: () => void;
}

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}
```

#### ErrorMessage
Inline error display component.

```typescript
interface ErrorMessageProps {
  error: Error | string | null;
  onRetry?: () => void;
  variant?: 'inline' | 'block' | 'toast';
}
```

### Form Components

#### FormField
Enhanced form field with validation feedback.

```typescript
interface FormFieldProps {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'textarea';
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  maxLength?: number;
  showCharCount?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}
```

#### SubmitButton
Button with loading state for form submissions.

```typescript
interface SubmitButtonProps {
  isLoading: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  loadingText?: string;
  variant?: 'primary' | 'secondary';
}
```

### Real-Time Updates

#### SSEProvider
Context provider for Server-Sent Events connection.

```typescript
interface SSEProviderProps {
  children: React.ReactNode;
  debateId?: string;
}

interface SSEContextValue {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  subscribe: (event: string, handler: (data: unknown) => void) => () => void;
}
```

#### useSSE Hook
Hook for subscribing to SSE events.

```typescript
function useSSE<T>(
  eventType: string,
  handler: (data: T) => void,
  deps?: React.DependencyList
): {
  isConnected: boolean;
  connectionStatus: string;
};
```

### Optimistic Update Hooks

#### useOptimisticMutation
Generic hook for mutations with optimistic updates.

```typescript
interface OptimisticMutationOptions<TData, TVariables, TContext> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onMutate: (variables: TVariables) => TContext | Promise<TContext>;
  onError: (error: Error, variables: TVariables, context: TContext) => void;
  onSuccess?: (data: TData, variables: TVariables, context: TContext) => void;
  onSettled?: () => void;
}
```

#### useOptimisticStance
Optimistic update hook for stance voting.

```typescript
function useOptimisticStance(debateId: string): {
  recordStance: (type: 'pre' | 'post', value: StanceValue) => void;
  isPending: boolean;
  error: Error | null;
};
```

#### useOptimisticReaction
Optimistic update hook for reactions.

```typescript
function useOptimisticReaction(argumentId: string): {
  addReaction: (type: 'agree' | 'strong_reasoning') => void;
  removeReaction: (type: 'agree' | 'strong_reasoning') => void;
  isPending: boolean;
};
```

#### useOptimisticComment
Optimistic update hook for comments.

```typescript
function useOptimisticComment(debateId: string): {
  addComment: (content: string, parentId?: string) => void;
  isPending: boolean;
  pendingComments: Comment[];
};
```

### Navigation Hooks

#### useScrollRestoration
Hook for preserving scroll position.

```typescript
function useScrollRestoration(key: string): {
  scrollRef: React.RefObject<HTMLElement>;
  restoreScroll: () => void;
};
```

#### usePrefetch
Hook for prefetching data on hover.

```typescript
function usePrefetch<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
  options?: { staleTime?: number }
): {
  prefetch: () => void;
  isPrefetched: boolean;
};
```

#### useUnsavedChanges
Hook for warning before navigation with unsaved changes.

```typescript
function useUnsavedChanges(hasChanges: boolean, message?: string): void;
```

## Data Models

### Toast State
```typescript
interface ToastState {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration: number | null;
  createdAt: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

### Modal State
```typescript
interface ModalState {
  isOpen: boolean;
  view: 'sign-in' | 'sign-up';
  returnUrl: string | null;
}
```

### SSE Connection State
```typescript
interface SSEConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastEventId: string | null;
  reconnectAttempts: number;
  lastConnectedAt: number | null;
}
```

### Form Validation State
```typescript
interface FormValidationState {
  isValid: boolean;
  isDirty: boolean;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
}
```

### Optimistic Update Context
```typescript
interface OptimisticContext<T> {
  previousData: T;
  optimisticData: T;
  timestamp: number;
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Modal Open State Consistency

*For any* trigger action (sign-in click, sign-up click, protected action), the modal state SHALL transition to open with the correct view ('sign-in' or 'sign-up'), and the body scroll SHALL be locked.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Modal Close State Consistency

*For any* close action (overlay click, Escape key, successful auth), the modal state SHALL transition to closed, body scroll SHALL be unlocked, and the previous page state SHALL be preserved.

**Validates: Requirements 1.4, 1.5**

### Property 3: Focus Trap Integrity

*For any* open modal, tabbing through focusable elements SHALL cycle within the modal bounds and never escape to the underlying page.

**Validates: Requirements 1.7**

### Property 4: Auth Error Display Without Modal Close

*For any* authentication failure, the modal SHALL remain open AND an error message SHALL be displayed within the modal.

**Validates: Requirements 1.8**

### Property 5: Loading State During Auth

*For any* authentication submission, the submit button SHALL display a loading indicator while the request is pending, AND the button SHALL be disabled to prevent duplicate submissions.

**Validates: Requirements 2.1, 3.6**

### Property 6: Toast Display on Auth Success

*For any* successful authentication, a success toast SHALL appear AND the modal SHALL close.

**Validates: Requirements 2.2, 1.5**

### Property 7: Session Persistence Across Refresh

*For any* authenticated session, refreshing the page SHALL preserve the authentication state (user remains logged in).

**Validates: Requirements 2.5**

### Property 8: Protected Action Auth Gate

*For any* protected action attempted by an unauthenticated user, the sign-in modal SHALL open automatically.

**Validates: Requirements 2.6**

### Property 9: Optimistic Update Immediacy

*For any* user mutation (stance vote, reaction, comment), the UI SHALL update immediately before the server response, AND the update SHALL be visible within the same render cycle.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 10: Optimistic Update Rollback

*For any* failed mutation after an optimistic update, the UI SHALL revert to the previous state AND an error toast SHALL be displayed.

**Validates: Requirements 3.4**

### Property 11: Optimistic Update Reconciliation

*For any* successful mutation after an optimistic update, the final UI state SHALL match the server response data.

**Validates: Requirements 3.5**

### Property 12: Skeleton Display During Loading

*For any* data fetch (debates, comments, market data), skeleton loaders SHALL be displayed while the request is pending.

**Validates: Requirements 4.1, 4.3**

### Property 13: Error State with Retry

*For any* failed data fetch, an error message SHALL be displayed AND a retry button SHALL be available.

**Validates: Requirements 4.5, 5.1, 5.2**

### Property 14: Minimum Loading Duration

*For any* loading state, the skeleton/loading indicator SHALL be displayed for at least 200ms, even if data arrives sooner.

**Validates: Requirements 4.6**

### Property 15: Form Input Preservation on Error

*For any* form submission failure, all user-entered values SHALL be preserved in the form fields.

**Validates: Requirements 5.3**

### Property 16: Error Boundary Fallback

*For any* rendering error caught by ErrorBoundary, a fallback UI SHALL be displayed instead of a blank screen.

**Validates: Requirements 5.4**

### Property 17: Success Toast Auto-Dismiss

*For any* success toast, it SHALL auto-dismiss after 3000ms (±100ms tolerance).

**Validates: Requirements 6.2**

### Property 18: Error Toast Persistence

*For any* error toast, it SHALL NOT auto-dismiss and SHALL remain visible until explicitly dismissed by the user.

**Validates: Requirements 6.3**

### Property 19: Toast Stack Limit

*For any* number of queued toasts, at most 3 SHALL be visible simultaneously, with older toasts being dismissed first.

**Validates: Requirements 6.4**

### Property 20: Toast Dismissal

*For any* visible toast, clicking on it SHALL dismiss it immediately.

**Validates: Requirements 6.7**

### Property 21: Form Validation Behavior

*For any* form field with validation rules:
- Validation SHALL run on blur AND on submit
- Error messages SHALL appear below invalid fields
- Error messages SHALL clear when the field becomes valid

**Validates: Requirements 7.1, 7.2, 7.3**

### Property 22: Invalid Form Focus

*For any* form submission with validation errors, focus SHALL move to the first invalid field.

**Validates: Requirements 7.4**

### Property 23: Character Count Display

*For any* form field with a character limit, the current character count SHALL be displayed and updated on each keystroke.

**Validates: Requirements 7.5**

### Property 24: Responsive Modal Rendering

*For any* modal:
- On viewports < 640px, it SHALL render as a bottom sheet
- On viewports ≥ 640px, it SHALL render as a centered overlay

**Validates: Requirements 8.1, 8.2**

### Property 25: Modal Scroll Behavior

*For any* modal with content exceeding viewport height, the modal content area SHALL be scrollable.

**Validates: Requirements 8.3**

### Property 26: SSE Reconnection

*For any* SSE connection drop, the system SHALL attempt to reconnect within 5 seconds, with exponential backoff on repeated failures.

**Validates: Requirements 9.5**

### Property 27: Real-Time Event Propagation

*For any* server event (stance update, new comment, round advance), the UI SHALL reflect the change within 5 seconds of the event occurring.

**Validates: Requirements 9.1, 9.2, 9.3**

### Property 28: Scroll Position Restoration

*For any* back navigation, the scroll position SHALL be restored to where the user was before navigating away.

**Validates: Requirements 10.1**

### Property 29: Deep Link Navigation

*For any* URL with a hash fragment (e.g., #round-2), the page SHALL scroll to the corresponding section on load.

**Validates: Requirements 10.2**

### Property 30: Data Prefetch on Hover

*For any* debate link hovered for more than 100ms, the debate data SHALL be prefetched into the query cache.

**Validates: Requirements 10.3**

### Property 31: Unsaved Changes Warning

*For any* navigation attempt from a form with unsaved changes, a confirmation dialog SHALL appear before navigation proceeds.

**Validates: Requirements 10.4**

### Property 32: Modal URL Sync

*For any* modal open/close action, the URL SHALL update to reflect the modal state (e.g., ?auth=sign-in).

**Validates: Requirements 10.5**

## Error Handling

### Modal Errors
- Auth failure → Display error message in modal, keep modal open
- Network error during auth → Display "Connection error. Please try again." with retry button
- Invalid credentials → Display "Invalid email or password" message

### Optimistic Update Errors
- Mutation failure → Revert UI to previous state, show error toast
- Network timeout → Show "Request timed out" toast with retry action
- Validation error → Show specific validation message in toast

### SSE Connection Errors
- Connection drop → Attempt reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- Max retries exceeded → Show "Live updates unavailable" indicator, fall back to polling
- Server error → Log error, continue with cached data

### Form Validation Errors
- Required field empty → "This field is required"
- Email invalid → "Please enter a valid email address"
- Password too short → "Password must be at least 8 characters"
- Character limit exceeded → "Maximum {limit} characters allowed"

### API Errors
- 400 Bad Request → Display validation error message from response
- 401 Unauthorized → Open sign-in modal
- 403 Forbidden → Display "You don't have permission to do this"
- 404 Not Found → Display "Resource not found" with back button
- 429 Rate Limited → Display "Too many requests. Please wait." with countdown
- 500 Server Error → Display "Something went wrong. Please try again."

## Testing Strategy

### Unit Tests
- Modal component rendering and state transitions
- Toast component rendering and auto-dismiss timing
- Form validation logic
- Error boundary fallback rendering
- Skeleton loader variants

### Property-Based Tests
Property-based tests will use fast-check to verify universal properties:

- **Modal State Properties**: Test that modal state transitions are consistent across all trigger/close combinations
- **Optimistic Update Properties**: Test that UI updates immediately and reconciles correctly for random mutation sequences
- **Toast Queue Properties**: Test that toast stacking and dismissal works correctly for random toast sequences
- **Form Validation Properties**: Test that validation runs correctly for random input sequences
- **SSE Reconnection Properties**: Test that reconnection attempts follow exponential backoff pattern

### Integration Tests
- Full auth flow (sign-in modal → submit → success → modal close)
- Optimistic update flow (action → immediate UI update → server response → reconciliation)
- SSE event handling (connect → receive event → UI update)
- Navigation with scroll restoration

### Test Configuration
- Minimum 100 iterations per property test
- Use fast-check for property-based testing
- Mock SSE connections for deterministic testing
- Use React Testing Library for component tests

