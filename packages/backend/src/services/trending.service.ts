import { eq, desc, sql } from 'drizzle-orm';
import { db, debates, stances, reactions, comments, arguments_, rounds } from '../db';
import type { 
  TrendingScore, 
  DebateEngagementMetrics,
  Debate 
} from '@thesis/shared';
import { TRENDING_WEIGHTS, TRENDING_RECENCY_DECAY } from '@thesis/shared';

/**
 * TrendingService calculates trending scores for debates based on engagement metrics.
 * 
 * Per Requirement 6.4:
 * - Score = votes + reactions + comments (weighted)
 * - Add recency decay factor
 * - Debates with higher engagement appear higher in trending
 */
export class TrendingService {
  /**
   * Calculate the trending score for a single debate.
   * Score = (votes * voteWeight + reactions * reactionWeight + comments * commentWeight) * recencyDecay
   * 
   * Per Requirement 6.4: Trending algorithm considers votes, reactions, comments with recency decay
   * 
   * @param debateId - The debate ID
   * @returns TrendingScore with score and engagement metrics
   */
  async calculateTrendingScore(debateId: string): Promise<TrendingScore> {
    const metrics = await this.getEngagementMetrics(debateId);
    const score = this.computeScore(metrics);
    
    return {
      debateId,
      score,
      engagementMetrics: metrics,
    };
  }

  /**
   * Get engagement metrics for a debate.
   * Counts votes (stances), reactions on arguments, and comments.
   * 
   * @param debateId - The debate ID
   * @returns DebateEngagementMetrics
   */
  async getEngagementMetrics(debateId: string): Promise<DebateEngagementMetrics> {
    // Get debate creation date
    const debate = await db.query.debates.findFirst({
      where: eq(debates.id, debateId),
    });

    if (!debate) {
      return {
        debateId,
        voteCount: 0,
        reactionCount: 0,
        commentCount: 0,
        createdAt: new Date(),
      };
    }

    // Count stances (votes) for this debate
    const debateStances = await db.query.stances.findMany({
      where: eq(stances.debateId, debateId),
    });
    const voteCount = debateStances.length;

    // Count reactions on arguments in this debate
    // First get all argument IDs for this debate
    const debateRounds = await db.query.rounds.findMany({
      where: eq(rounds.debateId, debateId),
    });
    
    const argumentIds: string[] = [];
    for (const round of debateRounds) {
      if (round.supportArgumentId) argumentIds.push(round.supportArgumentId);
      if (round.opposeArgumentId) argumentIds.push(round.opposeArgumentId);
    }

    let reactionCount = 0;
    if (argumentIds.length > 0) {
      // Count reactions for all arguments in this debate
      for (const argId of argumentIds) {
        const argReactions = await db.query.reactions.findMany({
          where: eq(reactions.argumentId, argId),
        });
        reactionCount += argReactions.length;
      }
    }

    // Count comments for this debate
    const debateComments = await db.query.comments.findMany({
      where: eq(comments.debateId, debateId),
    });
    const commentCount = debateComments.length;

    return {
      debateId,
      voteCount,
      reactionCount,
      commentCount,
      createdAt: debate.createdAt,
    };
  }

  /**
   * Compute the trending score from engagement metrics.
   * Applies weights and recency decay.
   * 
   * Per Requirement 6.4:
   * - Score = votes + reactions + comments (weighted)
   * - Recency decay: score halves every 24 hours
   * 
   * @param metrics - The engagement metrics
   * @returns Computed trending score
   */
  computeScore(metrics: DebateEngagementMetrics): number {
    // Calculate raw engagement score with weights
    const rawScore = 
      metrics.voteCount * TRENDING_WEIGHTS.votes +
      metrics.reactionCount * TRENDING_WEIGHTS.reactions +
      metrics.commentCount * TRENDING_WEIGHTS.comments;

    // Apply recency decay
    const ageHours = (Date.now() - metrics.createdAt.getTime()) / (1000 * 60 * 60);
    const decayFactor = this.calculateRecencyDecay(ageHours);

    return rawScore * decayFactor;
  }

  /**
   * Calculate recency decay factor based on age in hours.
   * Uses exponential decay with configurable half-life.
   * 
   * Formula: decay = 0.5 ^ (ageHours / halfLifeHours)
   * 
   * @param ageHours - Age of the debate in hours
   * @returns Decay factor between 0 and 1
   */
  calculateRecencyDecay(ageHours: number): number {
    const halfLife = TRENDING_RECENCY_DECAY.halfLifeHours;
    // Exponential decay: 0.5^(age/halfLife)
    return Math.pow(0.5, ageHours / halfLife);
  }

  /**
   * Get trending debates sorted by trending score.
   * 
   * Per Requirement 6.4: Feature high-engagement debates in trending sections
   * 
   * @param limit - Maximum number of debates to return
   * @returns Array of TrendingScore sorted by score descending
   */
  async getTrendingDebates(limit: number = 10): Promise<TrendingScore[]> {
    // Get all active debates
    const allDebates = await db.query.debates.findMany({
      orderBy: [desc(debates.createdAt)],
      limit: 100, // Limit to recent debates for performance
    });

    // Calculate trending scores for all debates
    const scores: TrendingScore[] = [];
    for (const debate of allDebates) {
      const score = await this.calculateTrendingScore(debate.id);
      scores.push(score);
    }

    // Sort by score descending and return top N
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, limit);
  }

  /**
   * Compare two debates by their trending scores.
   * Returns true if debate1 should rank higher than debate2.
   * 
   * Per Property 19: Trending Algorithm Consistency
   * If D1 has strictly higher engagement metrics, D1 should rank at or above D2.
   * 
   * @param debateId1 - First debate ID
   * @param debateId2 - Second debate ID
   * @returns True if debate1 ranks higher or equal to debate2
   */
  async compareDebates(debateId1: string, debateId2: string): Promise<boolean> {
    const score1 = await this.calculateTrendingScore(debateId1);
    const score2 = await this.calculateTrendingScore(debateId2);
    return score1.score >= score2.score;
  }

  /**
   * Check if debate1 has strictly higher engagement than debate2.
   * Used for property testing.
   * 
   * @param metrics1 - First debate's metrics
   * @param metrics2 - Second debate's metrics
   * @returns True if metrics1 is strictly higher in all categories
   */
  hasStrictlyHigherEngagement(
    metrics1: DebateEngagementMetrics, 
    metrics2: DebateEngagementMetrics
  ): boolean {
    return (
      metrics1.voteCount > metrics2.voteCount &&
      metrics1.reactionCount > metrics2.reactionCount &&
      metrics1.commentCount > metrics2.commentCount
    );
  }

  /**
   * Check if debate1 has higher or equal engagement than debate2.
   * 
   * @param metrics1 - First debate's metrics
   * @param metrics2 - Second debate's metrics
   * @returns True if metrics1 is higher or equal in all categories
   */
  hasHigherOrEqualEngagement(
    metrics1: DebateEngagementMetrics, 
    metrics2: DebateEngagementMetrics
  ): boolean {
    return (
      metrics1.voteCount >= metrics2.voteCount &&
      metrics1.reactionCount >= metrics2.reactionCount &&
      metrics1.commentCount >= metrics2.commentCount
    );
  }
}

// Export singleton instance
export const trendingService = new TrendingService();
