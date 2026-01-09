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
} from './services';

import type { 
  CreateDebateInput, 
  CreateArgumentInput,
  CreateStanceInput,
  CreateReactionInput,
  CreateCommentInput 
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
  
  return c.json(result, 201);
});

// GET /api/debates - List debates
app.get('/api/debates', async (c) => {
  // For now, return all debates - pagination can be added later
  const { db } = await import('./db');
  const { debates } = await import('./db/schema');
  const { desc } = await import('drizzle-orm');
  
  const allDebates = await db.query.debates.findMany({
    orderBy: [desc(debates.createdAt)],
    limit: 50,
  });
  
  return c.json({ debates: allDebates });
});

// GET /api/debates/:id - Get debate details
app.get('/api/debates/:id', optionalAuthMiddleware, async (c) => {
  const debateId = c.req.param('id');
  
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
  
  return c.json({ debate, rounds: roundsWithArguments });
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
  
  return c.json({ argument }, 201);
});

// POST /api/debates/:id/join - Join debate as oppose debater (requires auth)
app.post('/api/debates/:id/join', authMiddleware, async (c) => {
  const debateId = c.req.param('id');
  const userId = c.get('userId');
  
  const debate = await debateService.joinDebateAsOppose(debateId, userId!);
  
  return c.json({ debate });
});

// ============================================================================
// Voting API Routes (14.3)
// ============================================================================

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

// GET /api/debates/:id/market - Get current market price
// Enforces blind voting - requires pre-stance to be recorded first
app.get('/api/debates/:id/market', optionalAuthMiddleware, async (c) => {
  const debateId = c.req.param('id');
  const userId = c.get('userId');
  
  // Check if debate exists
  const debate = await debateService.getDebateById(debateId);
  if (!debate) {
    throw new HTTPException(404, { message: 'Debate not found' });
  }
  
  // Enforce blind voting if user is authenticated
  if (userId) {
    const canAccess = await votingService.canAccessMarketPrice(debateId, userId);
    if (!canAccess.canAccess) {
      throw new HTTPException(403, { message: canAccess.reason || 'Record your pre-read stance first' });
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
  
  // Broadcast comment to all connected clients
  // Requirements: 9.2
  broadcastCommentUpdate(debateId, comment);
  
  return c.json({ comment }, 201);
});

// GET /api/debates/:id/comments - Get comments for a debate
app.get('/api/debates/:id/comments', async (c) => {
  const debateId = c.req.param('id');
  
  const comments = await commentService.getDebateComments(debateId);
  
  return c.json({ comments });
});

// ============================================================================
// SSE Stream for Realtime Updates (14.5)
// ============================================================================

// Store active SSE connections per debate
const debateConnections = new Map<string, Set<(data: string) => void>>();

// GET /api/debates/:id/stream - SSE stream for market updates
app.get('/api/debates/:id/stream', async (c) => {
  const debateId = c.req.param('id');
  
  // Check if debate exists
  const debate = await debateService.getDebateById(debateId);
  if (!debate) {
    throw new HTTPException(404, { message: 'Debate not found' });
  }
  
  return streamSSE(c, async (stream) => {
    // Add this connection to the debate's connection set
    if (!debateConnections.has(debateId)) {
      debateConnections.set(debateId, new Set());
    }
    
    const connections = debateConnections.get(debateId)!;
    
    const sendData = (data: string) => {
      stream.writeSSE({ data });
    };
    
    connections.add(sendData);
    
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
        connections.delete(sendData);
      }
    }, 30000);
    
    // Clean up on close
    stream.onAbort(() => {
      clearInterval(heartbeatInterval);
      connections.delete(sendData);
      if (connections.size === 0) {
        debateConnections.delete(debateId);
      }
    });
    
    // Keep the stream open
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  });
});

// Helper function to broadcast market updates to all connected clients
export async function broadcastMarketUpdate(debateId: string): Promise<void> {
  const connections = debateConnections.get(debateId);
  if (!connections || connections.size === 0) return;
  
  const marketPrice = await marketService.calculateMarketPrice(debateId);
  const data = JSON.stringify({ event: 'market', data: marketPrice });
  
  for (const send of connections) {
    try {
      send(data);
    } catch {
      // Connection may be closed, will be cleaned up
    }
  }
}

// Helper function to broadcast comment updates to all connected clients
// Requirements: 9.2
export function broadcastCommentUpdate(debateId: string, comment: unknown): void {
  const connections = debateConnections.get(debateId);
  if (!connections || connections.size === 0) return;
  
  const data = JSON.stringify({ event: 'comment', data: { comment } });
  
  for (const send of connections) {
    try {
      send(data);
    } catch {
      // Connection may be closed, will be cleaned up
    }
  }
}

// ============================================================================
// User API Routes (14.6)
// ============================================================================

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
// Export
// ============================================================================

export default {
  port: 8080,
  fetch: app.fetch,
};

export { app };
