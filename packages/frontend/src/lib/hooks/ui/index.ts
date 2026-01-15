/**
 * UI Hooks Index
 * 
 * Hooks for UI state management and visual feedback.
 */

// Scroll-based unlock detection
export { useAfterStanceUnlock } from './useAfterStanceUnlock';

// Reading progress tracking
export { useReadingProgress } from './useReadingProgress';

// Minimum loading duration
export { useMinimumLoading, useMinimumLoadingQuery } from './useMinimumLoading';

// Index page polling
export { useIndexPolling, POLLING_CONSTANTS } from './useIndexPolling';
export type { UseIndexPollingOptions, UseIndexPollingResult } from './useIndexPolling';
