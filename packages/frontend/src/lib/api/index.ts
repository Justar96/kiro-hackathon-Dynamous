/**
 * API Layer Index
 *
 * Centralized exports for the API layer including:
 * - HTTP client utilities
 * - Query client configuration
 * - Query keys
 * - Cache strategies
 * - Query options
 * - Mutation functions
 * - API types
 *
 * @module api
 */

// Client utilities
export {
  API_BASE,
  DEFAULT_TIMEOUT,
  ApiError,
  fetchApi,
  mutateApi,
  getAuthHeader,
  requireAuthToken,
  isTokenExpired,
  createAbortControllerWithTimeout,
  type ApiErrorCode,
  type FetchApiOptions,
  type MutateApiOptions,
} from './client';

// Query client configuration (TanStack Query v5)
export {
  createQueryClient,
  defaultQueryOptions,
  defaultMutationOptions,
  isApiError,
  getErrorMessage,
  requiresReauth,
  isRetryableError,
} from './queryClient';

// Query keys with enhanced type helpers
export {
  queryKeys,
  type QueryKeysType,
  type DebateQueryKey,
  type DebateAllKey,
  type DebateListKey,
  type DebateWithMarketKey,
  type DebateDetailKey,
  type DebateFullKey,
  type DebateInfiniteKey,
  type MarketQueryKey,
  type MarketAllKey,
  type MarketByDebateKey,
  type StanceQueryKey,
  type StanceAllKey,
  type StanceByDebateKey,
  type CommentQueryKey,
  type CommentAllKey,
  type CommentByDebateKey,
  type CommentInfiniteKey,
  type UserQueryKey,
  type UserAllKey,
  type UserCurrentKey,
  type UserDetailKey,
  type UserStatsKey,
  type UserDebatesKey,
  type LeaderboardQueryKey,
  type SteelmanQueryKey,
  type AnyQueryKey,
} from './queryKeys';

// Cache strategies
export {
  CACHE_STRATEGIES,
  getCacheStrategy,
  mutationKeys,
  DEFAULT_MUTATION_OPTIONS,
  type CacheStrategyName,
  type CacheStrategyOptions,
} from './cache';

// Query options
export * from './queries';

// Mutation functions
export * from './mutations';

// Types
export * from './types';
