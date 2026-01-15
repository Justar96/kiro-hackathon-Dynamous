/**
 * API Layer Index
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

// Query client configuration
export {
  createQueryClient,
  defaultQueryOptions,
  defaultMutationOptions,
  isApiError,
  getErrorMessage,
  requiresReauth,
  isRetryableError,
} from './queryClient';

// Query keys
export { queryKeys } from './queryKeys';

// Cache strategies
export { CACHE_STRATEGIES, mutationKeys } from './cache';

// Types
export * from './types';
