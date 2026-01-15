/**
 * Optimistic Update Types
 * 
 * Shared types for optimistic update hooks.
 */

import type { 
  Stance, 
  ReactionCounts,
  PersuasionDelta,
} from '@thesis/shared';

export interface StanceResponse {
  stances: {
    pre: Stance | null;
    post: Stance | null;
  };
  delta: PersuasionDelta | null;
}

export interface ReactionsResponse {
  counts: ReactionCounts;
  userReactions: {
    agree: boolean;
    strongReasoning: boolean;
  } | null;
}

export interface OptimisticContext<T> {
  previousData: T;
  timestamp: number;
}
