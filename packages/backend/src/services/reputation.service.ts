import { eq, and, sql } from 'drizzle-orm';
import { db, users, stances, debates, arguments_, rounds } from '../db';
import type { User, DebateResult } from '@debate-platform/shared';

// Reputation change constants
export const CORRECT_PREDICTION_BONUS = 5;
export const HIGH_IMPACT_ARGUMENT_BONUS = 3;
export const HIGH_IMPACT_THRESHOLD = 10; // Minimum impact score to be considered "high impact"

/**
 * ReputationService handles user reputation updates based on
 * correct predictions and high impact arguments.
 * 
 * Per Requirements 7.2, 7.3:
 * - Increase reputation on correct predictions
 * - Increase reputation on high impact arguments
 */
export class ReputationService {
  /**
   * Update reputation for a user based on debate outcome
   * Per Requirement 7.2: Increase reputation when post-stance aligns with final outcome
   * 
   * A prediction is "correct" when:
   * - User's post-stance direction matches the winning side
   * - Support value > 50 means user predicted "support" wins
   * - Support value < 50 means user predicted "oppose" wins
   * - Support value = 50 is neutral (no prediction bonus)
   * 
   * @param userId - The user's ID
   * @param debateId - The debate ID
   * @param debateResult - The final debate result
   * @returns Updated reputation score or null if user not found
   */
  async updateReputationOnDebateConclusion(
    userId: string,
    debateId: string,
    debateResult: DebateResult
  ): Promise<number | null> {
    // Get user's post-stance for this debate
    const postStance = await db.query.stances.findFirst({
      where: and(
        eq(stances.debateId, debateId),
        eq(stances.voterId, userId),
        eq(stances.type, 'post')
      ),
    });

    if (!postStance) {
      return null; // User didn't vote, no reputation change
    }

    // Determine if prediction was correct
    const userPrediction = this.getPredictionDirection(postStance.supportValue);
    const actualOutcome = debateResult.winnerSide;

    // No bonus for ties or neutral predictions
    if (actualOutcome === 'tie' || userPrediction === 'neutral') {
      return null;
    }

    const isCorrect = userPrediction === actualOutcome;

    // Update prediction accuracy
    await this.updatePredictionAccuracy(userId, isCorrect);

    if (isCorrect) {
      return await this.increaseReputation(userId, CORRECT_PREDICTION_BONUS);
    }

    return null;
  }

  /**
   * Determine prediction direction from support value
   * 
   * @param supportValue - The support value (0-100)
   * @returns 'support', 'oppose', or 'neutral'
   */
  getPredictionDirection(supportValue: number): 'support' | 'oppose' | 'neutral' {
    if (supportValue > 50) {
      return 'support';
    } else if (supportValue < 50) {
      return 'oppose';
    }
    return 'neutral';
  }

  /**
   * Update reputation for all participants when a debate concludes
   * Per original vision: Reward correct predictions and high-impact arguments
   * 
   * @param debateId - The debate ID
   * @param debateResult - The final debate result
   */
  async updateAllParticipants(debateId: string, debateResult: DebateResult): Promise<void> {
    // Delegate to processDebateConclusion to avoid code duplication
    await this.processDebateConclusion(debateId, debateResult);
  }

  /**
   * Update reputation for a debater based on argument impact
   * Per Requirement 7.3: Increase reputation when arguments receive high impact scores
   * 
   * @param userId - The debater's ID
   * @param argumentId - The argument ID
   * @returns Updated reputation score or null if conditions not met
   */
  async updateReputationOnHighImpactArgument(
    userId: string,
    argumentId: string
  ): Promise<number | null> {
    // Get the argument
    const argument = await db.query.arguments_.findFirst({
      where: eq(arguments_.id, argumentId),
    });

    if (!argument) {
      return null;
    }

    // Check if argument has high impact (>= threshold)
    if (argument.impactScore >= HIGH_IMPACT_THRESHOLD) {
      return await this.increaseReputation(userId, HIGH_IMPACT_ARGUMENT_BONUS);
    }

    return null;
  }

  /**
   * Update prediction accuracy for a user
   * Tracks ratio of correct predictions over time using atomic database update
   * to avoid lost-update race conditions
   * 
   * @param userId - The user's ID
   * @param wasCorrect - Whether the prediction was correct
   */
  async updatePredictionAccuracy(userId: string, wasCorrect: boolean): Promise<void> {
    const weight = 0.1; // How much new predictions affect overall accuracy
    
    // Atomic update using SQL expression to avoid read-modify-write race conditions
    // Formula: wasCorrect ? accuracy + (100 - accuracy) * weight : accuracy - accuracy * weight
    // Simplified: wasCorrect ? accuracy * (1 - weight) + 100 * weight : accuracy * (1 - weight)
    await db.update(users)
      .set({ 
        predictionAccuracy: wasCorrect
          ? sql`ROUND(${users.predictionAccuracy} + (100 - ${users.predictionAccuracy}) * ${weight}, 2)`
          : sql`ROUND(${users.predictionAccuracy} - ${users.predictionAccuracy} * ${weight}, 2)`
      })
      .where(eq(users.id, userId));
  }

  /**
   * Increase a user's reputation score
   * 
   * @param userId - The user's ID
   * @param amount - Amount to increase reputation by
   * @returns New reputation score or null if user not found
   */
  async increaseReputation(userId: string, amount: number): Promise<number | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return null;
    }

    const newReputation = user.reputationScore + amount;

    const [updated] = await db.update(users)
      .set({ reputationScore: newReputation })
      .where(eq(users.id, userId))
      .returning();

    return updated.reputationScore;
  }

  /**
   * Process reputation updates for all participants when a debate concludes
   * 
   * @param debateId - The debate ID
   * @param debateResult - The final debate result
   */
  async processDebateConclusion(debateId: string, debateResult: DebateResult): Promise<void> {
    // Get all users who voted in this debate (have post-stances)
    const postStances = await db.query.stances.findMany({
      where: and(
        eq(stances.debateId, debateId),
        eq(stances.type, 'post')
      ),
    });

    // Update reputation for each voter
    for (const stance of postStances) {
      await this.updateReputationOnDebateConclusion(
        stance.voterId,
        debateId,
        debateResult
      );
    }

    // Get all arguments in this debate and check for high impact
    const debate = await db.query.debates.findFirst({
      where: eq(debates.id, debateId),
    });

    if (debate) {
      // Get all arguments from this debate's rounds
      const debateArguments = await db.query.arguments_.findMany({
        where: sql`${arguments_.roundId} IN (
          SELECT id FROM rounds WHERE debate_id = ${debateId}
        )`,
      });

      // Update reputation for high impact arguments
      for (const arg of debateArguments) {
        await this.updateReputationOnHighImpactArgument(arg.debaterId, arg.id);
      }
    }
  }

  /**
   * Get user's current reputation score
   * 
   * @param userId - The user's ID
   * @returns Reputation score or null if user not found
   */
  async getReputation(userId: string): Promise<number | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    return user?.reputationScore ?? null;
  }

  /**
   * Check if a user's prediction was correct for a concluded debate
   * 
   * @param userId - The user's ID
   * @param debateId - The debate ID
   * @returns Object with prediction details or null if not applicable
   */
  async checkPredictionAccuracy(
    userId: string,
    debateId: string
  ): Promise<{
    userPrediction: 'support' | 'oppose' | 'neutral';
    actualOutcome: 'support' | 'oppose' | 'tie';
    isCorrect: boolean;
  } | null> {
    // Get debate
    const debate = await db.query.debates.findFirst({
      where: eq(debates.id, debateId),
    });

    if (!debate || debate.status !== 'concluded') {
      return null;
    }

    // Get user's post-stance
    const postStance = await db.query.stances.findFirst({
      where: and(
        eq(stances.debateId, debateId),
        eq(stances.voterId, userId),
        eq(stances.type, 'post')
      ),
    });

    if (!postStance) {
      return null;
    }

    // Calculate the actual outcome based on final market price
    // For now, we'll use a simplified approach based on the debate's final state
    // In a full implementation, this would use the market service to get final prices
    const actualOutcome = await this.determineDebateOutcome(debateId);
    const userPrediction = this.getPredictionDirection(postStance.supportValue);

    return {
      userPrediction,
      actualOutcome,
      isCorrect: userPrediction !== 'neutral' && actualOutcome !== 'tie' && userPrediction === actualOutcome,
    };
  }

  /**
   * Determine the outcome of a concluded debate
   * Based on the final weighted average of post-stances
   * 
   * @param debateId - The debate ID
   * @returns 'support', 'oppose', or 'tie'
   */
  async determineDebateOutcome(debateId: string): Promise<'support' | 'oppose' | 'tie'> {
    // Get all post-stances for this debate
    const postStances = await db.query.stances.findMany({
      where: and(
        eq(stances.debateId, debateId),
        eq(stances.type, 'post')
      ),
    });

    if (postStances.length === 0) {
      return 'tie';
    }

    // Calculate average support value
    const totalSupport = postStances.reduce((sum: number, s: typeof stances.$inferSelect) => sum + s.supportValue, 0);
    const avgSupport = totalSupport / postStances.length;

    if (avgSupport > 50) {
      return 'support';
    } else if (avgSupport < 50) {
      return 'oppose';
    }
    return 'tie';
  }
}

// Export singleton instance
export const reputationService = new ReputationService();
