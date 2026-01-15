/**
 * Query Options Index
 * 
 * Barrel exports for all query options organized by domain.
 */

// Debate queries
export {
  debatesQueryOptions,
  debatesWithMarketQueryOptions,
  debateQueryOptions,
  debateDetailQueryOptions,
  debateFullQueryOptions,
  infiniteDebatesQueryOptions,
  type UseInfiniteDebatesOptions,
} from './debates';

// Market queries
export { marketQueryOptions } from './market';

// Stance queries
export { userStanceQueryOptions, stanceStatsQueryOptions } from './stances';

// Comment queries
export { commentsQueryOptions, commentsInfiniteQueryOptions } from './comments';

// Reaction queries
export { reactionsQueryOptions } from './reactions';

// User queries
export {
  currentUserQueryOptions,
  userQueryOptions,
  userStatsQueryOptions,
  userDebatesQueryOptions,
} from './users';

// Steelman queries
export { steelmanStatusQueryOptions, pendingSteelmansQueryOptions } from './steelman';

// Leaderboard queries
export { leaderboardQueryOptions, topUsersQueryOptions } from './leaderboard';

// Health queries
export { healthCheckQueryOptions } from './health';
