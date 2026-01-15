/**
 * SSE (Server-Sent Events) Layer Index
 */

// Provider
export { SSEProvider } from './provider';

// Context
export { SSEContext, useSSEContext } from './context';

// Core hooks
export { useSSE } from './useSSE';
export {
  useSSEQuerySync,
  type UseSSEQuerySyncOptions,
  type UseSSEQuerySyncResult,
} from './useSSEQuerySync';

// Constants
export { SSE_CONSTANTS, calculateBackoffDelay } from './constants';

// Types
export type {
  SSEConnectionStatus,
  SSEContextValue,
  SSEProviderProps,
  SSEEvent,
} from './types';
