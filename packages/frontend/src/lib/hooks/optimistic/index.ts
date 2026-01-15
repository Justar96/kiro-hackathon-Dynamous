/**
 * Optimistic Hooks Index
 * 
 * Hooks implementing optimistic updates for user actions, providing
 * immediate UI feedback before server confirmation with proper rollback
 * on error and reconciliation on success.
 * 
 * TanStack Query v5 Best Practices:
 * - All mutations have mutationKey for tracking via useMutationState
 * - Proper optimistic cache updates with rollback
 * - Reconciliation with server data via invalidation
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

// Types
export type { StanceResponse, ReactionsResponse, OptimisticContext } from './types';

// Optimistic stance hook
export { useOptimisticStance } from './useOptimisticStance';

// Optimistic reaction hook
export { useOptimisticReaction } from './useOptimisticReaction';

// Optimistic comment hook
export { useOptimisticComment } from './useOptimisticComment';
