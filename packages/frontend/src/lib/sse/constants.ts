/**
 * SSE Constants
 * 
 * Configuration constants for Server-Sent Events handling.
 */

export const INITIAL_RECONNECT_DELAY = 1000; // 1 second
export const MAX_RECONNECT_DELAY = 30000; // 30 seconds
export const RECONNECT_BACKOFF_MULTIPLIER = 2;
export const MAX_RECONNECT_ATTEMPTS = 10; // Requirement 8.6
export const CIRCUIT_BREAKER_THRESHOLD = 3; // Requirement 12.3
export const CIRCUIT_BREAKER_RESET_TIME = 60000; // 60 seconds (Requirement 12.3)

export const SSE_CONSTANTS = {
  INITIAL_RECONNECT_DELAY,
  MAX_RECONNECT_DELAY,
  RECONNECT_BACKOFF_MULTIPLIER,
  MAX_RECONNECT_ATTEMPTS,
  CIRCUIT_BREAKER_THRESHOLD,
  CIRCUIT_BREAKER_RESET_TIME,
} as const;

/**
 * Calculate exponential backoff delay for reconnection attempts.
 * Formula: min(2^(N-1) * 1000ms, 30000ms) where N is the attempt number
 * Requirement 8.1
 * 
 * @param attemptNumber - The current reconnection attempt (1-indexed)
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(attemptNumber: number): number {
  // Ensure attemptNumber is at least 1
  const n = Math.max(1, attemptNumber);
  // Calculate: 2^(n-1) * 1000, capped at MAX_RECONNECT_DELAY
  const delay = Math.pow(RECONNECT_BACKOFF_MULTIPLIER, n - 1) * INITIAL_RECONNECT_DELAY;
  return Math.min(delay, MAX_RECONNECT_DELAY);
}
