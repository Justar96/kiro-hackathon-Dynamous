/**
 * Data Hooks Index
 * 
 * Domain-organized hooks for data fetching and mutations.
 * Split from the original monolithic hooks.ts for better maintainability.
 */

// Auth token hook
export { useAuthToken } from './useAuthToken';

// Debate hooks
export {
  useDebates,
  useDebateFull,
  useCreateDebate,
  useJoinDebate,
  useSubmitArgument,
  useInfiniteDebates,
  type UseInfiniteDebatesResult,
} from './useDebates';

// Market hooks
export { useMarket } from './useMarket';

// Stance hooks
export {
  useUserStance,
  useRecordPreStance,
  useRecordPostStance,
  useQuickStance,
} from './useStances';

// Comment hooks
export {
  useComments,
  useInfiniteComments,
  useAddComment,
} from './useComments';

// Reaction hooks
export {
  useReactions,
  useBatchReactions,
  useAddReaction,
  useRemoveReaction,
} from './useReactions';

// Impact attribution hooks
export {
  useAttributeImpact,
  useMindChanged,
} from './useImpact';

// User hooks
export {
  useCurrentUser,
  useUserProfile,
  useUserStats,
  useReputationBreakdown,
} from './useUsers';

// Health check hooks
export { useHealthCheck } from './useHealth';

// Steelman gate hooks
export {
  useSteelmanStatus,
  usePendingSteelmans,
  useSubmitSteelman,
  useReviewSteelman,
  useDeleteSteelman,
} from './useSteelman';

// Media hooks
export {
  useMediaUpload,
  useUrlPreview,
} from './useMedia';
