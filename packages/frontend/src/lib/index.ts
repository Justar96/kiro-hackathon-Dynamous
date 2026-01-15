/**
 * Lib Index - Main Barrel Exports
 * 
 * This file provides backward-compatible exports from the reorganized lib structure.
 * The lib folder has been restructured into:
 * 
 * - api/        - API client, queries, mutations, types, cache strategies
 * - sse/        - Server-Sent Events hooks and providers
 * - hooks/      - React hooks organized by domain
 *   - data/     - Data fetching hooks (debates, stances, comments, etc.)
 *   - optimistic/ - Optimistic update hooks
 *   - form/     - Form state and validation hooks
 *   - navigation/ - URL, scroll, and prefetch hooks
 *   - ui/       - UI utility hooks (loading, polling, etc.)
 * - auth/       - Authentication hooks
 * - utils/      - Utility functions
 */

// ============================================================================
// API Layer
// ============================================================================

// Query options and keys
export {
  queryKeys,
  debatesQueryOptions,
  debateFullQueryOptions,
  marketQueryOptions,
  userStanceQueryOptions,
  stanceStatsQueryOptions,
  commentsQueryOptions,
  commentsInfiniteQueryOptions,
  reactionsQueryOptions,
  currentUserQueryOptions,
  userQueryOptions,
  userStatsQueryOptions,
  userDebatesQueryOptions,
  votingHistoryQueryOptions,
  healthCheckQueryOptions,
  steelmanStatusQueryOptions,
  pendingSteelmansQueryOptions,
  debatesWithMarketQueryOptions,
  leaderboardQueryOptions,
  topUsersQueryOptions,
} from './api';
export type { UseInfiniteDebatesOptions, TopArgument, TopUser } from './api';

// Mutation functions
export {
  createDebate,
  joinDebate,
  submitArgument,
  recordPreStance,
  recordPostStance,
  recordQuickStance,
  addComment,
  addReaction,
  removeReaction,
  attributeImpact,
  markMindChanged,
  submitSteelman,
  reviewSteelman,
  deleteSteelman,
} from './api';

// Cache strategies
export { CACHE_STRATEGIES, mutationKeys } from './api';

// Query client configuration (TanStack Query v5)
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
  // Auth token
  useAuthToken,
  // Debates
  useDebates,
  useDebateFull,
  useCreateDebate,
  useJoinDebate,
  useSubmitArgument,
  useInfiniteDebates,
  // Market
  useMarket,
  // Stances
  useUserStance,
  useRecordPreStance,
  useRecordPostStance,
  useQuickStance,
  // Comments
  useComments,
  useInfiniteComments,
  useAddComment,
  // Reactions
  useReactions,
  useBatchReactions,
  useAddReaction,
  useRemoveReaction,
  // Impact
  useAttributeImpact,
  useMindChanged,
  // Users
  useCurrentUser,
  useUserProfile,
  useUserStats,
  // Health
  useHealthCheck,
  // Steelman
  useSteelmanStatus,
  usePendingSteelmans,
  useSubmitSteelman,
  useReviewSteelman,
  useDeleteSteelman,
} from './hooks/data';
export type { UseInfiniteDebatesResult } from './hooks/data';

// ============================================================================
// Optimistic Update Hooks
// ============================================================================

export {
  useOptimisticStance,
  useOptimisticReaction,
  useOptimisticComment,
} from './hooks/optimistic';
export type { StanceResponse, ReactionsResponse, OptimisticContext } from './hooks/optimistic';

// Mutation helpers
export { getMutationErrorMessage, normalizeMutationError } from './hooks/mutationHelpers';

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
  // Form preservation
  useFormPreservation,
  // Form validation
  useFormValidation,
  required,
  email,
  minLength,
  maxLength,
  pattern,
  custom,
  // Unsaved changes
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
  // Deep links
  useDeepLink,
  useAutoDeepLink,
  // Scroll restoration
  useScrollRestoration,
  // Modal URL sync
  useModalUrlSync,
  useModalUrlState,
  // Prefetch
  usePrefetch,
  usePrefetchDebate,
  useDebateLinkPrefetch,
} from './hooks/navigation';
export type {
  UseDeepLinkOptions,
  UseScrollRestorationOptions,
  UseScrollRestorationResult,
  UseModalUrlSyncOptions,
  UsePrefetchOptions,
} from './hooks/navigation';

// ============================================================================
// UI Hooks
// ============================================================================

export {
  // Scroll-based unlock
  useAfterStanceUnlock,
  // Reading progress
  useReadingProgress,
  // Minimum loading
  useMinimumLoading,
  useMinimumLoadingQuery,
  // Index polling
  useIndexPolling,
  POLLING_CONSTANTS,
} from './hooks/ui';
export type {
  UseIndexPollingOptions,
  UseIndexPollingResult,
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
  createShallowMergeUpdater,
  createDeepMergeUpdater,
  hasDataChanged,
  // Domain-specific SSE hooks
  useSSEComments,
  useSSEMarket,
  useSSEArguments,
  useSSEReactions,
  useSSERound,
  useSSESteelman,
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
// Utils
// ============================================================================

export { 
  DEBATE_TEMPLATES, 
  getRandomTopic, 
  getTopicsByCategory,
  getCategories,
  getRandomTopicFromCategory,
  getAllTopics,
} from './utils';
export type { DebateCategory } from './utils';
