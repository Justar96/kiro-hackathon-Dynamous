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
 * - Hierarchical structure for granular cache control
 * 
 * @module api/queryKeys
 */

export const queryKeys = {
  // Debates
  debates: {
    all: ['debates'] as const,
    lists: () => [...queryKeys.debates.all, 'list'] as const,
    withMarket: () => [...queryKeys.debates.all, 'withMarket'] as const,
    detail: (id: string) => [...queryKeys.debates.all, 'detail', id] as const,
    full: (id: string) => [...queryKeys.debates.all, 'full', id] as const,
    infinite: (filter: string, userId: string) => 
      [...queryKeys.debates.all, 'infinite', filter, userId] as const,
  },
  
  // Market
  market: {
    all: ['market'] as const,
    byDebate: (debateId: string) => [...queryKeys.market.all, debateId] as const,
  },
  
  // Stances
  stances: {
    all: ['stances'] as const,
    byDebate: (debateId: string) => [...queryKeys.stances.all, debateId] as const,
  },
  
  // Comments
  comments: {
    all: ['comments'] as const,
    byDebate: (debateId: string) => [...queryKeys.comments.all, debateId] as const,
    infinite: (debateId: string) => [...queryKeys.comments.all, debateId, 'infinite'] as const,
  },
  
  // Arguments
  arguments: {
    all: ['arguments'] as const,
    reactions: (argumentId: string) => [...queryKeys.arguments.all, argumentId, 'reactions'] as const,
  },
  
  // Users
  users: {
    all: ['users'] as const,
    current: () => [...queryKeys.users.all, 'current'] as const,
    detail: (id: string) => [...queryKeys.users.all, id] as const,
    stats: (id: string) => [...queryKeys.users.all, id, 'stats'] as const,
    debates: (id: string) => [...queryKeys.users.all, id, 'debates'] as const,
    votingHistory: (id: string) => [...queryKeys.users.all, id, 'votingHistory'] as const,
    reputation: (id: string) => [...queryKeys.users.all, id, 'reputation'] as const,
  },
  
  // Leaderboard
  leaderboard: {
    all: ['leaderboard'] as const,
    arguments: () => [...queryKeys.leaderboard.all, 'arguments'] as const,
    users: () => [...queryKeys.leaderboard.all, 'users'] as const,
  },
  
  // Stance Stats (public)
  stanceStats: {
    all: ['stanceStats'] as const,
    byDebate: (debateId: string) => [...queryKeys.stanceStats.all, debateId] as const,
  },
  
  // Steelman Gate
  steelman: {
    all: ['steelman'] as const,
    status: (debateId: string, round: number) => 
      [...queryKeys.steelman.all, debateId, 'status', round] as const,
    pending: (debateId: string) => [...queryKeys.steelman.all, debateId, 'pending'] as const,
  },
  
  // Health
  health: ['health'] as const,
} as const;

// ============================================================================
// Type Helpers
// ============================================================================

/**
 * Type for the entire query keys object.
 * Use for type-safe access to query key structure.
 */
export type QueryKeysType = typeof queryKeys;

/**
 * Extract all possible query key types for each domain.
 * These types enable better autocomplete and type checking.
 */

// Debate key types
export type DebateAllKey = typeof queryKeys.debates.all;
export type DebateListKey = ReturnType<typeof queryKeys.debates.lists>;
export type DebateWithMarketKey = ReturnType<typeof queryKeys.debates.withMarket>;
export type DebateDetailKey = ReturnType<typeof queryKeys.debates.detail>;
export type DebateFullKey = ReturnType<typeof queryKeys.debates.full>;
export type DebateInfiniteKey = ReturnType<typeof queryKeys.debates.infinite>;
export type DebateQueryKey = DebateAllKey | DebateListKey | DebateWithMarketKey | DebateDetailKey | DebateFullKey | DebateInfiniteKey;

// Market key types
export type MarketAllKey = typeof queryKeys.market.all;
export type MarketByDebateKey = ReturnType<typeof queryKeys.market.byDebate>;
export type MarketQueryKey = MarketAllKey | MarketByDebateKey;

// Stance key types
export type StanceAllKey = typeof queryKeys.stances.all;
export type StanceByDebateKey = ReturnType<typeof queryKeys.stances.byDebate>;
export type StanceQueryKey = StanceAllKey | StanceByDebateKey;

// Comment key types
export type CommentAllKey = typeof queryKeys.comments.all;
export type CommentByDebateKey = ReturnType<typeof queryKeys.comments.byDebate>;
export type CommentInfiniteKey = ReturnType<typeof queryKeys.comments.infinite>;
export type CommentQueryKey = CommentAllKey | CommentByDebateKey | CommentInfiniteKey;

// User key types
export type UserAllKey = typeof queryKeys.users.all;
export type UserCurrentKey = ReturnType<typeof queryKeys.users.current>;
export type UserDetailKey = ReturnType<typeof queryKeys.users.detail>;
export type UserStatsKey = ReturnType<typeof queryKeys.users.stats>;
export type UserDebatesKey = ReturnType<typeof queryKeys.users.debates>;
export type UserVotingHistoryKey = ReturnType<typeof queryKeys.users.votingHistory>;
export type UserReputationKey = ReturnType<typeof queryKeys.users.reputation>;
export type UserQueryKey = UserAllKey | UserCurrentKey | UserDetailKey | UserStatsKey | UserDebatesKey | UserVotingHistoryKey | UserReputationKey;

// Leaderboard key types
export type LeaderboardAllKey = typeof queryKeys.leaderboard.all;
export type LeaderboardArgumentsKey = ReturnType<typeof queryKeys.leaderboard.arguments>;
export type LeaderboardUsersKey = ReturnType<typeof queryKeys.leaderboard.users>;
export type LeaderboardQueryKey = LeaderboardAllKey | LeaderboardArgumentsKey | LeaderboardUsersKey;

// Steelman key types
export type SteelmanAllKey = typeof queryKeys.steelman.all;
export type SteelmanStatusKey = ReturnType<typeof queryKeys.steelman.status>;
export type SteelmanPendingKey = ReturnType<typeof queryKeys.steelman.pending>;
export type SteelmanQueryKey = SteelmanAllKey | SteelmanStatusKey | SteelmanPendingKey;

/**
 * Union of all possible query keys.
 * Use for type-safe query key validation.
 */
export type AnyQueryKey = 
  | DebateQueryKey 
  | MarketQueryKey 
  | StanceQueryKey 
  | CommentQueryKey
  | UserQueryKey
  | LeaderboardQueryKey
  | SteelmanQueryKey
  | typeof queryKeys.health;
