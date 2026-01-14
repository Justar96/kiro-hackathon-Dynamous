// Core data model types for the Debate Platform

// ============================================
// Round Configuration (Single Source of Truth)
// ============================================

export const ROUNDS = [
  { number: 1 as const, type: 'opening' as const, charLimit: 2000 },
  { number: 2 as const, type: 'rebuttal' as const, charLimit: 1500 },
  { number: 3 as const, type: 'closing' as const, charLimit: 1000 },
] as const;

export type RoundNumber = 1 | 2 | 3;
export type RoundType = 'opening' | 'rebuttal' | 'closing';
export type Side = 'support' | 'oppose';

export const getRoundConfig = (n: RoundNumber) => ROUNDS[n - 1];
export const getRoundByType = (type: RoundType) => ROUNDS.find(r => r.type === type)!;

// ============================================
// Debate Phase (Derived State Helper)
// ============================================

export type DebatePhase =
  | { type: 'waiting_opponent' }
  | { type: 'awaiting_argument'; round: RoundNumber; side: Side }
  | { type: 'concluded' };

export function getDebatePhase(debate: Debate): DebatePhase {
  if (!debate.opposeDebaterId) return { type: 'waiting_opponent' };
  if (debate.status === 'concluded') return { type: 'concluded' };
  return { type: 'awaiting_argument', round: debate.currentRound, side: debate.currentTurn };
}

export function getDebatePhaseLabel(phase: DebatePhase): string {
  switch (phase.type) {
    case 'waiting_opponent': return 'Waiting for opponent';
    case 'concluded': return 'Debate concluded';
    case 'awaiting_argument': 
      return `Round ${phase.round} · ${phase.side === 'support' ? 'Support' : 'Oppose'}'s turn`;
  }
}

// ============================================
// User Types
// ============================================

export interface User {
  id: string;
  authUserId?: string | null; // Link to Neon Auth user
  username: string;
  email: string;
  reputationScore: number;
  predictionAccuracy: number;
  debatesParticipated: number;
  sandboxCompleted: boolean;
  createdAt: Date;
}

// Neon Auth user (from neon_auth.user table)
export interface NeonAuthUser {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: boolean | null;
  image: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: Date | null;
}

export interface Debate {
  id: string;
  resolution: string;
  status: 'active' | 'concluded';
  currentRound: RoundNumber;
  currentTurn: Side;
  supportDebaterId: string;
  opposeDebaterId: string | null;
  createdAt: Date;
  concludedAt: Date | null;
}

export interface Round {
  id: string;
  debateId: string;
  roundNumber: RoundNumber;
  roundType: RoundType;
  supportArgumentId: string | null;
  opposeArgumentId: string | null;
  completedAt: Date | null;
}

export interface Argument {
  id: string;
  roundId: string;
  debaterId: string;
  side: Side;
  content: string;
  impactScore: number;
  createdAt: Date;
}

export interface Stance {
  id: string;
  debateId: string;
  voterId: string;
  type: 'pre' | 'post';
  supportValue: number;
  confidence: number; // Kept for backward compat, default to 3
  lastArgumentSeen: string | null;
  createdAt: Date;
}

export interface StanceValue {
  supportValue: number;
  confidence?: number; // Optional now, defaults to 3
}

// Simplified 5-point stance scale for Polymarket-style UX
export type StanceLevel = 'strong_support' | 'lean_support' | 'neutral' | 'lean_oppose' | 'strong_oppose';

export const STANCE_LEVELS: { level: StanceLevel; value: number; label: string; short: string }[] = [
  { level: 'strong_support', value: 100, label: 'Strongly Support', short: 'Strong Yes' },
  { level: 'lean_support', value: 75, label: 'Lean Support', short: 'Lean Yes' },
  { level: 'neutral', value: 50, label: 'Neutral', short: 'Neutral' },
  { level: 'lean_oppose', value: 25, label: 'Lean Oppose', short: 'Lean No' },
  { level: 'strong_oppose', value: 0, label: 'Strongly Oppose', short: 'Strong No' },
];

export const stanceLevelToValue = (level: StanceLevel): number => 
  STANCE_LEVELS.find(s => s.level === level)?.value ?? 50;

export const valueToStanceLevel = (value: number): StanceLevel => {
  if (value >= 88) return 'strong_support';
  if (value >= 63) return 'lean_support';
  if (value >= 38) return 'neutral';
  if (value >= 13) return 'lean_oppose';
  return 'strong_oppose';
};

export interface Reaction {
  id: string;
  argumentId: string;
  voterId: string;
  type: 'agree' | 'strong_reasoning';
  createdAt: Date;
}

export interface MarketDataPoint {
  timestamp: Date;
  supportPrice: number;
  voteCount: number;
}

export interface MarketPrice {
  supportPrice: number;
  opposePrice: number;
  totalVotes: number;
  mindChangeCount: number;
}

export interface StanceSpike {
  timestamp: Date;
  argumentId: string;
  deltaAmount: number;
  direction: 'support' | 'oppose';
  label: string;
}

export interface Comment {
  id: string;
  debateId: string;
  userId: string;
  parentId: string | null;
  content: string;
  createdAt: Date;
  deletedAt?: Date | null;
}

// ============================================
// Comment Reaction Types
// ============================================

export type CommentReactionType = 'support' | 'oppose';

export interface CommentReaction {
  id: string;
  commentId: string;
  userId: string;
  type: CommentReactionType;
  createdAt: Date;
}

export interface CommentReactionCounts {
  support: number;
  oppose: number;
}

export interface CreateCommentReactionInput {
  commentId: string;
  userId: string;
  type: CommentReactionType;
}

// ============================================
// Comment Threading Types
// ============================================

export interface CommentWithReplies extends Comment {
  replyCount: number;
  replies?: CommentWithReplies[];
  isParentDeleted?: boolean;
}

// ============================================
// Notification Types
// ============================================

export type NotificationType = 'opponent_joined' | 'debate_started' | 'your_turn';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  debateId?: string | null;
  read: boolean;
  createdAt: Date;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  message: string;
  debateId?: string;
}

// Steelman Gate: Anti-strawman forcefield
export type SteelmanStatus = 'pending' | 'approved' | 'rejected';

export interface Steelman {
  id: string;
  debateId: string;
  roundNumber: RoundNumber;
  authorId: string;
  targetArgumentId: string;
  content: string;
  status: SteelmanStatus;
  rejectionReason: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}

export interface CreateSteelmanInput {
  debateId: string;
  roundNumber: RoundNumber;
  authorId: string;
  targetArgumentId: string;
  content: string;
}

export interface ReviewSteelmanInput {
  steelmanId: string;
  reviewerId: string;
  approved: boolean;
  rejectionReason?: string;
}

export interface DebateResult {
  debateId: string;
  finalSupportPrice: number;
  finalOpposePrice: number;
  totalMindChanges: number;
  netPersuasionDelta: number;
  winnerSide: 'support' | 'oppose' | 'tie';
}

export interface ReactionCounts {
  agree: number;
  strongReasoning: number;
}

// Persuasion delta calculated from pre/post stance changes
export interface PersuasionDelta {
  userId: string;
  debateId: string;
  preStance: StanceValue;
  postStance: StanceValue;
  delta: number; // postStance.supportValue - preStance.supportValue
  lastArgumentSeen: string | null;
}

// Input types for creating entities
export interface CreateUserInput {
  username: string;
  email: string;
  password: string;
}

export interface CreateDebateInput {
  resolution: string;
  creatorId: string;
  creatorSide: 'support' | 'oppose';
}

export interface CreateArgumentInput {
  debateId: string;
  debaterId: string;
  content: string;
}

export interface CreateStanceInput {
  debateId: string;
  voterId: string;
  type: 'pre' | 'post';
  supportValue: number;
  confidence?: number; // Optional, defaults to 3
  lastArgumentSeen?: string | null;
}

export interface CreateReactionInput {
  argumentId: string;
  voterId: string;
  type: 'agree' | 'strong_reasoning';
}

export interface CreateCommentInput {
  debateId: string;
  userId: string;
  content: string;
  parentId?: string | null;
}

// Character limits for arguments by round type (derived from ROUNDS config)
export const ARGUMENT_CHAR_LIMITS = {
  opening: ROUNDS[0].charLimit,
  rebuttal: ROUNDS[1].charLimit,
  closing: ROUNDS[2].charLimit,
} as const;

export const getCharLimit = (roundType: RoundType): number => getRoundByType(roundType).charLimit;

// ============================================
// Submission Validation Helper
// ============================================

export type SubmissionCheck = 
  | { allowed: true; side: Side }
  | { allowed: false; reason: string };

export function canSubmitArgument(debate: Debate, userId: string): SubmissionCheck {
  if (debate.status === 'concluded') {
    return { allowed: false, reason: 'Debate has concluded' };
  }
  
  const side: Side | null = 
    userId === debate.supportDebaterId ? 'support' :
    userId === debate.opposeDebaterId ? 'oppose' : null;
  
  if (!side) {
    return { allowed: false, reason: 'Only assigned debaters can submit' };
  }
  
  if (debate.currentTurn !== side) {
    return { allowed: false, reason: `It is ${debate.currentTurn}'s turn` };
  }
  
  return { allowed: true, side };
}

// Resolution validation constants
export const RESOLUTION_MAX_LENGTH = 500;

// Sandbox configuration
export const SANDBOX_DEBATES_REQUIRED = 5;
export const SANDBOX_VOTE_WEIGHT = 0.5;
export const FULL_VOTE_WEIGHT = 1.0;

// Rate limiting
export const COMMENT_RATE_LIMIT = 3;
export const COMMENT_RATE_WINDOW_MINUTES = 10;

// ============================================
// Matching Queue Types
// ============================================

export interface QueuedDebate {
  debate: Debate;
  creatorUsername: string;
  creatorReputation: number;
  queuedAt: Date;
}

export interface MatchResult {
  debate: Debate;
  creatorUsername: string;
  creatorReputation: number;
  reputationDiff: number;
}

export interface QueueFilter {
  keywords?: string[];
  maxReputationDiff?: number;
  userId?: string; // For filtering by user's reputation
}
