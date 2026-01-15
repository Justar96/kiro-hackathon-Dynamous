/**
 * Cache Strategies & Mutation Keys
 * 
 * Centralized cache timing configurations and mutation key factories.
 * 
 * TanStack Query v5 Best Practices:
 * - staleTime: How long data is considered fresh (won't refetch)
 * - gcTime: How long inactive data stays in cache before garbage collection
 */

// ============================================================================
// Cache Strategy Definitions
// ============================================================================

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

  /**
   * Data updated via SSE - no window focus refetch needed
   * Use for: Debate detail page data (market prices, arguments, round status)
   *
   * Fix: SSE keeps this data fresh, so we disable refetchOnWindowFocus
   * to avoid redundant fetches when users switch browser tabs
   */
  sseUpdated: {
    staleTime: 5 * 60 * 1000,    // 5 minutes - SSE keeps it fresh
    gcTime: 10 * 60 * 1000,      // 10 minutes
    refetchOnWindowFocus: false, // SSE handles updates, no need to refetch on focus
    refetchOnReconnect: true,    // Do refetch on network reconnect for consistency
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

// ============================================================================
// Mutation Key Factories
// ============================================================================

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
    join: (debateId?: string) =>
      debateId
        ? (['mutations', 'debates', 'join', debateId] as const)
        : (['mutations', 'debates', 'join'] as const),
  },

  // Argument mutations
  arguments: {
    submit: (debateId?: string) =>
      debateId
        ? (['mutations', 'arguments', 'submit', debateId] as const)
        : (['mutations', 'arguments', 'submit'] as const),
    react: (argumentId?: string) =>
      argumentId
        ? (['mutations', 'arguments', 'react', argumentId] as const)
        : (['mutations', 'arguments', 'react'] as const),
    mindChanged: (argumentId?: string) =>
      argumentId
        ? (['mutations', 'arguments', 'mindChanged', argumentId] as const)
        : (['mutations', 'arguments', 'mindChanged'] as const),
  },

  // Stance mutations
  stances: {
    record: (debateId?: string) =>
      debateId
        ? (['mutations', 'stances', 'record', debateId] as const)
        : (['mutations', 'stances', 'record'] as const),
    pre: (debateId?: string) =>
      debateId
        ? (['mutations', 'stances', 'pre', debateId] as const)
        : (['mutations', 'stances', 'pre'] as const),
    post: (debateId?: string) =>
      debateId
        ? (['mutations', 'stances', 'post', debateId] as const)
        : (['mutations', 'stances', 'post'] as const),
    quick: (debateId?: string) =>
      debateId
        ? (['mutations', 'stances', 'quick', debateId] as const)
        : (['mutations', 'stances', 'quick'] as const),
  },

  // Reaction mutations
  reactions: {
    add: (argumentId?: string) =>
      argumentId
        ? (['mutations', 'reactions', 'add', argumentId] as const)
        : (['mutations', 'reactions', 'add'] as const),
    remove: (argumentId?: string) =>
      argumentId
        ? (['mutations', 'reactions', 'remove', argumentId] as const)
        : (['mutations', 'reactions', 'remove'] as const),
  },

  // Comment mutations
  comments: {
    add: (debateId?: string) =>
      debateId
        ? (['mutations', 'comments', 'add', debateId] as const)
        : (['mutations', 'comments', 'add'] as const),
  },

  // Impact attribution mutations
  impact: {
    attribute: (debateId?: string) =>
      debateId
        ? (['mutations', 'impact', 'attribute', debateId] as const)
        : (['mutations', 'impact', 'attribute'] as const),
  },

  // Steelman mutations
  steelman: {
    submit: (debateId?: string) =>
      debateId
        ? (['mutations', 'steelman', 'submit', debateId] as const)
        : (['mutations', 'steelman', 'submit'] as const),
    review: (steelmanId?: string) =>
      steelmanId
        ? (['mutations', 'steelman', 'review', steelmanId] as const)
        : (['mutations', 'steelman', 'review'] as const),
    delete: (steelmanId?: string) =>
      steelmanId
        ? (['mutations', 'steelman', 'delete', steelmanId] as const)
        : (['mutations', 'steelman', 'delete'] as const),
  },

  // Media mutations
  media: {
    upload: (argumentId?: string) =>
      argumentId
        ? (['mutations', 'media', 'upload', argumentId] as const)
        : (['mutations', 'media', 'upload'] as const),
    preview: () => ['mutations', 'media', 'preview'] as const,
  },
} as const;

/**
 * Default mutation options that should be applied to all mutations
 */
export const DEFAULT_MUTATION_OPTIONS = {
  retry: 0, // Don't retry mutations by default
} as const;
