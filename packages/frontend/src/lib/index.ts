/**
 * Lib Index - Main Barrel Exports
 */

// ============================================================================
// API Layer
// ============================================================================

export { queryKeys, CACHE_STRATEGIES, mutationKeys } from './api';

export {
  createQueryClient,
  defaultQueryOptions,
  defaultMutationOptions,
  isApiError,
  getErrorMessage,
  requiresReauth,
  isRetryableError,
} from './api';

// ============================================================================
// Data Hooks
// ============================================================================

export {
  useAuthToken,
  useHealthCheck,
  useMarkets,
  useMarket,
  useCreateMarket,
  usePlaceOrder,
  usePositions,
} from './hooks/data';
export type { Market } from './hooks/data';

// ============================================================================
// Auth Hooks
// ============================================================================

export { 
  useSession, 
  useUser, 
  useSignOut, 
  useSessionWatcher,
  hadActiveSession,
  useSignUpCallback,
  useUsernameCheck,
} from './auth';

// ============================================================================
// Form Hooks
// ============================================================================

export {
  useFormPreservation,
  useFormValidation,
  required,
  email,
  minLength,
  maxLength,
  pattern,
  custom,
  useUnsavedChanges,
  useUnsavedChangesControl,
} from './hooks/form';
export type { 
  FormFieldState, 
  FormState, 
  UseFormPreservationOptions, 
  UseFormPreservationReturn,
  ValidationRule,
  FieldConfig,
  FieldState,
  FieldHandlers,
  UseFormValidationReturn,
  UseUnsavedChangesOptions,
} from './hooks/form';

// ============================================================================
// Navigation Hooks
// ============================================================================

export {
  useDeepLink,
  useAutoDeepLink,
  useScrollRestoration,
  useModalUrlSync,
  useModalUrlState,
} from './hooks/navigation';
export type {
  UseDeepLinkOptions,
  UseScrollRestorationOptions,
  UseScrollRestorationResult,
  UseModalUrlSyncOptions,
} from './hooks/navigation';

// ============================================================================
// UI Hooks
// ============================================================================

export {
  useMinimumLoading,
  useMinimumLoadingQuery,
} from './hooks/ui';

// ============================================================================
// SSE (Server-Sent Events)
// ============================================================================

export { 
  SSEProvider, 
  useSSE, 
  useSSEContext,
  SSE_CONSTANTS,
  calculateBackoffDelay,
  useSSEQuerySync,
} from './sse';
export type { 
  SSEConnectionStatus, 
  SSEContextValue, 
  SSEProviderProps,
  SSEEvent,
  UseSSEQuerySyncOptions,
  UseSSEQuerySyncResult,
} from './sse';

// ============================================================================
// Web3 / Wagmi
// ============================================================================

export {
  wagmiConfig,
  Web3Provider,
  POLYGON_CHAIN_ID,
  POLYGON_AMOY_CHAIN_ID,
  DEFAULT_CHAIN_ID,
} from './wagmi';
