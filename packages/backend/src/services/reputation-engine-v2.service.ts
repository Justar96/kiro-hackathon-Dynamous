import { eq, and, sql, desc } from 'drizzle-orm';
import { db, users, stances, debates, arguments_, rounds, reputationFactors, reputationHistory } from '../db';
import type { 
  ReputationScore, 
  ReputationBreakdown, 
  ReputationFactor,
  ReputationHistory,
  DebateResult,
  REPUTATION_WEIGHTS,
  calculateDiminishingReturns,
  REPUTATION_DECAY_THRESHOLD_DAYS,
  REPUTATION_DECAY_RATE_PER_WEEK,
  LOW_IMPACT_THRESHOLD
} from '@debate-platform/shared';
import { 
  REPUTATION_WEIGHTS as WEIGHTS,
  calculateDiminishingReturns as calcDiminishing,
  REPUTATION_DECAY_THRESHOLD_DAYS as DECAY_THRESHOLD,
  REPUTATION_DECAY_RATE_PER_WEEK as DECAY_RATE,
  LOW_IMPACT_THRESHOLD as IMPACT_THRESHOLD
} from '@debate-platform/shared';

/**
 * ReputationEngineV2 - Enhanced reputation calculation with multi-factor scoring
 * 
 * Per Requirements 4.1, 4.5:
 * - Calculate reputation based on multiple weighted factors
 * - Consider both reputation score and prediction accuracy for vote weight
 * 
 * Factors:
 * - Impact Score (35%): How much arguments change minds
 * - Prediction Accuracy (25%): How well user predicts outcomes
 * - Participation Quality (20%): Engagement without gaming
 * - Consistency (10%): Regular quality contributions
 * - Community Trust (10%): Reactions and endorsements
 */
export class ReputationEngineV2 {
  /**
   * Calculate comprehensive reputation score using weighted factors
   * Per Requirement 4.1: Calculate reputation based on multiple weighted factors
   * 
   * @param userId - The user's ID
   * @returns ReputationScore with overall and factor breakdown
   */
  async calculateReputation(userId: string): Promise<ReputationScore> {
    // Get or create reputation factors for user
    const factors = await this.getOrCreateReputationFactors(userId);
    
    // Calculate individual factor scores (normalized to 0-100)
    const persuasionSkill = this.normalizeImpactScore(factors.impactScoreTotal);
    const predictionAccuracy = factors.predictionAccuracy;
    const consistency = this.calculateConsistencyScore(factors.participationCount, factors.qualityScore);
    const trustLevel = this.calculateTrustLevel(persuasionSkill, predictionAccuracy, consistency);
    
    // Calculate overall score (0-1000 scale)
    const overall = Math.round(
      (persuasionSkill * WEIGHTS.impactScore +
       predictionAccuracy * WEIGHTS.predictionAccuracy +
       factors.qualityScore * WEIGHTS.participationQuality +
       consistency * WEIGHTS.consistency +
       trustLevel * WEIGHTS.communityTrust) * 10
    );
    
    return {
      overall: Math.max(0, Math.min(1000, overall)),
      persuasionSkill,
      predictionAccuracy,
      consistency,
      trustLevel,
    };
  }

  /**
   * Calculate vote weight considering reputation and accuracy
   * Per Requirement 4.5: Consider both reputation score and prediction accuracy
   * 
   * @param userId - The user's ID
   * @returns Vote weight between 0.5 and 1.5
   */
  async calculateVoteWeight(userId: string): Promise<number> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return 0.5; // Minimum weight for unknown users
    }

    // Check sandbox completion
    if (!user.sandboxCompleted) {
      return 0.5; // Sandbox users have half weight
    }

    // Get reputation factors
    const factors = await this.getOrCreateReputationFactors(userId);
    
    // Calculate weight based on reputation and prediction accuracy
    // Base weight is 1.0, modified by reputation and accuracy
    const reputationModifier = (user.reputationScore - 100) / 400; // -0.25 to +0.25 for 0-200 rep
    const accuracyModifier = (factors.predictionAccuracy - 50) / 200; // -0.25 to +0.25 for 0-100 accuracy
    
    const weight = 1.0 + reputationModifier + accuracyModifier;
    
    // Clamp between 0.5 and 1.5
    return Math.max(0.5, Math.min(1.5, weight));
  }

  /**
   * Get reputation breakdown for user profile
   * 
   * @param userId - The user's ID
   * @returns ReputationBreakdown with factors and recent changes
   */
  async getReputationBreakdown(userId: string): Promise<ReputationBreakdown> {
    const score = await this.calculateReputation(userId);
    const factors = await this.getOrCreateReputationFactors(userId);
    
    // Get recent reputation changes
    const recentHistory = await db.query.reputationHistory.findMany({
      where: eq(reputationHistory.userId, userId),
      orderBy: [desc(reputationHistory.createdAt)],
      limit: 10,
    });
    
    return {
      overall: score.overall,
      factors: [
        {
          name: 'Impact Score',
          value: score.persuasionSkill,
          weight: WEIGHTS.impactScore,
          contribution: Math.round(score.persuasionSkill * WEIGHTS.impactScore * 10),
        },
        {
          name: 'Prediction Accuracy',
          value: score.predictionAccuracy,
          weight: WEIGHTS.predictionAccuracy,
          contribution: Math.round(score.predictionAccuracy * WEIGHTS.predictionAccuracy * 10),
        },
        {
          name: 'Participation Quality',
          value: factors.qualityScore,
          weight: WEIGHTS.participationQuality,
          contribution: Math.round(factors.qualityScore * WEIGHTS.participationQuality * 10),
        },
        {
          name: 'Consistency',
          value: score.consistency,
          weight: WEIGHTS.consistency,
          contribution: Math.round(score.consistency * WEIGHTS.consistency * 10),
        },
        {
          name: 'Community Trust',
          value: score.trustLevel,
          weight: WEIGHTS.communityTrust,
          contribution: Math.round(score.trustLevel * WEIGHTS.communityTrust * 10),
        },
      ],
      recentChanges: recentHistory.map(h => ({
        date: h.createdAt,
        change: h.changeAmount,
        reason: h.reason,
      })),
    };
  }

  /**
   * Update reputation based on argument impact score
   * Per Requirement 4.2: Increase reputation proportionally to impact score
   * 
   * @param userId - The user's ID
   * @param impactScore - The impact score of the argument
   * @param debateId - The debate ID for history tracking
   * @returns The reputation change amount
   */
  async updateReputationOnImpact(userId: string, impactScore: number, debateId: string): Promise<number> {
    // Check low-impact threshold (Requirement 4.7)
    if (impactScore < IMPACT_THRESHOLD) {
      return 0; // No change for low-impact arguments
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return 0;
    }

    // Get current factors
    const factors = await this.getOrCreateReputationFactors(userId);
    
    // Apply diminishing returns based on participation count (Requirement 4.4)
    const rawGain = impactScore * 0.5; // Base conversion rate
    const adjustedGain = calcDiminishing(rawGain, factors.participationCount);
    
    // Round to 2 decimal places
    const change = Math.round(adjustedGain * 100) / 100;
    
    if (change === 0) {
      return 0;
    }

    const previousScore = user.reputationScore;
    const newScore = previousScore + change;

    // Update user reputation
    await db.update(users)
      .set({ reputationScore: newScore })
      .where(eq(users.id, userId));

    // Update reputation factors
    await db.update(reputationFactors)
      .set({ 
        impactScoreTotal: factors.impactScoreTotal + impactScore,
        participationCount: factors.participationCount + 1,
        lastActiveAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reputationFactors.userId, userId));

    // Record in history
    await this.recordReputationChange(userId, previousScore, newScore, change, 'High impact argument', debateId);

    return change;
  }

  /**
   * Update prediction accuracy on debate conclusion
   * Per Requirement 4.3: Increase on correct predictions, decrease on incorrect
   * 
   * @param userId - The user's ID
   * @param wasCorrect - Whether the prediction was correct
   * @param debateId - The debate ID for history tracking
   */
  async updatePredictionAccuracy(userId: string, wasCorrect: boolean, debateId: string): Promise<void> {
    const factors = await this.getOrCreateReputationFactors(userId);
    const weight = 0.1; // How much new predictions affect overall accuracy
    
    let newAccuracy: number;
    if (wasCorrect) {
      // Move toward 100
      newAccuracy = factors.predictionAccuracy + (100 - factors.predictionAccuracy) * weight;
    } else {
      // Move toward 0
      newAccuracy = factors.predictionAccuracy - factors.predictionAccuracy * weight;
    }
    
    // Round to 2 decimal places
    newAccuracy = Math.round(newAccuracy * 100) / 100;
    
    await db.update(reputationFactors)
      .set({ 
        predictionAccuracy: newAccuracy,
        updatedAt: new Date(),
      })
      .where(eq(reputationFactors.userId, userId));

    // Also update the user's predictionAccuracy field for backward compatibility
    await db.update(users)
      .set({ predictionAccuracy: newAccuracy })
      .where(eq(users.id, userId));
  }

  /**
   * Apply reputation decay for inactive users
   * Per Requirement 4.6: Decay rate 1% per week after 30 days of inactivity
   * 
   * @param userId - The user's ID
   * @param daysSinceActive - Days since last activity
   * @returns The new reputation score after decay
   */
  async applyDecay(userId: string, daysSinceActive: number): Promise<number> {
    if (daysSinceActive <= DECAY_THRESHOLD) {
      // No decay within threshold
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      return user?.reputationScore ?? 100;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return 100;
    }

    // Calculate weeks of inactivity beyond threshold
    const weeksInactive = Math.floor((daysSinceActive - DECAY_THRESHOLD) / 7);
    
    // Apply compound decay: score * (1 - rate)^weeks
    const decayMultiplier = Math.pow(1 - DECAY_RATE, weeksInactive);
    const newScore = Math.round(user.reputationScore * decayMultiplier * 100) / 100;
    
    // Only update if there's actual decay
    if (newScore < user.reputationScore) {
      await db.update(users)
        .set({ reputationScore: newScore })
        .where(eq(users.id, userId));

      // Record in history
      const change = newScore - user.reputationScore;
      await this.recordReputationChange(userId, user.reputationScore, newScore, change, `Inactivity decay (${weeksInactive} weeks)`, null);
    }

    return newScore;
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

    // Update prediction accuracy for each voter
    for (const stance of postStances) {
      const userPrediction = this.getPredictionDirection(stance.supportValue);
      const actualOutcome = debateResult.winnerSide;

      // Skip neutral predictions and ties
      if (userPrediction !== 'neutral' && actualOutcome !== 'tie') {
        const wasCorrect = userPrediction === actualOutcome;
        await this.updatePredictionAccuracy(stance.voterId, wasCorrect, debateId);
      }
    }

    // Get all arguments in this debate and update reputation for high impact
    const debateArguments = await db.query.arguments_.findMany({
      where: sql`${arguments_.roundId} IN (
        SELECT id FROM rounds WHERE debate_id = ${debateId}
      )`,
    });

    for (const arg of debateArguments) {
      await this.updateReputationOnImpact(arg.debaterId, arg.impactScore, debateId);
    }
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Get or create reputation factors for a user
   */
  private async getOrCreateReputationFactors(userId: string): Promise<typeof reputationFactors.$inferSelect> {
    let factors = await db.query.reputationFactors.findFirst({
      where: eq(reputationFactors.userId, userId),
    });

    if (!factors) {
      // Create default factors
      const id = `rf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const [created] = await db.insert(reputationFactors)
        .values({
          id,
          userId,
          impactScoreTotal: 0,
          predictionAccuracy: 50,
          participationCount: 0,
          qualityScore: 50,
          lastActiveAt: null,
          updatedAt: new Date(),
        })
        .returning();
      factors = created;
    }

    return factors;
  }

  /**
   * Record a reputation change in history
   */
  private async recordReputationChange(
    userId: string,
    previousScore: number,
    newScore: number,
    changeAmount: number,
    reason: string,
    debateId: string | null
  ): Promise<void> {
    const id = `rh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.insert(reputationHistory).values({
      id,
      userId,
      previousScore,
      newScore,
      changeAmount,
      reason,
      debateId,
      createdAt: new Date(),
    });
  }

  /**
   * Normalize impact score to 0-100 scale
   */
  private normalizeImpactScore(totalImpact: number): number {
    // Use logarithmic scaling for impact scores
    // 0 impact = 0, 100 impact = 50, 1000 impact = 75, 10000 impact = 100
    if (totalImpact <= 0) return 0;
    const normalized = Math.log10(totalImpact + 1) * 25;
    return Math.min(100, Math.round(normalized * 100) / 100);
  }

  /**
   * Calculate consistency score based on participation and quality
   */
  private calculateConsistencyScore(participationCount: number, qualityScore: number): number {
    // Consistency rewards regular quality participation
    // More participation with good quality = higher consistency
    if (participationCount === 0) return 50; // Default
    
    const participationFactor = Math.min(1, participationCount / 50); // Max out at 50 debates
    const qualityFactor = qualityScore / 100;
    
    return Math.round((50 + participationFactor * qualityFactor * 50) * 100) / 100;
  }

  /**
   * Calculate trust level from other factors
   */
  private calculateTrustLevel(persuasion: number, accuracy: number, consistency: number): number {
    // Trust is a weighted average of other factors
    return Math.round((persuasion * 0.4 + accuracy * 0.4 + consistency * 0.2) * 100) / 100;
  }

  /**
   * Determine prediction direction from support value
   */
  private getPredictionDirection(supportValue: number): 'support' | 'oppose' | 'neutral' {
    if (supportValue > 50) return 'support';
    if (supportValue < 50) return 'oppose';
    return 'neutral';
  }
}

// Export singleton instance
export const reputationEngineV2 = new ReputationEngineV2();
