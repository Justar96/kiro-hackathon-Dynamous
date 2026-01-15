/**
 * Query Client Configuration
 *
 * Centralized TanStack Query client configuration with:
 * - Global error type registration (v5 feature)
 * - Default query/mutation options
 * - Error handling utilities
 *
 * @module api/queryClient
 */

import { QueryClient, QueryClientConfig } from '@tanstack/react-query';
import { ApiError } from './client';
import { CACHE_STRATEGIES, DEFAULT_MUTATION_OPTIONS } from './cache';

// ============================================================================
// Global Type Registration
// ============================================================================

/**
 * Register ApiError as the default error type for all queries/mutations.
 * This enables type-safe error handling without explicit generic annotations.
 *
 * TanStack Query v5 Best Practice: Use Register interface for global types.
 *
 * @example
 * ```typescript
 * const { error } = useQuery(someQueryOptions);
 * // error is typed as ApiError | null
 * if (error?.isRetryable) {
 *   // TypeScript knows about ApiError methods
 * }
 * ```
 */
declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ApiError;
  }
}

// ============================================================================
// Query Client Default Options
// ============================================================================

/**
 * Default options for all queries.
 * Can be overridden per-query via queryOptions.
 */
export const defaultQueryOptions = {
  ...CACHE_STRATEGIES.standard,
  retry: (failureCount: number, error: ApiError) => {
    // Don't retry on non-retryable errors (auth, validation, not found)
    if (ApiError.isApiError(error) && !error.isRetryable) {
      return false;
    }
    // Retry up to 2 times for retryable errors
    return failureCount < 2;
  },
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
} as const;

/**
 * Default options for all mutations.
 */
export const defaultMutationOptions = {
  ...DEFAULT_MUTATION_OPTIONS,
  retry: false, // Never retry mutations by default
} as const;

// ============================================================================
// Query Client Factory
// ============================================================================

/**
 * Create a configured QueryClient instance.
 * Use this factory to ensure consistent configuration across the app.
 *
 * TanStack Query v5 Best Practice: Centralize QueryClient creation.
 *
 * @example
 * ```typescript
 * // In app entry point
 * const queryClient = createQueryClient();
 *
 * function App() {
 *   return (
 *     <QueryClientProvider client={queryClient}>
 *       <Router />
 *     </QueryClientProvider>
 *   );
 * }
 * ```
 *
 * @param config - Optional additional configuration to merge
 * @returns Configured QueryClient instance
 */
export function createQueryClient(config?: Partial<QueryClientConfig>): QueryClient {
  const mergedDefaultOptions = {
    queries: {
      ...defaultQueryOptions,
      ...config?.defaultOptions?.queries,
    },
    mutations: {
      ...defaultMutationOptions,
      ...config?.defaultOptions?.mutations,
    },
  };

  return new QueryClient({
    defaultOptions: mergedDefaultOptions,
    ...config,
  });
}

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Type guard to check if an error is an ApiError.
 * Re-exported from client for convenience.
 */
export const isApiError = ApiError.isApiError;

/**
 * Get a user-friendly error message from any error.
 * Handles ApiError, Error, and unknown types.
 *
 * @example
 * ```typescript
 * const { error } = useQuery(someQueryOptions);
 * if (error) {
 *   toast.error(getErrorMessage(error));
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
  if (ApiError.isApiError(error)) {
    return error.userMessage;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

/**
 * Check if an error requires re-authentication.
 * Use this to trigger login flows on auth errors.
 *
 * @example
 * ```typescript
 * const { error } = useQuery(someQueryOptions);
 * if (error && requiresReauth(error)) {
 *   redirectToLogin();
 * }
 * ```
 */
export function requiresReauth(error: unknown): boolean {
  return ApiError.isApiError(error) && error.requiresAuth;
}

/**
 * Check if an error is retryable.
 * Use this to conditionally show retry buttons.
 *
 * @example
 * ```typescript
 * {error && isRetryableError(error) && (
 *   <Button onClick={() => refetch()}>Retry</Button>
 * )}
 * ```
 */
export function isRetryableError(error: unknown): boolean {
  return ApiError.isApiError(error) && error.isRetryable;
}
