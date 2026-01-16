// Core data model types for Thesis

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

export interface PriceHistoryPoint {
  timestamp: number;
  yesPrice: number;
  noPrice: number;
  volume: number;
}

export type PriceHistoryTimeframe = '1H' | '1D' | '1W' | '1M' | 'ALL';

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

// Minimum character limit for arguments (Requirement 7.5)
export const ARGUMENT_MIN_CHAR_LIMIT = 100;

// ============================================
// Argument Validation Feedback Types (Requirement 7.5)
// ============================================

export interface ArgumentValidationError {
  code: 'TOO_SHORT' | 'TOO_LONG' | 'EMPTY';
  message: string;
  details: {
    currentLength: number;
    requiredLength: number;
    roundType: RoundType;
    suggestions: string[];
  };
}

/**
 * Validates argument content and returns detailed feedback if invalid.
 * Per Requirement 7.5: Provides specific character count requirements and improvement suggestions.
 * 
 * @param content - The argument content to validate
 * @param roundType - The type of round (opening, rebuttal, closing)
 * @returns null if valid, ArgumentValidationError if invalid
 */
export function validateArgumentContent(
  content: string,
  roundType: RoundType
): ArgumentValidationError | null {
  const trimmedContent = content.trim();
  const currentLength = trimmedContent.length;
  const maxLength = getCharLimit(roundType);
  const minLength = ARGUMENT_MIN_CHAR_LIMIT;

  if (currentLength === 0) {
    return {
      code: 'EMPTY',
      message: 'Argument cannot be empty',
      details: {
        currentLength: 0,
        requiredLength: minLength,
        roundType,
        suggestions: [
          'Start by stating your main claim clearly',
          'Provide at least one piece of evidence or reasoning',
          'Explain why your position matters',
        ],
      },
    };
  }

  if (currentLength < minLength) {
    return {
      code: 'TOO_SHORT',
      message: `Argument is too short. You wrote ${currentLength} characters, but the minimum is ${minLength} characters.`,
      details: {
        currentLength,
        requiredLength: minLength,
        roundType,
        suggestions: getImprovementSuggestions(roundType, currentLength),
      },
    };
  }

  if (currentLength > maxLength) {
    return {
      code: 'TOO_LONG',
      message: `Argument exceeds ${maxLength} character limit for ${roundType}. You wrote ${currentLength} characters.`,
      details: {
        currentLength,
        requiredLength: maxLength,
        roundType,
        suggestions: [
          'Focus on your strongest points',
          'Remove redundant phrases',
          'Be more concise in your explanations',
        ],
      },
    };
  }

  return null;
}

/**
 * Get improvement suggestions based on round type and current content length.
 * Per Requirement 7.5: Provides specific improvement suggestions for short arguments.
 */
function getImprovementSuggestions(roundType: RoundType, currentLength: number): string[] {
  const basesuggestions: string[] = [];
  
  // Add length-specific suggestions
  if (currentLength < 30) {
    basesuggestions.push('Expand your main claim with more detail');
    basesuggestions.push('Add supporting evidence or examples');
  } else if (currentLength < 60) {
    basesuggestions.push('Strengthen your argument with additional reasoning');
    basesuggestions.push('Consider addressing potential counterarguments');
  } else {
    basesuggestions.push('Add one more supporting point to reach the minimum');
    basesuggestions.push('Elaborate on your existing points');
  }

  // Add round-specific suggestions
  switch (roundType) {
    case 'opening':
      basesuggestions.push('Clearly state your position and main supporting reasons');
      basesuggestions.push('Set up the framework for your argument');
      break;
    case 'rebuttal':
      basesuggestions.push('Address specific points from your opponent\'s argument');
      basesuggestions.push('Explain why their reasoning is flawed or incomplete');
      break;
    case 'closing':
      basesuggestions.push('Summarize your strongest points');
      basesuggestions.push('Explain why your position should prevail');
      break;
  }

  return basesuggestions;
}

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

// ============================================
// Pagination Types (Reddit-Style Feed)
// ============================================

export interface DebateWithMarket {
  debate: Debate;
  marketPrice?: MarketPrice | null;
}

export interface PaginatedDebatesResponse {
  debates: DebateWithMarket[];
  nextCursor?: string;
  hasMore: boolean;
  totalCount: number;
  includesMarket?: boolean;
}

export interface PaginatedDebatesParams {
  cursor?: string;
  limit?: number;
  filter?: 'all' | 'my-debates';
  userId?: string;
  includeMarket?: boolean;
}

// ============================================
// Media Attachment Types (Requirement 2.1, 2.6)
// ============================================

export type MediaAttachmentType = 'file' | 'youtube' | 'link';

export interface MediaAttachment {
  id: string;
  argumentId: string;
  type: MediaAttachmentType;
  url: string;
  thumbnailUrl: string | null;
  title: string | null;
  description: string | null;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: Date;
}

export interface UrlPreview {
  url: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  siteName: string | null;
  type: 'article' | 'video' | 'image' | 'other';
}

export interface YouTubePreview {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  channelName: string | null;
  duration: string | null;
}

// Accepted file types for media uploads
export const ACCEPTED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export type AcceptedFileType = typeof ACCEPTED_FILE_TYPES[number];

// Maximum file size: 10MB in bytes
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface CreateMediaAttachmentInput {
  argumentId: string;
  type: MediaAttachmentType;
  url: string;
  thumbnailUrl?: string | null;
  title?: string | null;
  description?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
}


// ============================================
// Reputation Types (Requirement 4.1, 4.5)
// ============================================

export interface ReputationScore {
  overall: number;           // 0-1000 scale
  persuasionSkill: number;   // Based on impact scores
  predictionAccuracy: number; // Based on correct predictions
  consistency: number;        // Based on participation quality
  trustLevel: number;         // Derived from all factors
}

export interface ReputationFactor {
  id: string;
  userId: string;
  impactScoreTotal: number;
  predictionAccuracy: number;
  participationCount: number;
  qualityScore: number;
  lastActiveAt: Date | null;
  updatedAt: Date;
}

export interface ReputationBreakdownFactor {
  name: string;
  value: number;
  weight: number;
  contribution: number;
}

export interface ReputationChange {
  date: Date;
  change: number;
  reason: string;
}

export interface ReputationBreakdown {
  overall: number;
  factors: ReputationBreakdownFactor[];
  recentChanges: ReputationChange[];
  rank?: number;
  percentile?: number;
}

export interface ReputationHistory {
  id: string;
  userId: string;
  previousScore: number;
  newScore: number;
  changeAmount: number;
  reason: string;
  debateId: string | null;
  createdAt: Date;
}

// Reputation calculation weights
export const REPUTATION_WEIGHTS = {
  impactScore: 0.35,        // How much arguments change minds
  predictionAccuracy: 0.25, // How well user predicts outcomes
  participationQuality: 0.20, // Engagement without gaming
  consistency: 0.10,        // Regular quality contributions
  communityTrust: 0.10,     // Reactions and endorsements
} as const;

// Diminishing returns formula helper
export const calculateDiminishingReturns = (rawScore: number, count: number): number => {
  // Each additional contribution has less impact
  // Score = rawScore * (1 / (1 + log(count)))
  return rawScore * (1 / (1 + Math.log10(count + 1)));
};

// Reputation decay configuration
export const REPUTATION_DECAY_THRESHOLD_DAYS = 30;
export const REPUTATION_DECAY_RATE_PER_WEEK = 0.01; // 1% per week after threshold

// Low-impact threshold for neutral reputation changes
export const LOW_IMPACT_THRESHOLD = 5;


// ============================================
// Privacy Types (Requirement 3.1, 3.2)
// ============================================

/**
 * Aggregate stance data for public API responses.
 * This interface ensures no individual voter data is exposed.
 * Individual voter IDs are NEVER included in this type.
 */
export interface AggregateStanceData {
  totalVoters: number;
  averagePreStance: number;
  averagePostStance: number;
  averageDelta: number;
  mindChangedCount: number;
  // Note: Individual voter data is intentionally excluded for privacy
}

/**
 * Privacy-filtered debate statistics for public display.
 * Contains only aggregate metrics, no individual voter information.
 */
export interface PrivateDebateStats {
  debateId: string;
  stanceData: AggregateStanceData;
  lastUpdated: Date;
}


// ============================================
// Trending Types (Requirement 6.4)
// ============================================

/**
 * Engagement metrics for a debate used in trending calculation.
 */
export interface DebateEngagementMetrics {
  debateId: string;
  voteCount: number;
  reactionCount: number;
  commentCount: number;
  createdAt: Date;
}

/**
 * Trending score result for a debate.
 */
export interface TrendingScore {
  debateId: string;
  score: number;
  engagementMetrics: DebateEngagementMetrics;
}

/**
 * Weights for trending score calculation.
 * Higher weights mean more influence on the trending score.
 */
export const TRENDING_WEIGHTS = {
  votes: 1.0,        // Base weight for stance votes
  reactions: 0.5,    // Reactions are worth half a vote
  comments: 0.3,     // Comments are worth 0.3 of a vote
} as const;

/**
 * Recency decay configuration for trending algorithm.
 * Score decays over time to favor recent activity.
 */
export const TRENDING_RECENCY_DECAY = {
  halfLifeHours: 24, // Score halves every 24 hours
} as const;
