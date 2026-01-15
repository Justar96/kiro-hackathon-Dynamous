import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, stances, debates, users } from '../db';
import type { 
  Stance, 
  StanceValue, 
  PersuasionDelta,
  CreateStanceInput 
} from '@thesis/shared';

/**
 * VotingService handles stance recording and persuasion calculation.
 * 
 * Per Requirements 3.1, 3.2, 3.3, 3.4, 3.5:
 * - Records pre-read and post-read stances
 * - Calculates persuasion delta
 * - Enforces blind voting (no market access before pre-stance)
 */
export class VotingService {
  /**
   * Record a pre-read stance for a debate
   * Per Requirement 3.1: Prompt for pre-read stance with support value and confidence
   * 
   * @param input - The stance input
   * @returns Created stance
   * @throws Error if stance already exists or input is invalid
   */
  async recordPreStance(input: CreateStanceInput): Promise<Stance> {
    // Validate input
    this.validateStanceInput(input);

    // Verify debate exists
    const debate = await db.query.debates.findFirst({
      where: eq(debates.id, input.debateId),
    });

    if (!debate) {
      throw new Error('Debate not found');
    }

    // Verify voter exists
    const voter = await db.query.users.findFirst({
      where: eq(users.id, input.voterId),
    });

    if (!voter) {
      throw new Error('User not found');
    }

    // Check if pre-stance already exists
    const existingPreStance = await db.query.stances.findFirst({
      where: and(
        eq(stances.debateId, input.debateId),
        eq(stances.voterId, input.voterId),
        eq(stances.type, 'pre')
      ),
    });

    if (existingPreStance) {
      throw new Error('Pre-read stance already recorded for this debate');
    }

    // Create pre-stance
    const [stance] = await db.insert(stances).values({
      id: nanoid(),
      debateId: input.debateId,
      voterId: input.voterId,
      type: 'pre',
      supportValue: input.supportValue,
      confidence: input.confidence ?? 3,
      lastArgumentSeen: input.lastArgumentSeen || null,
      createdAt: new Date(),
    }).returning();

    return this.mapToStance(stance);
  }

  /**
   * Record a post-read stance for a debate
   * Per Requirements 3.2, 3.3: Record post-read stance and calculate persuasion delta
   * 
   * @param input - The stance input
   * @returns Created stance with persuasion delta
   * @throws Error if pre-stance not recorded or input is invalid
   */
  async recordPostStance(input: CreateStanceInput): Promise<{ stance: Stance; delta: PersuasionDelta }> {
    // Validate input
    this.validateStanceInput(input);

    // Verify debate exists
    const debate = await db.query.debates.findFirst({
      where: eq(debates.id, input.debateId),
    });

    if (!debate) {
      throw new Error('Debate not found');
    }

    // Verify voter exists
    const voter = await db.query.users.findFirst({
      where: eq(users.id, input.voterId),
    });

    if (!voter) {
      throw new Error('User not found');
    }

    // Check if pre-stance exists (required before post-stance)
    const preStance = await db.query.stances.findFirst({
      where: and(
        eq(stances.debateId, input.debateId),
        eq(stances.voterId, input.voterId),
        eq(stances.type, 'pre')
      ),
    });

    if (!preStance) {
      throw new Error('Record your pre-read stance first');
    }

    // Check if post-stance already exists
    const existingPostStance = await db.query.stances.findFirst({
      where: and(
        eq(stances.debateId, input.debateId),
        eq(stances.voterId, input.voterId),
        eq(stances.type, 'post')
      ),
    });

    let stance: typeof stances.$inferSelect;

    if (existingPostStance) {
      // Update existing post-stance (Requirement 3.5)
      const [updated] = await db.update(stances)
        .set({
          supportValue: input.supportValue,
          confidence: input.confidence ?? 3,
          lastArgumentSeen: input.lastArgumentSeen || existingPostStance.lastArgumentSeen,
        })
        .where(eq(stances.id, existingPostStance.id))
        .returning();
      stance = updated;
    } else {
      // Create new post-stance
      const [created] = await db.insert(stances).values({
        id: nanoid(),
        debateId: input.debateId,
        voterId: input.voterId,
        type: 'post',
        supportValue: input.supportValue,
        confidence: input.confidence ?? 3,
        lastArgumentSeen: input.lastArgumentSeen || null,
        createdAt: new Date(),
      }).returning();
      stance = created;
    }

    // Calculate persuasion delta (Requirement 3.3)
    const delta = this.calculatePersuasionDelta(
      { supportValue: preStance.supportValue, confidence: preStance.confidence },
      { supportValue: stance.supportValue, confidence: stance.confidence },
      input.voterId,
      input.debateId,
      stance.lastArgumentSeen
    );

    // Record market data point for historical tracking
    const { marketService } = await import('./market.service');
    const currentPrice = await marketService.calculateMarketPrice(input.debateId);
    await marketService.recordDataPoint(input.debateId, currentPrice);

    return {
      stance: this.mapToStance(stance),
      delta,
    };
  }

  /**
   * Calculate persuasion delta between pre and post stances
   * Per Requirement 3.3: delta = postStance.supportValue - preStance.supportValue
   * 
   * @param preStance - The pre-read stance value
   * @param postStance - The post-read stance value
   * @param userId - The user ID
   * @param debateId - The debate ID
   * @param lastArgumentSeen - The last argument seen for impact attribution
   * @returns Persuasion delta object
   */
  calculatePersuasionDelta(
    preStance: StanceValue,
    postStance: StanceValue,
    userId: string,
    debateId: string,
    lastArgumentSeen: string | null
  ): PersuasionDelta {
    return {
      userId,
      debateId,
      preStance,
      postStance,
      delta: postStance.supportValue - preStance.supportValue,
      lastArgumentSeen,
    };
  }

  /**
   * Check if user has recorded pre-stance for a debate
   * Per Requirement 3.4: Used for blind voting enforcement
   * 
   * @param debateId - The debate ID
   * @param userId - The user ID
   * @returns True if pre-stance exists
   */
  async hasPreStance(debateId: string, userId: string): Promise<boolean> {
    const preStance = await db.query.stances.findFirst({
      where: and(
        eq(stances.debateId, debateId),
        eq(stances.voterId, userId),
        eq(stances.type, 'pre')
      ),
    });

    return preStance !== undefined;
  }

  /**
   * Enforce blind voting - check if user can access market price
   * Per Requirement 3.4: Prevent market price access before pre-stance recorded
   * 
   * @param debateId - The debate ID
   * @param userId - The user ID
   * @throws Error if pre-stance not recorded
   */
  async enforceBlindVoting(debateId: string, userId: string): Promise<void> {
    const hasRecordedPreStance = await this.hasPreStance(debateId, userId);
    
    if (!hasRecordedPreStance) {
      throw new Error('Record your pre-read stance first');
    }
  }

  /**
   * Check if user can access market price (for API use)
   * Per Requirement 3.4: Returns whether access is allowed
   * 
   * @param debateId - The debate ID
   * @param userId - The user ID
   * @returns Object with canAccess boolean and optional reason
   */
  async canAccessMarketPrice(debateId: string, userId: string): Promise<{ canAccess: boolean; reason?: string }> {
    const hasRecordedPreStance = await this.hasPreStance(debateId, userId);
    
    if (!hasRecordedPreStance) {
      return { 
        canAccess: false, 
        reason: 'Record your pre-read stance first' 
      };
    }
    
    return { canAccess: true };
  }

  /**
   * Get user's stances for a debate
   * 
   * @param debateId - The debate ID
   * @param userId - The user ID
   * @returns Pre and post stances if they exist
   */
  async getUserStances(debateId: string, userId: string): Promise<{ pre?: Stance; post?: Stance }> {
    const userStances = await db.query.stances.findMany({
      where: and(
        eq(stances.debateId, debateId),
        eq(stances.voterId, userId)
      ),
    });

    const result: { pre?: Stance; post?: Stance } = {};

    for (const stance of userStances) {
      if (stance.type === 'pre') {
        result.pre = this.mapToStance(stance);
      } else if (stance.type === 'post') {
        result.post = this.mapToStance(stance);
      }
    }

    return result;
  }

  /**
   * Get persuasion delta for a user in a debate
   * 
   * @param debateId - The debate ID
   * @param userId - The user ID
   * @returns Persuasion delta or null if not available
   */
  async getPersuasionDelta(debateId: string, userId: string): Promise<PersuasionDelta | null> {
    const { pre, post } = await this.getUserStances(debateId, userId);

    if (!pre || !post) {
      return null;
    }

    return this.calculatePersuasionDelta(
      { supportValue: pre.supportValue, confidence: pre.confidence },
      { supportValue: post.supportValue, confidence: post.confidence },
      userId,
      debateId,
      post.lastArgumentSeen
    );
  }

  /**
   * Validate stance input values
   * 
   * @param input - The stance input to validate
   * @throws Error if input is invalid
   */
  private validateStanceInput(input: CreateStanceInput): void {
    if (input.supportValue < 0 || input.supportValue > 100) {
      throw new Error('Stance must be between 0 and 100');
    }

    // Confidence is now optional, default to 3 if not provided
    const confidence = input.confidence ?? 3;
    if (confidence < 1 || confidence > 5) {
      throw new Error('Confidence must be between 1 and 5');
    }
  }

  /**
   * Map database row to Stance type
   */
  private mapToStance(row: typeof stances.$inferSelect): Stance {
    return {
      id: row.id,
      debateId: row.debateId,
      voterId: row.voterId,
      type: row.type,
      supportValue: row.supportValue,
      confidence: row.confidence,
      lastArgumentSeen: row.lastArgumentSeen,
      createdAt: row.createdAt,
    };
  }

  /**
   * Get aggregate stance statistics for a debate (for spectators)
   * Shows how the audience's minds changed without requiring login
   */
  async getDebateStanceStats(debateId: string): Promise<{
    totalVoters: number;
    avgPreStance: number;
    avgPostStance: number;
    avgDelta: number;
    mindChangedCount: number;
  }> {
    const allStances = await db.query.stances.findMany({
      where: eq(stances.debateId, debateId),
    });

    const byVoter = new Map<string, { pre?: number; post?: number }>();
    for (const s of allStances) {
      const existing = byVoter.get(s.voterId) || {};
      if (s.type === 'pre') existing.pre = s.supportValue;
      if (s.type === 'post') existing.post = s.supportValue;
      byVoter.set(s.voterId, existing);
    }

    const votersWithBoth = [...byVoter.values()].filter(v => v.pre !== undefined && v.post !== undefined);
    const totalVoters = votersWithBoth.length;

    if (totalVoters === 0) {
      return { totalVoters: 0, avgPreStance: 50, avgPostStance: 50, avgDelta: 0, mindChangedCount: 0 };
    }

    const avgPreStance = votersWithBoth.reduce((sum, v) => sum + v.pre!, 0) / totalVoters;
    const avgPostStance = votersWithBoth.reduce((sum, v) => sum + v.post!, 0) / totalVoters;
    const avgDelta = avgPostStance - avgPreStance;
    const mindChangedCount = votersWithBoth.filter(v => Math.abs(v.post! - v.pre!) >= 10).length;

    return {
      totalVoters,
      avgPreStance: Math.round(avgPreStance),
      avgPostStance: Math.round(avgPostStance),
      avgDelta: Math.round(avgDelta * 10) / 10,
      mindChangedCount,
    };
  }
}

// Export singleton instance
export const votingService = new VotingService();
