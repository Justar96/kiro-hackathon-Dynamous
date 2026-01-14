import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import { streamSSE } from 'hono/streaming';

import {
  authService,
  debateService,
  votingService,
  marketService,
  reactionService,
  commentService,
  userService,
  steelmanService,
  matchingService,
  notificationService,
} from './services';

import {
  broadcastDebateEvent,
  broadcastMarketUpdate as broadcastMarket,
  broadcastCommentUpdate as broadcastComment,
  broadcastCommentReaction,
  addConnection,
  removeConnection,
  getConnectionCount,
  startConnectionCleanup,
  updateConnectionHeartbeat,
  addUserConnection,
  removeUserConnection,
  updateUserConnectionHeartbeat,
} from './broadcast';

import type { 
  CreateDebateInput, 
  CreateArgumentInput,
  CreateStanceInput,
  CreateReactionInput,
  CreateCommentInput,
  CreateSteelmanInput,
  ReviewSteelmanInput,
} from '@debate-platform/shared';

// Types for context variables
type Variables = {
  userId?: string;
  authUserId?: string;
};

const app = new Hono<{ Variables: Variables }>();

// ============================================================================
// Middleware
// ============================================================================

// Logger middleware
app.use('*', logger());

// CORS middleware - allow frontend origin
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:8080'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Error handling middleware
app.onError((err, c) => {
  console.error('Error:', err);
  
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  
  // Handle known error messages with appropriate status codes
  const message = err.message || 'Internal server error';
  
  // 400 Bad Request errors
  if (
    message.includes('cannot be empty') ||
    message.includes('exceeds') ||
    message.includes('must be between') ||
    message.includes('character limit')
  ) {
    return c.json({ error: message }, 400);
  }
  
  // 401 Unauthorized errors
  if (message.includes('Authentication required') || message.includes('Unauthorized')) {
    return c.json({ error: message }, 401);
  }
  
  // 403 Forbidden errors
  if (
    message.includes('not your turn') ||
    message.includes('Only assigned debaters') ||
    message.includes('pre-read stance first') ||
    message.includes('Record your pre-read stance')
  ) {
    return c.json({ error: message }, 403);
  }
  
  // 404 Not Found errors
  if (message.includes('not found')) {
    return c.json({ error: message }, 404);
  }
  
  // 409 Conflict errors
  if (
    message.includes('already concluded') ||
    message.includes('already complete') ||
    message.includes('already reacted') ||
    message.includes('already recorded') ||
    message.includes('already taken')
  ) {
    return c.json({ error: message }, 409);
  }
  
  // 429 Too Many Requests errors
  if (message.includes('Maximum') && message.includes('comments')) {
    return c.json({ error: message }, 429);
  }
  
  // Default to 500 Internal Server Error
  return c.json({ error: message }, 500);
});

// Auth middleware for protected routes
// Extracts user ID from Authorization header (format: "Bearer <authUserId>")
// In production, this would validate JWT tokens from Stack Auth
const authMiddleware = async (c: any, next: () => Promise<void>) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }
  
  const authUserId = authHeader.substring(7); // Remove "Bearer " prefix
  
  if (!authUserId) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }
  
  try {
    // Get or create platform user from auth user ID
    const user = await authService.getOrCreatePlatformUser(authUserId);
    c.set('userId', user.id);
    c.set('authUserId', authUserId);
  } catch (error) {
    // If auth user doesn't exist, try to get by platform user ID directly
    // This supports testing scenarios where we use platform user IDs
    const user = await authService.getUserById(authUserId);
    if (user) {
      c.set('userId', user.id);
      c.set('authUserId', user.authUserId || authUserId);
    } else {
      throw new HTTPException(401, { message: 'Invalid authentication' });
    }
  }
  
  await next();
};

// Optional auth middleware - doesn't require auth but extracts user if present
const optionalAuthMiddleware = async (c: any, next: () => Promise<void>) => {
  const authHeader = c.req.header('Authorization');
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const authUserId = authHeader.substring(7);
    
    if (authUserId) {
      try {
        const user = await authService.getOrCreatePlatformUser(authUserId);
        c.set('userId', user.id);
        c.set('authUserId', authUserId);
      } catch {
        // Try platform user ID
        const user = await authService.getUserById(authUserId);
        if (user) {
          c.set('userId', user.id);
          c.set('authUserId', user.authUserId || authUserId);
        }
      }
    }
  }
  
  await next();
};

// ============================================================================
// Health Check Routes
// ============================================================================

app.get('/', (c) => c.json({ status: 'ok', message: 'Debate Platform API' }));
app.get('/api/health', (c) => c.json({ status: 'healthy' }));

// ============================================================================
// Debate API Routes (14.2)
// ============================================================================

// GET /api/leaderboard/arguments - Get top persuasive arguments (public)
app.get('/api/leaderboard/arguments', async (c) => {
  const limit = parseInt(c.req.query('limit') || '10', 10);
  const topArguments = await marketService.getTopArguments(Math.min(limit, 50));
  return c.json({ arguments: topArguments });
});

// GET /api/leaderboard/users - Get top users by reputation (public)
// Requirements: Index Page Improvement 3B - Top Users Leaderboard
app.get('/api/leaderboard/users', async (c) => {
  const limit = parseInt(c.req.query('limit') || '10', 10);
  const topUsers = await userService.getTopUsers(Math.min(limit, 50));
  return c.json({ users: topUsers });
});

// POST /api/debates - Create new debate (requires auth)
app.post('/api/debates', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  
  const input: CreateDebateInput = {
    resolution: body.resolution,
    creatorId: userId!,
    creatorSide: body.creatorSide || 'support',
  };
  
  const result = await debateService.createDebate(input);
  
  // Wire matching hook: debate created without opponent (Requirement 4.1)
  await matchingService.onDebateCreated(result.debate);
  
  return c.json(result, 201);
});

// GET /api/debates - List debates with optional market data
app.get('/api/debates', async (c) => {
  const includeMarket = c.req.query('includeMarket') === 'true';
  
  const { db } = await import('./db');
  const { debates } = await import('./db/schema');
  const { desc } = await import('drizzle-orm');
  
  const allDebates = await db.query.debates.findMany({
    orderBy: [desc(debates.createdAt)],
    limit: 50,
  });
  
  // If market data requested, fetch it in parallel for all debates
  if (includeMarket) {
    const debatesWithMarket = await Promise.all(
      allDebates.map(async (debate) => {
        try {
          const marketPrice = await marketService.calculateMarketPrice(debate.id);
          return { debate, marketPrice };
        } catch {
          return { debate, marketPrice: null };
        }
      })
    );
    return c.json({ debates: debatesWithMarket, includesMarket: true });
  }
  
  return c.json({ debates: allDebates });
});

// GET /api/debates/:id - Get debate details with optional expanded data
app.get('/api/debates/:id', optionalAuthMiddleware, async (c) => {
  const debateId = c.req.param('id');
  const includeDebaters = c.req.query('includeDebaters') === 'true';
  const includeMarket = c.req.query('includeMarket') === 'true';
  const userId = c.get('userId');
  
  const debate = await debateService.getDebateById(debateId);
  
  if (!debate) {
    throw new HTTPException(404, { message: 'Debate not found' });
  }
  
  const rounds = await debateService.getRoundsByDebateId(debateId);
  
  // Get arguments for each round
  const roundsWithArguments = await Promise.all(
    rounds.map(async (round) => {
      const supportArg = round.supportArgumentId 
        ? await debateService.getArgumentById(round.supportArgumentId)
        : null;
      const opposeArg = round.opposeArgumentId
        ? await debateService.getArgumentById(round.opposeArgumentId)
        : null;
      
      return {
        ...round,
        supportArgument: supportArg,
        opposeArgument: opposeArg,
      };
    })
  );
  
  // Build response with optional expanded data
  const response: Record<string, unknown> = { debate, rounds: roundsWithArguments };
  
  // Include debater profiles if requested
  if (includeDebaters) {
    const [supportDebater, opposeDebater] = await Promise.all([
      debate.supportDebaterId ? userService.getUserById(debate.supportDebaterId) : null,
      debate.opposeDebaterId ? userService.getUserById(debate.opposeDebaterId) : null,
    ]);
    response.debaters = { support: supportDebater, oppose: opposeDebater };
  }
  
  // Include market data if requested (no longer requires pre-stance)
  if (includeMarket) {
    const [marketPrice, history, spikes] = await Promise.all([
      marketService.calculateMarketPrice(debateId),
      marketService.getMarketHistory(debateId),
      marketService.getSpikes(debateId),
    ]);
    response.market = { marketPrice, history, spikes };
  }
  
  return c.json(response);
});

// POST /api/debates/:id/arguments - Submit argument (requires auth)
app.post('/api/debates/:id/arguments', authMiddleware, async (c) => {
  const debateId = c.req.param('id');
  const userId = c.get('userId');
  const body = await c.req.json();
  
  const input: CreateArgumentInput = {
    debateId,
    debaterId: userId!,
    content: body.content,
  };
  
  const argument = await debateService.submitArgument(input);
  
  // Get the debate to determine round number for broadcast
  const debate = await debateService.getDebateById(debateId);
  
  // Broadcast argument event to all connected clients (Requirement 3.1, 3.2)
  if (debate) {
    broadcastDebateEvent(debateId, 'argument', {
      argumentId: argument.id,
      roundNumber: debate.currentRound,
      side: argument.side,
      content: argument.content,
      debaterId: argument.debaterId,
      createdAt: argument.createdAt,
    });
  }
  
  return c.json({ argument }, 201);
});

// POST /api/debates/:id/join - Join debate as oppose debater (requires auth)
app.post('/api/debates/:id/join', authMiddleware, async (c) => {
  const debateId = c.req.param('id');
  const userId = c.get('userId');
  
  // Get the debate before joining to get the creator ID
  const debateBefore = await debateService.getDebateById(debateId);
  if (!debateBefore) {
    throw new HTTPException(404, { message: 'Debate not found' });
  }
  
  const debate = await debateService.joinDebateAsOppose(debateId, userId!);
  
  // Wire matching hook: opponent joined (Requirement 4.2)
  await matchingService.onOpponentJoined(debateId);
  
  // Get the joining user's username for broadcast and notification
  const joiningUser = await userService.getUserById(userId!);
  
  // Broadcast debate-join event (Requirement 11.1, 11.2)
  if (joiningUser) {
    broadcastDebateEvent(debateId, 'debate-join', {
      debateId,
      opposeDebaterId: userId!,
      opposeDebaterUsername: joiningUser.username,
    });
    
    // Create notification for debate creator (Requirement 6.1)
    await notificationService.createNotification({
      userId: debateBefore.supportDebaterId,
      type: 'opponent_joined',
      message: `${joiningUser.username} has joined your debate as the opposing side`,
      debateId,
    });
  }
  
  return c.json({ debate });
});

// ============================================================================
// Voting API Routes (14.3)
// ============================================================================

// POST /api/debates/:id/stance/quick - Quick stance from index (requires auth)
// Simplified: just support/oppose, records as pre-stance if none exists
app.post('/api/debates/:id/stance/quick', authMiddleware, async (c) => {
  const debateId = c.req.param('id');
  const userId = c.get('userId');
  const body = await c.req.json();
  
  // Convert side to supportValue (support=75, oppose=25)
  const supportValue = body.side === 'support' ? 75 : 25;
  
  // Check if user already has a pre-stance
  const existingStances = await votingService.getUserStances(debateId, userId!);
  
  if (existingStances.pre) {
    // Update as post-stance
    const input: CreateStanceInput = {
      debateId,
      voterId: userId!,
      type: 'post',
      supportValue,
      confidence: 3,
    };
    const result = await votingService.recordPostStance(input);
    
    // Update market
    const marketPrice = await marketService.calculateMarketPrice(debateId);
    await marketService.recordMarketDataPoint(debateId, marketPrice.supportPrice, marketPrice.totalVotes);
    
    // Broadcast market update to all connected clients (Requirement 2.2)
    broadcastMarket(debateId, marketPrice);
    
    return c.json({ stance: result.stance, delta: result.delta, type: 'post' }, 201);
  } else {
    // Record as pre-stance
    const input: CreateStanceInput = {
      debateId,
      voterId: userId!,
      type: 'pre',
      supportValue,
      confidence: 3,
    };
    const stance = await votingService.recordPreStance(input);
    return c.json({ stance, type: 'pre' }, 201);
  }
});

// POST /api/debates/:id/stance/pre - Record pre-read stance (requires auth)
app.post('/api/debates/:id/stance/pre', authMiddleware, async (c) => {
  const debateId = c.req.param('id');
  const userId = c.get('userId');
  const body = await c.req.json();
  
  const input: CreateStanceInput = {
    debateId,
    voterId: userId!,
    type: 'pre',
    supportValue: body.supportValue,
    confidence: body.confidence,
    lastArgumentSeen: body.lastArgumentSeen || null,
  };
  
  const stance = await votingService.recordPreStance(input);
  
  return c.json({ stance }, 201);
});

// POST /api/debates/:id/stance/post - Record post-read stance (requires auth)
app.post('/api/debates/:id/stance/post', authMiddleware, async (c) => {
  const debateId = c.req.param('id');
  const userId = c.get('userId');
  const body = await c.req.json();
  
  const input: CreateStanceInput = {
    debateId,
    voterId: userId!,
    type: 'post',
    supportValue: body.supportValue,
    confidence: body.confidence,
    lastArgumentSeen: body.lastArgumentSeen || null,
  };
  
  const result = await votingService.recordPostStance(input);
  
  // Update impact scores after recording post-stance
  await marketService.updateAllImpactScores(debateId);
  
  // Record market data point
  const marketPrice = await marketService.calculateMarketPrice(debateId);
  await marketService.recordMarketDataPoint(debateId, marketPrice.supportPrice, marketPrice.totalVotes);
  
  // Broadcast market update to all connected clients (Requirement 2.1)
  broadcastMarket(debateId, marketPrice);
  
  // Detect spikes if there's a significant delta
  if (result.delta.lastArgumentSeen && Math.abs(result.delta.delta) >= 15) {
    await marketService.detectAndRecordSpike(
      debateId,
      result.delta.lastArgumentSeen,
      result.delta.delta
    );
  }
  
  return c.json({ stance: result.stance, delta: result.delta }, 201);
});

// POST /api/arguments/:id/mind-changed - Attribute mind change to specific argument
// Per original vision: "This changed my mind" button for explicit impact attribution
app.post('/api/arguments/:id/mind-changed', authMiddleware, async (c) => {
  const argumentId = c.req.param('id');
  const userId = c.get('userId');
  
  // Get the argument to find its debate
  const argument = await debateService.getArgumentById(argumentId);
  if (!argument) {
    throw new HTTPException(404, { message: 'Argument not found' });
  }
  
  // Get the round to find debate ID
  const { db } = await import('./db');
  const { rounds } = await import('./db/schema');
  const { eq } = await import('drizzle-orm');
  
  const round = await db.query.rounds.findFirst({
    where: eq(rounds.id, argument.roundId),
  });
  
  if (!round) {
    throw new HTTPException(404, { message: 'Round not found' });
  }
  
  const debateId = round.debateId;
  
  // Check if user has a post-stance (they must have voted)
  const userStances = await votingService.getUserStances(debateId, userId!);
  if (!userStances.post) {
    throw new HTTPException(400, { message: 'Record your post-read stance first' });
  }
  
  // Update the post-stance to attribute to this argument
  const { stances } = await import('./db/schema');
  await db.update(stances)
    .set({ lastArgumentSeen: argumentId })
    .where(eq(stances.id, userStances.post.id));
  
  // Recalculate impact score for this argument
  const newImpactScore = await marketService.updateArgumentImpactScore(argumentId);
  
  // Detect spike if significant
  const delta = userStances.post.supportValue - (userStances.pre?.supportValue ?? 50);
  if (Math.abs(delta) >= 10) {
    await marketService.detectAndRecordSpike(debateId, argumentId, delta, 10);
  }
  
  return c.json({ 
    success: true, 
    argumentId,
    newImpactScore,
    message: 'Mind change attributed to argument'
  });
});

// GET /api/debates/:id/market - Get current market price
// Enforces blind voting: must record pre-stance before seeing market
app.get('/api/debates/:id/market', optionalAuthMiddleware, async (c) => {
  const debateId = c.req.param('id');
  const userId = c.get('userId');
  
  // Check if debate exists
  const debate = await debateService.getDebateById(debateId);
  if (!debate) {
    throw new HTTPException(404, { message: 'Debate not found' });
  }
  
  // Enforce blind voting for authenticated users (must record pre-stance first)
  // Debaters are exempt from blind voting requirement
  if (userId) {
    const isDebater = debate.supportDebaterId === userId || debate.opposeDebaterId === userId;
    if (!isDebater) {
      const access = await votingService.canAccessMarketPrice(debateId, userId);
      if (!access.canAccess) {
        return c.json({ 
          blindVoting: true, 
          message: access.reason,
          requiresPreStance: true 
        }, 403);
      }
    }
  }
  
  const marketPrice = await marketService.calculateMarketPrice(debateId);
  const history = await marketService.getMarketHistory(debateId);
  const spikes = await marketService.getSpikes(debateId);
  
  return c.json({ marketPrice, history, spikes });
});

// GET /api/debates/:id/stance - Get user's stances for a debate (requires auth)
app.get('/api/debates/:id/stance', authMiddleware, async (c) => {
  const debateId = c.req.param('id');
  const userId = c.get('userId');
  
  const stances = await votingService.getUserStances(debateId, userId!);
  const delta = await votingService.getPersuasionDelta(debateId, userId!);
  
  return c.json({ stances, delta });
});

// GET /api/debates/:id/stance-stats - Get aggregate stance stats (public, for spectators)
app.get('/api/debates/:id/stance-stats', async (c) => {
  const debateId = c.req.param('id');
  const stats = await votingService.getDebateStanceStats(debateId);
  return c.json(stats);
});

// ============================================================================
// Steelman Gate API Routes
// ============================================================================

// POST /api/debates/:id/steelman - Submit a steelman of opponent's argument
app.post('/api/debates/:id/steelman', authMiddleware, async (c) => {
  const debateId = c.req.param('id');
  const userId = c.get('userId');
  const body = await c.req.json();
  
  const input: CreateSteelmanInput = {
    debateId,
    roundNumber: body.roundNumber,
    authorId: userId!,
    targetArgumentId: body.targetArgumentId,
    content: body.content,
  };
  
  const steelman = await steelmanService.submitSteelman(input);
  
  // Broadcast steelman submission event (Requirement 10.1, 10.3)
  broadcastDebateEvent(debateId, 'steelman', {
    steelmanId: steelman.id,
    debateId,
    roundNumber: steelman.roundNumber as 2 | 3,
    status: 'pending',
    authorId: steelman.authorId,
  });
  
  return c.json({ steelman }, 201);
});

// POST /api/steelmans/:id/review - Approve or reject a steelman
app.post('/api/steelmans/:id/review', authMiddleware, async (c) => {
  const steelmanId = c.req.param('id');
  const userId = c.get('userId');
  const body = await c.req.json();
  
  const input: ReviewSteelmanInput = {
    steelmanId,
    reviewerId: userId!,
    approved: body.approved,
    rejectionReason: body.rejectionReason,
  };
  
  const steelman = await steelmanService.reviewSteelman(input);
  
  // Broadcast steelman review event (Requirement 10.2, 10.3)
  broadcastDebateEvent(steelman.debateId, 'steelman', {
    steelmanId: steelman.id,
    debateId: steelman.debateId,
    roundNumber: steelman.roundNumber as 2 | 3,
    status: steelman.status,
    rejectionReason: steelman.rejectionReason ?? undefined,
    authorId: steelman.authorId,
  });
  
  return c.json({ steelman });
});

// GET /api/debates/:id/steelman/status - Check if user can submit argument (steelman gate)
app.get('/api/debates/:id/steelman/status', authMiddleware, async (c) => {
  const debateId = c.req.param('id');
  const userId = c.get('userId');
  
  // Parse and validate round number
  const raw = c.req.query('round');
  const rawNum = raw ? parseInt(raw, 10) : NaN;
  
  if (Number.isNaN(rawNum) || ![1, 2, 3].includes(rawNum)) {
    return c.json({ error: 'Invalid round' }, 400);
  }
  
  const roundNumber = rawNum as 1 | 2 | 3;
  
  const status = await steelmanService.canSubmitArgument(debateId, userId!, roundNumber);
  const steelman = await steelmanService.getSteelman(debateId, userId!, roundNumber);
  
  return c.json({ ...status, steelman });
});

// GET /api/debates/:id/steelman/pending - Get steelmans pending review
app.get('/api/debates/:id/steelman/pending', authMiddleware, async (c) => {
  const debateId = c.req.param('id');
  const userId = c.get('userId');
  
  const pending = await steelmanService.getPendingReviews(debateId, userId!);
  return c.json({ pending });
});

// DELETE /api/steelmans/:id - Delete rejected steelman to resubmit
app.delete('/api/steelmans/:id', authMiddleware, async (c) => {
  const steelmanId = c.req.param('id');
  const userId = c.get('userId');
  
  await steelmanService.deleteSteelman(steelmanId, userId!);
  return c.json({ success: true });
});

// ============================================================================
// Reaction and Comment API Routes (14.4)
// ============================================================================

// POST /api/arguments/:id/react - Add reaction to argument (requires auth)
app.post('/api/arguments/:id/react', authMiddleware, async (c) => {
  const argumentId = c.req.param('id');
  const userId = c.get('userId');
  const body = await c.req.json();
  
  const input: CreateReactionInput = {
    argumentId,
    voterId: userId!,
    type: body.type,
  };
  
  const reaction = await reactionService.addReaction(input);
  
  // Get debateId from argument's round for broadcast (Requirement 4.1, 4.2)
  const argument = await debateService.getArgumentById(argumentId);
  if (argument) {
    const { db } = await import('./db');
    const { rounds } = await import('./db/schema');
    const { eq } = await import('drizzle-orm');
    
    const round = await db.query.rounds.findFirst({
      where: eq(rounds.id, argument.roundId),
    });
    
    if (round) {
      const counts = await reactionService.getReactionCounts(argumentId);
      broadcastDebateEvent(round.debateId, 'reaction', {
        argumentId,
        reactionType: body.type,
        counts,
      });
    }
  }
  
  return c.json({ reaction }, 201);
});

// DELETE /api/arguments/:id/react - Remove reaction from argument (requires auth)
app.delete('/api/arguments/:id/react', authMiddleware, async (c) => {
  const argumentId = c.req.param('id');
  const userId = c.get('userId');
  const body = await c.req.json();
  
  const removed = await reactionService.removeReaction(argumentId, userId!, body.type);
  
  if (!removed) {
    throw new HTTPException(404, { message: 'Reaction not found' });
  }
  
  // Get debateId from argument's round for broadcast (Requirement 4.1, 4.2)
  const argument = await debateService.getArgumentById(argumentId);
  if (argument) {
    const { db } = await import('./db');
    const { rounds } = await import('./db/schema');
    const { eq } = await import('drizzle-orm');
    
    const round = await db.query.rounds.findFirst({
      where: eq(rounds.id, argument.roundId),
    });
    
    if (round) {
      const counts = await reactionService.getReactionCounts(argumentId);
      broadcastDebateEvent(round.debateId, 'reaction', {
        argumentId,
        reactionType: body.type,
        counts,
      });
    }
  }
  
  return c.json({ success: true });
});

// GET /api/arguments/:id/reactions - Get reactions for an argument
app.get('/api/arguments/:id/reactions', optionalAuthMiddleware, async (c) => {
  const argumentId = c.req.param('id');
  const userId = c.get('userId');
  
  const counts = await reactionService.getReactionCounts(argumentId);
  
  let userReactions = null;
  if (userId) {
    userReactions = await reactionService.getUserReactions(argumentId, userId);
  }
  
  return c.json({ counts, userReactions });
});

// POST /api/debates/:id/comments - Add spectator comment (requires auth)
app.post('/api/debates/:id/comments', authMiddleware, async (c) => {
  const debateId = c.req.param('id');
  const userId = c.get('userId');
  const body = await c.req.json();
  
  const input: CreateCommentInput = {
    debateId,
    userId: userId!,
    content: body.content,
    parentId: body.parentId || null,
  };
  
  const comment = await commentService.addComment(input);
  
  // Broadcast comment to all connected clients using unified broadcast module
  // Requirements: 6.1
  broadcastComment(debateId, comment, body.parentId || null);
  
  return c.json({ comment }, 201);
});

// GET /api/debates/:id/comments - Get comments for a debate
app.get('/api/debates/:id/comments', async (c) => {
  const debateId = c.req.param('id');
  
  const comments = await commentService.getDebateComments(debateId);
  
  return c.json({ comments });
});

// GET /api/debates/:id/comments/tree - Get threaded comments for a debate
// Requirements: 1.1, 1.2, 1.3 - Return comments with parent-child relationships, reply counts, hierarchical structure
app.get('/api/debates/:id/comments/tree', async (c) => {
  const debateId = c.req.param('id');
  const includeDeleted = c.req.query('includeDeleted') === 'true';
  const maxDepthParam = c.req.query('maxDepth');
  const maxDepth = maxDepthParam ? parseInt(maxDepthParam, 10) : undefined;
  
  // Check if debate exists
  const debate = await debateService.getDebateById(debateId);
  if (!debate) {
    throw new HTTPException(404, { message: 'Debate not found' });
  }
  
  const tree = await commentService.getCommentTree(debateId, {
    includeDeleted,
    maxDepth: maxDepth && !isNaN(maxDepth) ? maxDepth : undefined,
  });
  
  return c.json({ comments: tree });
});

// ============================================================================
// Comment Reaction API Routes
// Requirements: 2.1, 2.2, 2.3, 2.4, 3.2
// ============================================================================

// POST /api/comments/:id/react - Add reaction to comment (requires auth)
// Requirements: 2.1, 2.2 - Store reaction, reject duplicates
app.post('/api/comments/:id/react', authMiddleware, async (c) => {
  const commentId = c.req.param('id');
  const userId = c.get('userId');
  const body = await c.req.json();
  
  const reaction = await reactionService.addCommentReaction({
    commentId,
    userId: userId!,
    type: body.type,
  });
  
  // Get the comment to find its debate for broadcast (Requirement 3.2)
  const comment = await commentService.getComment(commentId);
  if (comment) {
    const counts = await reactionService.getCommentReactionCounts(commentId);
    broadcastCommentReaction(comment.debateId, commentId, body.type, counts);
  }
  
  return c.json({ reaction }, 201);
});

// DELETE /api/comments/:id/react - Remove reaction from comment (requires auth)
// Requirement 2.4 - Delete reaction and update counts
app.delete('/api/comments/:id/react', authMiddleware, async (c) => {
  const commentId = c.req.param('id');
  const userId = c.get('userId');
  const body = await c.req.json();
  
  const removed = await reactionService.removeCommentReaction(commentId, userId!, body.type);
  
  if (!removed) {
    throw new HTTPException(404, { message: 'Reaction not found' });
  }
  
  // Get the comment to find its debate for broadcast (Requirement 3.2)
  const comment = await commentService.getComment(commentId);
  if (comment) {
    const counts = await reactionService.getCommentReactionCounts(commentId);
    broadcastCommentReaction(comment.debateId, commentId, body.type, counts);
  }
  
  return c.json({ success: true });
});

// GET /api/comments/:id/reactions - Get reactions for a comment
// Requirement 2.3 - Return counts for each reaction type and user reactions
app.get('/api/comments/:id/reactions', optionalAuthMiddleware, async (c) => {
  const commentId = c.req.param('id');
  const userId = c.get('userId');
  
  const counts = await reactionService.getCommentReactionCounts(commentId);
  
  let userReactions = null;
  if (userId) {
    userReactions = await reactionService.getUserCommentReactions(commentId, userId);
  }
  
  return c.json({ counts, userReactions });
});

// ============================================================================
// Matching API Routes
// Requirements: 4.1, 4.3, 5.1
// ============================================================================

// GET /api/matching/queue - List opponent queue
// Requirements: 4.1, 4.3 - Return active debates without opponents, ordered by creation time
app.get('/api/matching/queue', optionalAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const keywords = c.req.query('keywords');
  const maxReputationDiff = c.req.query('maxReputationDiff');
  
  const filter: { keywords?: string[]; maxReputationDiff?: number; userId?: string } = {};
  
  if (keywords) {
    filter.keywords = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
  }
  
  if (maxReputationDiff && userId) {
    const diff = parseInt(maxReputationDiff, 10);
    if (!isNaN(diff)) {
      filter.maxReputationDiff = diff;
      filter.userId = userId;
    }
  }
  
  const queue = await matchingService.getOpponentQueue(Object.keys(filter).length > 0 ? filter : undefined);
  
  return c.json({ queue });
});

// GET /api/matching/find - Find matches for current user
// Requirement 5.1 - Find debates where user can take opposing side
app.get('/api/matching/find', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 10;
  
  const matches = await matchingService.findMatches(userId!, Math.min(limit, 50));
  
  return c.json({ matches });
});

// ============================================================================
// Notification API Routes
// Requirements: 6.3, 6.4
// ============================================================================

// GET /api/notifications - Get user notifications
// Requirement 6.3 - Return unread notifications first, then by creation time
app.get('/api/notifications', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const unreadOnly = c.req.query('unreadOnly') === 'true';
  
  const notifications = await notificationService.getUserNotifications(userId!, unreadOnly);
  
  return c.json({ notifications });
});

// GET /api/notifications/count - Get unread notification count
// Requirement 6.3 - Support getting unread count
app.get('/api/notifications/count', authMiddleware, async (c) => {
  const userId = c.get('userId');
  
  const count = await notificationService.getUnreadCount(userId!);
  
  return c.json({ count });
});

// POST /api/notifications/:id/read - Mark notification as read
// Requirement 6.4 - Update read status
app.post('/api/notifications/:id/read', authMiddleware, async (c) => {
  const notificationId = c.req.param('id');
  
  const success = await notificationService.markAsRead(notificationId);
  
  if (!success) {
    throw new HTTPException(404, { message: 'Notification not found or already read' });
  }
  
  return c.json({ success: true });
});

// POST /api/notifications/read-all - Mark all notifications as read
// Requirement 6.4 - Update read status for all
app.post('/api/notifications/read-all', authMiddleware, async (c) => {
  const userId = c.get('userId');
  
  const count = await notificationService.markAllAsRead(userId!);
  
  return c.json({ success: true, count });
});

// ============================================================================
// User SSE Stream for Notifications
// Requirements: 7.1, 7.2
// ============================================================================

// GET /api/users/stream - SSE stream for user notifications
// Requirements: 7.1, 7.2 - User-specific notification channel
app.get('/api/users/stream', authMiddleware, async (c) => {
  const userId = c.get('userId');
  
  return streamSSE(c, async (stream) => {
    // Create send function for this connection
    const sendData = (data: string) => {
      stream.writeSSE({ data });
    };
    
    // Add this connection to the user's notification channel
    addUserConnection(userId!, sendData);
    
    // Send initial connection confirmation
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({ userId, timestamp: new Date().toISOString() }),
    });
    
    // Send unread notification count on connect
    const unreadCount = await notificationService.getUnreadCount(userId!);
    await stream.writeSSE({
      event: 'unread-count',
      data: JSON.stringify({ count: unreadCount }),
    });
    
    // Keep connection alive with periodic heartbeats
    const heartbeatInterval = setInterval(async () => {
      try {
        await stream.writeSSE({ event: 'heartbeat', data: 'ping' });
        updateUserConnectionHeartbeat(sendData);
      } catch {
        // Connection closed
        clearInterval(heartbeatInterval);
        removeUserConnection(userId!, sendData);
      }
    }, 30000);
    
    // Clean up on close
    stream.onAbort(() => {
      clearInterval(heartbeatInterval);
      removeUserConnection(userId!, sendData);
    });
    
    // Keep the stream open
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  });
});

// ============================================================================
// SSE Stream for Realtime Updates (14.5)
// ============================================================================

// GET /api/debates/:id/stream - SSE stream for market updates
app.get('/api/debates/:id/stream', async (c) => {
  const debateId = c.req.param('id');
  
  // Check if debate exists
  const debate = await debateService.getDebateById(debateId);
  if (!debate) {
    throw new HTTPException(404, { message: 'Debate not found' });
  }
  
  return streamSSE(c, async (stream) => {
    // Create send function for this connection
    const sendData = (data: string) => {
      stream.writeSSE({ data });
    };
    
    // Add this connection to the debate's connection set using broadcast module
    addConnection(debateId, sendData);
    
    // Send initial market data
    const marketPrice = await marketService.calculateMarketPrice(debateId);
    await stream.writeSSE({
      event: 'market',
      data: JSON.stringify(marketPrice),
    });
    
    // Keep connection alive with periodic heartbeats
    const heartbeatInterval = setInterval(async () => {
      try {
        await stream.writeSSE({ event: 'heartbeat', data: 'ping' });
      } catch {
        // Connection closed
        clearInterval(heartbeatInterval);
        removeConnection(debateId, sendData);
      }
    }, 30000);
    
    // Clean up on close
    stream.onAbort(() => {
      clearInterval(heartbeatInterval);
      removeConnection(debateId, sendData);
    });
    
    // Keep the stream open
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  });
});

// ============================================================================
// User API Routes (14.6)
// ============================================================================

// GET /api/users/check-username - Check if username is available
// Requirements: 2.3 - Validate username uniqueness
app.get('/api/users/check-username', async (c) => {
  const username = c.req.query('username');
  
  if (!username) {
    return c.json({ error: 'Username is required' }, 400);
  }
  
  // Validate username format first
  if (username.length < 3) {
    return c.json({ available: false, reason: 'Username must be at least 3 characters' });
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return c.json({ available: false, reason: 'Username can only contain letters, numbers, and underscores' });
  }
  
  const available = await authService.isUsernameAvailable(username);
  
  return c.json({ 
    available, 
    reason: available ? null : 'Username is already taken' 
  });
});

// POST /api/users/profile - Create platform user profile after sign-up
// Requirements: 2.4 - Create user profile with provided username on sign-up success
app.post('/api/users/profile', authMiddleware, async (c) => {
  const authUserId = c.get('authUserId');
  const body = await c.req.json();
  const { username } = body;
  
  if (!username) {
    return c.json({ error: 'Username is required' }, 400);
  }
  
  // Validate username format
  if (username.length < 3) {
    return c.json({ error: 'Username must be at least 3 characters' }, 400);
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return c.json({ error: 'Username can only contain letters, numbers, and underscores' }, 400);
  }
  
  // Check if username is available
  const available = await authService.isUsernameAvailable(username);
  if (!available) {
    return c.json({ error: 'Username is already taken' }, 409);
  }
  
  try {
    const user = await authService.createPlatformUserWithUsername(authUserId!, username);
    return c.json({ user }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create profile';
    return c.json({ error: message }, 500);
  }
});

// GET /api/users/me - Get current authenticated user
app.get('/api/users/me', authMiddleware, async (c) => {
  const userId = c.get('userId');
  
  const user = await userService.getUserById(userId!);
  
  if (!user) {
    throw new HTTPException(404, { message: 'User not found' });
  }
  
  const stats = await userService.getUserStats(userId!);
  
  return c.json({ user, stats });
});

// GET /api/users/:id - Get user profile
app.get('/api/users/:id', async (c) => {
  const userId = c.req.param('id');
  
  const user = await userService.getUserById(userId);
  
  if (!user) {
    throw new HTTPException(404, { message: 'User not found' });
  }
  
  // Return public profile (exclude sensitive data)
  return c.json({
    user: {
      id: user.id,
      username: user.username,
      reputationScore: user.reputationScore,
      predictionAccuracy: user.predictionAccuracy,
      debatesParticipated: user.debatesParticipated,
      sandboxCompleted: user.sandboxCompleted,
      createdAt: user.createdAt,
    },
  });
});

// GET /api/users/:id/stats - Get user statistics
app.get('/api/users/:id/stats', async (c) => {
  const userId = c.req.param('id');
  
  const stats = await userService.getUserStats(userId);
  
  if (!stats) {
    throw new HTTPException(404, { message: 'User not found' });
  }
  
  return c.json({ stats });
});

// GET /api/users/:id/debates - Get user's debate history
app.get('/api/users/:id/debates', async (c) => {
  const userId = c.req.param('id');
  
  const user = await userService.getUserById(userId);
  
  if (!user) {
    throw new HTTPException(404, { message: 'User not found' });
  }
  
  const debates = await debateService.getUserDebateHistory(userId);
  
  return c.json({ debates });
});

// ============================================================================
// Connection Cleanup
// ============================================================================

// Start periodic cleanup of stale SSE connections (Requirement 1.6)
const stopConnectionCleanup = startConnectionCleanup();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  stopConnectionCleanup();
  process.exit(0);
});

process.on('SIGINT', () => {
  stopConnectionCleanup();
  process.exit(0);
});

// ============================================================================
// Export
// ============================================================================

export default {
  port: 8080,
  fetch: app.fetch,
};

export { app };
