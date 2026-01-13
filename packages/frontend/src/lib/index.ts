// Query options for use with TanStack Query
export * from './queries';

// Mutation functions for API calls
export * from './mutations';

// React hooks for data fetching and mutations
export * from './hooks';

// Optimistic update hooks
export * from './optimistic';

// Session management hooks
export { 
  useSession, 
  useUser, 
  useSignOut, 
  useSessionWatcher,
  hadActiveSession 
} from './useSession';

// Loading state hooks
export { useMinimumLoading, useMinimumLoadingQuery } from './useMinimumLoading';

// Form preservation hooks
export { useFormPreservation } from './useFormPreservation';
export type { 
  FormFieldState, 
  FormState, 
  UseFormPreservationOptions, 
  UseFormPreservationReturn 
} from './useFormPreservation';

// Form validation hooks
export { 
  useFormValidation,
  required,
  email,
  minLength,
  maxLength,
  pattern,
  custom,
} from './useFormValidation';
export type {
  ValidationRule,
  FieldConfig,
  FieldState,
  FieldHandlers,
  UseFormValidationReturn,
} from './useFormValidation';

// SSE (Server-Sent Events) hooks
export { 
  SSEProvider, 
  useSSE, 
  useSSEContext,
  SSE_CONSTANTS,
  calculateBackoffDelay,
} from './useSSE';
export type { 
  SSEConnectionStatus, 
  SSEContextValue, 
  SSEProviderProps,
  SSEEvent,
} from './useSSE';

// SSE Query Sync hook
export {
  useSSEQuerySync,
  createShallowMergeUpdater,
  createDeepMergeUpdater,
  hasDataChanged,
} from './useSSEQuerySync';
export type {
  UseSSEQuerySyncOptions,
  UseSSEQuerySyncResult,
} from './useSSEQuerySync';

// SSE Comment updates hook
export { useSSEComments } from './useSSEComments';

// SSE Market updates hook
export { useSSEMarket } from './useSSEMarket';

// SSE Arguments updates hook
export { useSSEArguments } from './useSSEArguments';

// SSE Reactions updates hook
export { useSSEReactions } from './useSSEReactions';

// SSE Round updates hook
export { useSSERound } from './useSSERound';

// SSE Steelman updates hook
export { useSSESteelman } from './useSSESteelman';

// Scroll restoration hooks
export { 
  useScrollRestoration, 
  useAutoScrollRestoration,
} from './useScrollRestoration';

// Deep link navigation hooks
export {
  useDeepLink,
  useAutoDeepLink,
} from './useDeepLink';
export type { UseDeepLinkOptions } from './useDeepLink';

// Prefetch hooks
export {
  usePrefetch,
  usePrefetchDebate,
  useDebateLinkPrefetch,
} from './usePrefetch';
export type { UsePrefetchOptions } from './usePrefetch';

// Unsaved changes warning hooks
export {
  useUnsavedChanges,
  useUnsavedChangesControl,
} from './useUnsavedChanges';
export type { UseUnsavedChangesOptions } from './useUnsavedChanges';

// Modal URL sync hooks
export {
  useModalUrlSync,
  useModalUrlState,
} from './useModalUrlSync';
export type { UseModalUrlSyncOptions } from './useModalUrlSync';

// Index page polling hook
export {
  useIndexPolling,
  POLLING_CONSTANTS,
} from './useIndexPolling';
export type {
  UseIndexPollingOptions,
  UseIndexPollingResult,
} from './useIndexPolling';
