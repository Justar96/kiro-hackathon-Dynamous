/**
 * Query Key Factories
 * 
 * Centralized query key definitions following TanStack Query best practices.
 * https://tanstack.com/query/latest/docs/framework/react/guides/query-keys
 * 
 * Benefits:
 * - Type-safe query keys
 * - Consistent key structure
 * - Easy invalidation patterns
 */

export const queryKeys = {
  // Debates
  debates: {
    all: ['debates'] as const,
    lists: () => [...queryKeys.debates.all, 'list'] as const,
    withMarket: () => [...queryKeys.debates.all, 'withMarket'] as const,
    detail: (id: string) => [...queryKeys.debates.all, 'detail', id] as const,
    full: (id: string) => [...queryKeys.debates.all, 'full', id] as const,
  },
  
  // Market
  market: {
    byDebate: (debateId: string) => ['market', debateId] as const,
  },
  
  // Stances
  stances: {
    byDebate: (debateId: string) => ['stances', debateId] as const,
  },
  
  // Comments
  comments: {
    byDebate: (debateId: string) => ['comments', debateId] as const,
  },
  
  // Arguments
  arguments: {
    reactions: (argumentId: string) => ['arguments', argumentId, 'reactions'] as const,
  },
  
  // Users
  users: {
    current: () => ['users', 'current'] as const,
    detail: (id: string) => ['users', id] as const,
    stats: (id: string) => ['users', id, 'stats'] as const,
    debates: (id: string) => ['users', id, 'debates'] as const,
  },
  
  // Leaderboard
  leaderboard: {
    arguments: () => ['leaderboard', 'arguments'] as const,
    users: () => ['leaderboard', 'users'] as const,
  },
  
  // Stance Stats (public)
  stanceStats: {
    byDebate: (debateId: string) => ['stanceStats', debateId] as const,
  },
  
  // Steelman Gate
  steelman: {
    status: (debateId: string, round: number) => ['steelman', debateId, 'status', round] as const,
    pending: (debateId: string) => ['steelman', debateId, 'pending'] as const,
  },
  
  // Health
  health: ['health'] as const,
} as const;

// Type helpers for query keys
export type QueryKeysType = typeof queryKeys;
export type DebateQueryKey = ReturnType<typeof queryKeys.debates.detail>;
export type MarketQueryKey = ReturnType<typeof queryKeys.market.byDebate>;
export type StanceQueryKey = ReturnType<typeof queryKeys.stances.byDebate>;
