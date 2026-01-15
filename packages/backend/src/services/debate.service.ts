import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, debates, rounds, arguments_, users } from '../db';
import type { 
  Debate, 
  Round, 
  Argument, 
  CreateDebateInput, 
  CreateArgumentInput,
  DebateResult,
  RoundType,
  ArgumentValidationError,
} from '@thesis/shared';
import { 
  ROUNDS,
  RESOLUTION_MAX_LENGTH,
  getCharLimit,
  canSubmitArgument,
  validateArgumentContent,
} from '@thesis/shared';

/**
 * DebateService handles debate lifecycle including creation,
 * argument submission, round advancement, and conclusion.
 */
export class DebateService {
  /**
   * Create a new debate with the given resolution
   * Per Requirements 1.1, 1.2, 1.3, 1.4, 2.1:
   * - Validates resolution text (non-empty, <= 500 chars)
   * - Creates debate with 50/50 market price
   * - Assigns creator as support debater
   * - Creates 3 rounds (opening, rebuttal, closing)
   * 
   * @param input - The debate creation input
   * @returns Created debate with rounds
   * @throws Error if resolution is invalid
   */
  async createDebate(input: CreateDebateInput): Promise<{ debate: Debate; rounds: Round[] }> {
    // Validate resolution text (Requirements 1.2, 1.4)
    if (!input.resolution || input.resolution.trim().length === 0) {
      throw new Error('Resolution text cannot be empty');
    }
    
    if (input.resolution.length > RESOLUTION_MAX_LENGTH) {
      throw new Error(`Resolution exceeds ${RESOLUTION_MAX_LENGTH} character limit`);
    }

    // Verify creator exists
    const creator = await db.query.users.findFirst({
      where: eq(users.id, input.creatorId),
    });

    if (!creator) {
      throw new Error('Creator user not found');
    }

    const debateId = nanoid();
    const now = new Date();

    // Create debate (Requirements 1.1, 1.3)
    // Creator is assigned as support debater, initial market price is 50/50
    const [debate] = await db.insert(debates).values({
      id: debateId,
      resolution: input.resolution.trim(),
      status: 'active',
      currentRound: 1,
      currentTurn: 'support',
      supportDebaterId: input.creatorId,
      opposeDebaterId: null,
      createdAt: now,
      concludedAt: null,
    }).returning();

    // Create 3 rounds (Requirement 2.1)
    const roundsData = ROUNDS.map((r: typeof ROUNDS[number]) => ({
      id: nanoid(),
      debateId: debateId,
      roundNumber: r.number,
      roundType: r.type,
      supportArgumentId: null,
      opposeArgumentId: null,
      completedAt: null,
    }));

    const createdRounds = await db.insert(rounds).values(roundsData).returning();

    return {
      debate: this.mapToDebate(debate),
      rounds: createdRounds.map(r => this.mapToRound(r)),
    };
  }


  /**
   * Submit an argument for a debate round
   * Per Requirements 2.2, 2.3, 2.6, 7.5:
   * - Validates current turn matches submitter's side
   * - Enforces character limits per round type (min and max)
   * - Rejects out-of-turn submissions
   * - Provides specific feedback for rejected arguments
   */
  async submitArgument(input: CreateArgumentInput): Promise<Argument> {
    const debate = await db.query.debates.findFirst({
      where: eq(debates.id, input.debateId),
    });

    if (!debate) {
      throw new Error('Debate not found');
    }

    // Use centralized validation helper
    const check = canSubmitArgument(this.mapToDebate(debate), input.debaterId);
    if (!check.allowed) {
      throw new Error(check.reason);
    }
    const submitterSide = check.side;

    // Get current round
    const currentRound = await db.query.rounds.findFirst({
      where: and(
        eq(rounds.debateId, input.debateId),
        eq(rounds.roundNumber, debate.currentRound)
      ),
    });

    if (!currentRound) {
      throw new Error('Current round not found');
    }

    // Check if this side already submitted for this round
    const alreadySubmitted = submitterSide === 'support' 
      ? currentRound.supportArgumentId !== null
      : currentRound.opposeArgumentId !== null;

    if (alreadySubmitted) {
      throw new Error('This round is already complete');
    }

    // Validate argument content with detailed feedback (Requirement 7.5)
    const roundType = currentRound.roundType as RoundType;
    const validationError = validateArgumentContent(input.content, roundType);
    
    if (validationError) {
      // Format error message with specific feedback
      const errorMessage = this.formatArgumentValidationError(validationError);
      throw new Error(errorMessage);
    }

    // Create the argument
    const argumentId = nanoid();
    const [argument] = await db.insert(arguments_).values({
      id: argumentId,
      roundId: currentRound.id,
      debaterId: input.debaterId,
      side: submitterSide,
      content: input.content,
      impactScore: 0,
      createdAt: new Date(),
    }).returning();

    // Update round with the argument
    const updateField = submitterSide === 'support' 
      ? { supportArgumentId: argumentId }
      : { opposeArgumentId: argumentId };
    
    await db.update(rounds)
      .set(updateField)
      .where(eq(rounds.id, currentRound.id));

    // Switch turn to the other side
    const nextTurn = submitterSide === 'support' ? 'oppose' : 'support';
    await db.update(debates)
      .set({ currentTurn: nextTurn })
      .where(eq(debates.id, input.debateId));

    // Check if round is complete and advance if needed
    await this.checkAndAdvanceRound(input.debateId);

    return this.mapToArgument(argument);
  }

  /**
   * Format argument validation error with detailed feedback
   * Per Requirement 7.5: Include specific character count requirement and improvement suggestions
   */
  private formatArgumentValidationError(error: ArgumentValidationError): string {
    const { message, details } = error;
    const suggestionsText = details.suggestions.slice(0, 3).map((suggestion: string) => `• ${suggestion}`).join('\n');
    
    return `${message}\n\nSuggestions to improve your argument:\n${suggestionsText}`;
  }


  /**
   * Check if the current round is complete and advance to next round
   * Per Requirements 2.4, 2.5:
   * - Advances when both sides complete a round
   * - Concludes debate after round 3
   * 
   * @param debateId - The debate ID
   */
  private async checkAndAdvanceRound(debateId: string): Promise<void> {
    const debate = await db.query.debates.findFirst({
      where: eq(debates.id, debateId),
    });

    if (!debate || debate.status === 'concluded') {
      return;
    }

    const currentRound = await db.query.rounds.findFirst({
      where: and(
        eq(rounds.debateId, debateId),
        eq(rounds.roundNumber, debate.currentRound)
      ),
    });

    if (!currentRound) {
      return;
    }

    // Check if both sides have submitted
    if (currentRound.supportArgumentId && currentRound.opposeArgumentId) {
      // Mark round as complete
      await db.update(rounds)
        .set({ completedAt: new Date() })
        .where(eq(rounds.id, currentRound.id));

      // Advance to next round or conclude (Requirements 2.4, 2.5)
      if (debate.currentRound < 3) {
        const newRoundNumber = (debate.currentRound + 1) as 1 | 2 | 3;
        await db.update(debates)
          .set({ 
            currentRound: newRoundNumber,
            currentTurn: 'support' // Reset turn to support for new round
          })
          .where(eq(debates.id, debateId));
        
        // Broadcast round transition (Requirement 5.1, 5.2)
        const { broadcastRoundUpdate } = await import('../broadcast');
        broadcastRoundUpdate(
          debateId,
          newRoundNumber,
          'support',
          true, // previousRoundCompleted
          'active'
        );
      } else {
        // Conclude debate after round 3
        await this.concludeDebate(debateId);
      }
    }
  }

  /**
   * Determine the winner of a debate based on NET PERSUASION DELTA
   * Per original vision: Winner = biggest net persuasion delta (who changed more minds)
   * 
   * @param debateId - The debate ID
   * @returns Winner determination with persuasion metrics
   */
  private async determineWinner(debateId: string): Promise<{
    winnerSide: 'support' | 'oppose' | 'tie';
    finalSupportPrice: number;
    finalOpposePrice: number;
    totalMindChanges: number;
    netPersuasionDelta: number;
  }> {
    // Get final market price for display
    const { marketService } = await import('./market.service');
    const { stances } = await import('../db');
    const marketPrice = await marketService.calculateMarketPrice(debateId);
    
    // Get all pre/post stance pairs to calculate persuasion delta
    const allStances = await db.query.stances.findMany({
      where: eq(stances.debateId, debateId),
    });

    // Group by voter to get pre/post pairs
    const voterStances = new Map<string, { pre?: number; post?: number }>();
    for (const stance of allStances) {
      const existing = voterStances.get(stance.voterId) || {};
      if (stance.type === 'pre') existing.pre = stance.supportValue;
      if (stance.type === 'post') existing.post = stance.supportValue;
      voterStances.set(stance.voterId, existing);
    }

    // Calculate persuasion metrics
    const completePairs = [...voterStances.values()].filter(v => v.pre !== undefined && v.post !== undefined);
    const totalMindChanges = completePairs.filter(v => Math.abs(v.post! - v.pre!) >= 10).length;
    
    // Net persuasion delta: positive = moved toward support, negative = moved toward oppose
    const netPersuasionDelta = completePairs.length > 0
      ? completePairs.reduce((sum, v) => sum + (v.post! - v.pre!), 0) / completePairs.length
      : 0;

    // WINNER = NET PERSUASION DELTA (not price threshold)
    // Threshold of 5 points average shift to declare a winner
    let winnerSide: 'support' | 'oppose' | 'tie';
    if (netPersuasionDelta >= 5) {
      winnerSide = 'support'; // Audience moved toward support
    } else if (netPersuasionDelta <= -5) {
      winnerSide = 'oppose'; // Audience moved toward oppose
    } else {
      winnerSide = 'tie'; // No significant mind change
    }

    return {
      winnerSide,
      finalSupportPrice: marketPrice.supportPrice,
      finalOpposePrice: marketPrice.opposePrice,
      totalMindChanges,
      netPersuasionDelta: Math.round(netPersuasionDelta * 10) / 10,
    };
  }

  /**
   * Conclude a debate and calculate final results
   * Per Requirement 2.5 + Original Vision: Measure persuasion delta
   * 
   * @param debateId - The debate ID
   * @returns Debate result with persuasion metrics
   */
  async concludeDebate(debateId: string): Promise<DebateResult> {
    const debate = await db.query.debates.findFirst({
      where: eq(debates.id, debateId),
    });

    if (!debate) {
      throw new Error('Debate not found');
    }

    // Calculate winner and persuasion metrics
    const result = await this.determineWinner(debateId);

    // Mark debate as concluded
    await db.update(debates)
      .set({ 
        status: 'concluded',
        concludedAt: new Date()
      })
      .where(eq(debates.id, debateId));

    // Wire matching hook: debate concluded (Requirement 4.4)
    const { matchingService } = await import('./matching.service');
    await matchingService.onDebateConcluded(debateId);

    // Broadcast debate concluded event (Requirement 5.5)
    const { broadcastRoundUpdate } = await import('../broadcast');
    broadcastRoundUpdate(
      debateId,
      3, // Final round
      debate.currentTurn, // Last turn
      true, // previousRoundCompleted
      'concluded'
    );

    // Trigger reputation updates for all participants using both engines
    // Legacy reputation service for backward compatibility
    const { reputationService } = await import('./reputation.service');
    await reputationService.updateAllParticipants(debateId, {
      debateId,
      ...result,
    });

    // ReputationEngineV2 for enhanced multi-factor reputation (Requirements 4.2, 4.3)
    const { reputationEngineV2 } = await import('./reputation-engine-v2.service');
    await reputationEngineV2.processDebateConclusion(debateId, {
      debateId,
      ...result,
    });

    // Update sandbox completion for debaters (Requirement 7.3)
    // Increment debates participated count for both debaters
    // This automatically sets sandboxCompleted = true after 5 debates
    const { userService } = await import('./user.service');
    await userService.incrementDebatesParticipated(debate.supportDebaterId);
    if (debate.opposeDebaterId) {
      await userService.incrementDebatesParticipated(debate.opposeDebaterId);
    }

    return {
      debateId,
      ...result,
    };
  }


  /**
   * Get a debate by ID
   */
  async getDebateById(debateId: string): Promise<Debate | null> {
    const debate = await db.query.debates.findFirst({
      where: eq(debates.id, debateId),
    });

    return debate ? this.mapToDebate(debate) : null;
  }

  /**
   * Get rounds for a debate
   */
  async getRoundsByDebateId(debateId: string): Promise<Round[]> {
    const debateRounds = await db.query.rounds.findMany({
      where: eq(rounds.debateId, debateId),
      orderBy: (rounds, { asc }) => [asc(rounds.roundNumber)],
    });

    return debateRounds.map(r => this.mapToRound(r));
  }

  /**
   * Get argument by ID
   */
  async getArgumentById(argumentId: string): Promise<Argument | null> {
    const argument = await db.query.arguments_.findFirst({
      where: eq(arguments_.id, argumentId),
    });

    return argument ? this.mapToArgument(argument) : null;
  }

  /**
   * Get debates where a user participated (as debater or voter)
   * Per Requirement 7.5: Show debate history in user profile
   * Supports both platform user ID and auth user ID
   */
  async getUserDebateHistory(userId: string): Promise<Debate[]> {
    const { or, eq: eqOp } = await import('drizzle-orm');
    
    // First, try to find the platform user ID if an auth user ID was provided
    let platformUserId = userId;
    const user = await db.query.users.findFirst({
      where: eqOp(users.authUserId, userId),
    });
    if (user) {
      platformUserId = user.id;
    }
    
    // Get debates where user is a debater
    const userDebates = await db.query.debates.findMany({
      where: or(
        eq(debates.supportDebaterId, platformUserId),
        eq(debates.opposeDebaterId, platformUserId)
      ),
      orderBy: (debates, { desc }) => [desc(debates.createdAt)],
      limit: 20,
    });

    return userDebates.map(d => this.mapToDebate(d));
  }

  /**
   * Join a debate as the oppose debater
   */
  async joinDebateAsOppose(debateId: string, userId: string): Promise<Debate> {
    const debate = await db.query.debates.findFirst({
      where: eq(debates.id, debateId),
    });

    if (!debate) {
      throw new Error('Debate not found');
    }

    if (debate.opposeDebaterId) {
      throw new Error('Oppose side already taken');
    }

    if (debate.supportDebaterId === userId) {
      throw new Error('Cannot join both sides of a debate');
    }

    const [updated] = await db.update(debates)
      .set({ opposeDebaterId: userId })
      .where(eq(debates.id, debateId))
      .returning();

    return this.mapToDebate(updated);
  }

  /**
   * Map database row to Debate type
   */
  private mapToDebate(row: typeof debates.$inferSelect): Debate {
    return {
      id: row.id,
      resolution: row.resolution,
      status: row.status,
      currentRound: row.currentRound as 1 | 2 | 3,
      currentTurn: row.currentTurn,
      supportDebaterId: row.supportDebaterId,
      opposeDebaterId: row.opposeDebaterId,
      createdAt: row.createdAt,
      concludedAt: row.concludedAt,
    };
  }

  /**
   * Map database row to Round type
   */
  private mapToRound(row: typeof rounds.$inferSelect): Round {
    return {
      id: row.id,
      debateId: row.debateId,
      roundNumber: row.roundNumber as 1 | 2 | 3,
      roundType: row.roundType,
      supportArgumentId: row.supportArgumentId,
      opposeArgumentId: row.opposeArgumentId,
      completedAt: row.completedAt,
    };
  }

  /**
   * Map database row to Argument type
   */
  private mapToArgument(row: typeof arguments_.$inferSelect): Argument {
    return {
      id: row.id,
      roundId: row.roundId,
      debaterId: row.debaterId,
      side: row.side,
      content: row.content,
      impactScore: row.impactScore,
      createdAt: row.createdAt,
    };
  }
}

// Export singleton instance
export const debateService = new DebateService();
