/**
 * API Response Types
 * 
 * Centralized type definitions for API responses.
 * Keeps types close to the API layer for better maintainability.
 */

import type {
  Debate,
  User,
  Round,
  Argument,
  Stance,
  Comment,
  MarketPrice,
  MarketDataPoint,
  StanceSpike,
  ReactionCounts,
  PersuasionDelta,
} from '@thesis/shared';

// ============================================================================
// Debate Response Types
// ============================================================================

export interface DebatesResponse {
  debates: Debate[];
  includesMarket?: boolean;
}

export interface DebatesWithMarketResponse {
  debates: Array<{ debate: Debate; marketPrice: MarketPrice | null }>;
  includesMarket: true;
}

export interface DebateDetailResponse {
  debate: Debate;
  rounds: (Round & {
    supportArgument: Argument | null;
    opposeArgument: Argument | null;
  })[];
  debaters?: {
    support: User | null;
    oppose: User | null;
  };
  market?: {
    marketPrice: MarketPrice;
    history: MarketDataPoint[];
    spikes: StanceSpike[];
  } | null;
  marketBlocked?: boolean;
}

// ============================================================================
// Market Response Types
// ============================================================================

export interface MarketResponse {
  marketPrice: MarketPrice;
  history: MarketDataPoint[];
  spikes: StanceSpike[];
}

// ============================================================================
// Stance Response Types
// ============================================================================

export interface StanceResponse {
  stances: {
    pre: Stance | null;
    post: Stance | null;
  };
  delta: PersuasionDelta | null;
}

export interface QuickStanceResponse {
  stance: Stance;
  delta?: PersuasionDelta;
  type: 'pre' | 'post';
}

// ============================================================================
// Comment Response Types
// ============================================================================

export interface CommentsResponse {
  comments: Comment[];
}

export interface PaginatedCommentsResponse {
  comments: Comment[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}

// ============================================================================
// Reaction Response Types
// ============================================================================

export interface ReactionsResponse {
  counts: ReactionCounts;
  userReactions: {
    agree: boolean;
    strongReasoning: boolean;
  } | null;
}

// ============================================================================
// User Response Types
// ============================================================================

export interface CurrentUserResponse {
  user: User;
  stats: {
    totalDebates: number;
    debatesAsSupport: number;
    debatesAsOppose: number;
    totalVotes: number;
    averageDelta: number;
  };
}

export interface UserResponse {
  user: User;
}

export interface UserStatsResponse {
  stats: {
    totalDebates: number;
    debatesAsSupport: number;
    debatesAsOppose: number;
    totalVotes: number;
    averageDelta: number;
  };
}

export interface UserDebatesResponse {
  debates: Debate[];
}

// ============================================================================
// Leaderboard Response Types
// ============================================================================

export interface TopArgument {
  id: string;
  content: string;
  side: 'support' | 'oppose';
  impactScore: number;
  debateId: string;
  resolution: string;
  authorUsername: string;
}

export interface TopUser {
  id: string;
  username: string;
  reputationScore: number;
  predictionAccuracy: number;
  debatesParticipated: number;
  sandboxCompleted: boolean;
  totalImpact?: number;
}

// ============================================================================
// Stance Stats Response Types
// ============================================================================

export interface StanceStats {
  totalVoters: number;
  avgPreStance: number;
  avgPostStance: number;
  avgDelta: number;
  mindChangedCount: number;
}

// ============================================================================
// Voting History Response Types (Requirement 3.4)
// ============================================================================

export interface VotingHistoryEntry {
  debateId: string;
  resolution: string;
  debateStatus: 'active' | 'concluded';
  preStance: number | null;
  postStance: number | null;
  delta: number | null;
  votedAt: string;
}

export interface VotingHistoryResponse {
  votingHistory: VotingHistoryEntry[];
}

// ============================================================================
// Steelman Response Types
// ============================================================================

export interface SteelmanStatus {
  canSubmit: boolean;
  reason?: string;
  requiresSteelman: boolean;
  steelmanStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  steelman?: {
    id: string;
    content: string;
    status: 'pending' | 'approved' | 'rejected';
    rejectionReason: string | null;
  } | null;
}

export interface PendingSteelman {
  id: string;
  debateId: string;
  roundNumber: 1 | 2 | 3;
  authorId: string;
  targetArgumentId: string;
  content: string;
  status: 'pending';
  createdAt: string;
}

export interface SteelmanResponse {
  steelman: {
    id: string;
    debateId: string;
    roundNumber: 1 | 2 | 3;
    authorId: string;
    targetArgumentId: string;
    content: string;
    status: 'pending' | 'approved' | 'rejected';
    rejectionReason: string | null;
    createdAt: string;
    reviewedAt: string | null;
  };
}

// ============================================================================
// Mutation Input Types
// ============================================================================

export interface CreateDebateInput {
  resolution: string;
  creatorSide?: 'support' | 'oppose';
}

export interface SubmitArgumentInput {
  content: string;
}

export interface RecordStanceInput {
  supportValue: number;
  confidence?: number;
  lastArgumentSeen?: string | null;
}

export interface QuickStanceInput {
  side: 'support' | 'oppose';
}

export interface AddReactionInput {
  type: 'agree' | 'strong_reasoning';
}

export interface AddCommentInput {
  content: string;
  parentId?: string | null;
}

export interface AttributeImpactInput {
  argumentId: string;
}

export interface SubmitSteelmanInput {
  roundNumber: 1 | 2 | 3;
  targetArgumentId: string;
  content: string;
}

export interface ReviewSteelmanInput {
  approved: boolean;
  rejectionReason?: string;
}

// ============================================================================
// Mutation Response Types
// ============================================================================

export interface CreateDebateResponse {
  debate: Debate;
}

export interface JoinDebateResponse {
  debate: Debate;
}

export interface SubmitArgumentResponse {
  argument: Argument;
}

export interface RecordPreStanceResponse {
  stance: Stance;
}

export interface RecordPostStanceResponse {
  stance: Stance;
  delta: PersuasionDelta;
}

export interface AddReactionResponse {
  reaction: {
    id: string;
    argumentId: string;
    userId: string;
    type: string;
    createdAt: Date;
  };
}

export interface RemoveReactionResponse {
  success: boolean;
}

export interface AddCommentResponse {
  comment: Comment;
}

export interface AttributeImpactResponse {
  success: boolean;
  argumentId: string;
}

export interface MindChangedResponse {
  success: boolean;
  argumentId: string;
  newImpactScore: number;
  message: string;
}

// Re-export shared types for convenience
export type {
  Debate,
  User,
  Round,
  Argument,
  Stance,
  Comment,
  MarketPrice,
  MarketDataPoint,
  StanceSpike,
  ReactionCounts,
  PersuasionDelta,
};
