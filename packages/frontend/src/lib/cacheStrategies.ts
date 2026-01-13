/**
 * Centralized Cache Strategies for TanStack Query
 * 
 * This module provides consistent cache timing configurations across the application.
 * Each strategy is designed for specific use cases to optimize both performance and data freshness.
 * 
 * TanStack Query v5 Best Practices:
 * - staleTime: How long data is considered fresh (won't refetch)
 * - gcTime: How long inactive data stays in cache before garbage collection
 */

/**
 * Cache strategy definitions with clear rationale
 */
export const CACHE_STRATEGIES = {
  /**
   * Real-time data that needs frequent updates
   * Use for: Market prices, live scores, active debate status
   */
  realtime: {
    staleTime: 15 * 1000,        // 15 seconds - data goes stale quickly
    gcTime: 60 * 1000,           // 1 minute - short retention for dynamic data
  },

  /**
   * Frequently changing data that should stay relatively fresh
   * Use for: Comments, reactions, stance counts
   */
  frequent: {
    staleTime: 30 * 1000,        // 30 seconds
    gcTime: 5 * 60 * 1000,       // 5 minutes
  },

  /**
   * Standard caching for most list and detail views
   * Use for: Debate lists, debate details, round content
   */
  standard: {
    staleTime: 2 * 60 * 1000,    // 2 minutes
    gcTime: 10 * 60 * 1000,      // 10 minutes
  },

  /**
   * Static or rarely changing data
   * Use for: User profiles, leaderboards, completed debates
   */
  static: {
    staleTime: 5 * 60 * 1000,    // 5 minutes
    gcTime: 30 * 60 * 1000,      // 30 minutes
  },

  /**
   * Very stable data that rarely changes
   * Use for: Platform stats, configuration, health checks
   */
  stable: {
    staleTime: 10 * 60 * 1000,   // 10 minutes
    gcTime: 60 * 60 * 1000,      // 1 hour
  },
} as const;

/**
 * Type for cache strategy names
 */
export type CacheStrategyName = keyof typeof CACHE_STRATEGIES;

/**
 * Type for cache strategy options
 */
export type CacheStrategyOptions = typeof CACHE_STRATEGIES[CacheStrategyName];

/**
 * Helper to get cache strategy by name
 */
export function getCacheStrategy(name: CacheStrategyName): CacheStrategyOptions {
  return CACHE_STRATEGIES[name];
}

/**
 * Mutation key factories for consistent mutation tracking
 * 
 * Following the same pattern as query keys, but for mutations.
 * This enables using useMutationState to track mutations across components.
 */
export const mutationKeys = {
  // Debate mutations
  debates: {
    create: () => ['mutations', 'debates', 'create'] as const,
    join: (debateId: string) => ['mutations', 'debates', 'join', debateId] as const,
  },

  // Argument mutations
  arguments: {
    submit: (debateId: string) => ['mutations', 'arguments', 'submit', debateId] as const,
    react: (argumentId: string) => ['mutations', 'arguments', 'react', argumentId] as const,
    mindChanged: (argumentId: string) => ['mutations', 'arguments', 'mindChanged', argumentId] as const,
  },

  // Stance mutations
  stances: {
    record: (debateId: string) => ['mutations', 'stances', 'record', debateId] as const,
    quick: (debateId: string) => ['mutations', 'stances', 'quick', debateId] as const,
  },

  // Reaction mutations
  reactions: {
    add: (argumentId: string) => ['mutations', 'reactions', 'add', argumentId] as const,
    remove: (argumentId: string) => ['mutations', 'reactions', 'remove', argumentId] as const,
  },

  // Comment mutations
  comments: {
    add: (debateId: string) => ['mutations', 'comments', 'add', debateId] as const,
  },

  // Impact attribution mutations
  impact: {
    attribute: (debateId: string) => ['mutations', 'impact', 'attribute', debateId] as const,
  },
} as const;

/**
 * Default mutation options that should be applied to all mutations
 */
export const DEFAULT_MUTATION_OPTIONS = {
  retry: 0, // Don't retry mutations by default
} as const;
