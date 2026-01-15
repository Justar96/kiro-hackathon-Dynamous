/**
 * Mutation Helpers
 * 
 * Shared helpers for consistent mutation error handling.
 */

import { getErrorMessage, isRetryableError, requiresReauth } from '../api';

const DEFAULT_MUTATION_ERROR = 'Something went wrong. Please try again.';
const GENERIC_ERROR_MESSAGE = 'An unexpected error occurred';

/**
 * Get a user-friendly mutation error message with action-specific fallback.
 */
export function getMutationErrorMessage(
  error: unknown,
  fallback: string = DEFAULT_MUTATION_ERROR
): string {
  const message = getErrorMessage(error);
  if (!message || message === GENERIC_ERROR_MESSAGE) {
    return fallback;
  }
  return message;
}

/**
 * Normalize a mutation error into a consistent shape for UI handling.
 */
export function normalizeMutationError(
  error: unknown,
  fallback?: string
): {
  message: string;
  requiresAuth: boolean;
  isRetryable: boolean;
} {
  return {
    message: getMutationErrorMessage(error, fallback),
    requiresAuth: requiresReauth(error),
    isRetryable: isRetryableError(error),
  };
}
