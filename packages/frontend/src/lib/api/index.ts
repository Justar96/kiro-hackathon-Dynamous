/**
 * API Layer Index
 * 
 * Centralized exports for the API layer including:
 * - HTTP client utilities
 * - Query keys
 * - Cache strategies
 * - Query options
 * - Mutation functions
 * - API types
 */

// Client utilities
export {
  API_BASE,
  DEFAULT_TIMEOUT,
  ApiError,
  fetchApi,
  mutateApi,
  getAuthHeader,
  isTokenExpired,
  createAbortControllerWithTimeout,
  type ApiErrorCode,
  type FetchApiOptions,
  type MutateApiOptions,
} from './client';

// Query keys
export { queryKeys, type QueryKeysType } from './queryKeys';

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
