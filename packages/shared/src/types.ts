// Core data model types for the Debate Platform

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
  currentRound: 1 | 2 | 3;
  currentTurn: 'support' | 'oppose';
  supportDebaterId: string;
  opposeDebaterId: string | null;
  createdAt: Date;
  concludedAt: Date | null;
}

export interface Round {
  id: string;
  debateId: string;
  roundNumber: 1 | 2 | 3;
  roundType: 'opening' | 'rebuttal' | 'closing';
  supportArgumentId: string | null;
  opposeArgumentId: string | null;
  completedAt: Date | null;
}

export interface Argument {
  id: string;
  roundId: string;
  debaterId: string;
  side: 'support' | 'oppose';
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
  confidence: number;
  lastArgumentSeen: string | null;
  createdAt: Date;
}

export interface StanceValue {
  supportValue: number;
  confidence: number;
}

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
  confidence: number;
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

// Character limits for arguments by round type
export const ARGUMENT_CHAR_LIMITS = {
  opening: 2000,
  rebuttal: 1500,
  closing: 1000,
} as const;

// Resolution validation constants
export const RESOLUTION_MAX_LENGTH = 500;

// Sandbox configuration
export const SANDBOX_DEBATES_REQUIRED = 5;
export const SANDBOX_VOTE_WEIGHT = 0.5;
export const FULL_VOTE_WEIGHT = 1.0;

// Rate limiting
export const COMMENT_RATE_LIMIT = 3;
export const COMMENT_RATE_WINDOW_MINUTES = 10;
