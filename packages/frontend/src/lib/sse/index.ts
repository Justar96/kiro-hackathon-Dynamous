/**
 * SSE (Server-Sent Events) Layer Index
 * 
 * Centralized exports for the SSE layer including:
 * - SSE Provider component
 * - Core SSE hooks
 * - Domain-specific event hooks
 * - Utilities and types
 */

// Provider
export { SSEProvider } from './provider';

// Context
export { SSEContext, useSSEContext } from './context';

// Core hooks
export { useSSE } from './useSSE';
export {
  useSSEQuerySync,
  createShallowMergeUpdater,
  createDeepMergeUpdater,
  hasDataChanged,
  type UseSSEQuerySyncOptions,
  type UseSSEQuerySyncResult,
} from './useSSEQuerySync';

// Domain-specific event hooks
export {
  useSSEMarket,
  useSSEComments,
  useSSEArguments,
  useSSEReactions,
  useSSERound,
  useSSESteelman,
} from './events';

// Constants and utilities
export {
  SSE_CONSTANTS,
  calculateBackoffDelay,
  INITIAL_RECONNECT_DELAY,
  MAX_RECONNECT_DELAY,
  MAX_RECONNECT_ATTEMPTS,
  CIRCUIT_BREAKER_THRESHOLD,
  CIRCUIT_BREAKER_RESET_TIME,
} from './constants';

// Types
export type {
  SSEConnectionStatus,
  SSEContextValue,
  SSEProviderProps,
  SSEEvent,
} from './types';
