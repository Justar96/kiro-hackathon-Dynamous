import type { 
  Debate, 
  Argument, 
  Stance, 
  Comment,
  Reaction,
  PersuasionDelta,
} from '@debate-platform/shared';

// API base URL - uses proxy in development
const API_BASE = '';

/**
 * Fetch wrapper for mutations with error handling
 */
async function mutateApi<T>(
  endpoint: string, 
  method: 'POST' | 'PUT' | 'DELETE',
  body?: unknown,
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `API Error: ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Debate Mutations
// ============================================================================

interface CreateDebateInput {
  resolution: string;
  creatorSide?: 'support' | 'oppose';
}

interface CreateDebateResponse {
  debate: Debate;
}

/**
 * Create a new debate
 */
export async function createDebate(
  input: CreateDebateInput,
  token: string
): Promise<Debate> {
  const response = await mutateApi<CreateDebateResponse>(
    '/api/debates',
    'POST',
    input,
    token
  );
  return response.debate;
}

interface JoinDebateResponse {
  debate: Debate;
}

/**
 * Join a debate as the oppose debater
 */
export async function joinDebate(
  debateId: string,
  token: string
): Promise<Debate> {
  const response = await mutateApi<JoinDebateResponse>(
    `/api/debates/${debateId}/join`,
    'POST',
    {},
    token
  );
  return response.debate;
}

// ============================================================================
// Argument Mutations
// ============================================================================

interface SubmitArgumentInput {
  content: string;
}

interface SubmitArgumentResponse {
  argument: Argument;
}

/**
 * Submit an argument in a debate
 */
export async function submitArgument(
  debateId: string,
  input: SubmitArgumentInput,
  token: string
): Promise<Argument> {
  const response = await mutateApi<SubmitArgumentResponse>(
    `/api/debates/${debateId}/arguments`,
    'POST',
    input,
    token
  );
  return response.argument;
}

// ============================================================================
// Stance Mutations
// ============================================================================

interface RecordStanceInput {
  supportValue: number;
  confidence?: number;
  lastArgumentSeen?: string | null;
}

interface RecordPreStanceResponse {
  stance: Stance;
}

/**
 * Record pre-read stance for a debate
 */
export async function recordPreStance(
  debateId: string,
  input: RecordStanceInput,
  token: string
): Promise<Stance> {
  const response = await mutateApi<RecordPreStanceResponse>(
    `/api/debates/${debateId}/stance/pre`,
    'POST',
    input,
    token
  );
  return response.stance;
}

interface RecordPostStanceResponse {
  stance: Stance;
  delta: PersuasionDelta;
}

/**
 * Record post-read stance for a debate
 */
export async function recordPostStance(
  debateId: string,
  input: RecordStanceInput,
  token: string
): Promise<RecordPostStanceResponse> {
  return await mutateApi<RecordPostStanceResponse>(
    `/api/debates/${debateId}/stance/post`,
    'POST',
    input,
    token
  );
}

interface QuickStanceInput {
  side: 'support' | 'oppose';
}

interface QuickStanceResponse {
  stance: Stance;
  delta?: PersuasionDelta;
  type: 'pre' | 'post';
}

/**
 * Quick stance from index page - simplified support/oppose
 */
export async function recordQuickStance(
  debateId: string,
  input: QuickStanceInput,
  token: string
): Promise<QuickStanceResponse> {
  return await mutateApi<QuickStanceResponse>(
    `/api/debates/${debateId}/stance/quick`,
    'POST',
    input,
    token
  );
}

// ============================================================================
// Reaction Mutations
// ============================================================================

interface AddReactionInput {
  type: 'agree' | 'strong_reasoning';
}

interface AddReactionResponse {
  reaction: Reaction;
}

/**
 * Add a reaction to an argument
 */
export async function addReaction(
  argumentId: string,
  input: AddReactionInput,
  token: string
): Promise<Reaction> {
  const response = await mutateApi<AddReactionResponse>(
    `/api/arguments/${argumentId}/react`,
    'POST',
    input,
    token
  );
  return response.reaction;
}

// ============================================================================
// Impact Attribution Mutations
// ============================================================================

interface AttributeImpactInput {
  argumentId: string;
}

interface AttributeImpactResponse {
  success: boolean;
  argumentId: string;
}

/**
 * Attribute mind-change impact to a specific argument.
 * This updates the lastArgumentSeen field on the user's post-stance.
 * Requirements: 13.1
 */
export async function attributeImpact(
  debateId: string,
  input: AttributeImpactInput,
  token: string
): Promise<AttributeImpactResponse> {
  return await mutateApi<AttributeImpactResponse>(
    `/api/debates/${debateId}/attribute-impact`,
    'POST',
    input,
    token
  );
}

interface MindChangedResponse {
  success: boolean;
  argumentId: string;
  newImpactScore: number;
  message: string;
}

/**
 * Mark that a specific argument changed your mind.
 * Per original vision: "This changed my mind" button for explicit impact attribution.
 */
export async function markMindChanged(
  argumentId: string,
  token: string
): Promise<MindChangedResponse> {
  return await mutateApi<MindChangedResponse>(
    `/api/arguments/${argumentId}/mind-changed`,
    'POST',
    {},
    token
  );
}

interface RemoveReactionResponse {
  success: boolean;
}

/**
 * Remove a reaction from an argument
 */
export async function removeReaction(
  argumentId: string,
  type: 'agree' | 'strong_reasoning',
  token: string
): Promise<boolean> {
  const response = await mutateApi<RemoveReactionResponse>(
    `/api/arguments/${argumentId}/react`,
    'DELETE',
    { type },
    token
  );
  return response.success;
}

// ============================================================================
// Comment Mutations
// ============================================================================

interface AddCommentInput {
  content: string;
  parentId?: string | null;
}

interface AddCommentResponse {
  comment: Comment;
}

/**
 * Add a comment to a debate
 */
export async function addComment(
  debateId: string,
  input: AddCommentInput,
  token: string
): Promise<Comment> {
  const response = await mutateApi<AddCommentResponse>(
    `/api/debates/${debateId}/comments`,
    'POST',
    input,
    token
  );
  return response.comment;
}


// ============================================================================
// Steelman Gate Mutations
// ============================================================================

interface SubmitSteelmanInput {
  roundNumber: 1 | 2 | 3;
  targetArgumentId: string;
  content: string;
}

interface SteelmanResponse {
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

/**
 * Submit a steelman of opponent's argument.
 * Required before submitting rebuttal (round 2) or closing (round 3).
 */
export async function submitSteelman(
  debateId: string,
  input: SubmitSteelmanInput,
  token: string
): Promise<SteelmanResponse['steelman']> {
  const response = await mutateApi<SteelmanResponse>(
    `/api/debates/${debateId}/steelman`,
    'POST',
    input,
    token
  );
  return response.steelman;
}

interface ReviewSteelmanInput {
  approved: boolean;
  rejectionReason?: string;
}

/**
 * Approve or reject a steelman as the opponent.
 */
export async function reviewSteelman(
  steelmanId: string,
  input: ReviewSteelmanInput,
  token: string
): Promise<SteelmanResponse['steelman']> {
  const response = await mutateApi<SteelmanResponse>(
    `/api/steelmans/${steelmanId}/review`,
    'POST',
    input,
    token
  );
  return response.steelman;
}

/**
 * Delete a rejected steelman to resubmit.
 */
export async function deleteSteelman(
  steelmanId: string,
  token: string
): Promise<boolean> {
  const response = await mutateApi<{ success: boolean }>(
    `/api/steelmans/${steelmanId}`,
    'DELETE',
    {},
    token
  );
  return response.success;
}
