import { eq, and, sql, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, stances, users, arguments_, marketDataPoints, stanceSpikes } from '../db';
import type { 
  MarketPrice, 
  MarketDataPoint,
  StanceSpike 
} from '@debate-platform/shared';
import { 
  SANDBOX_VOTE_WEIGHT, 
  FULL_VOTE_WEIGHT 
} from '@debate-platform/shared';

// Type for user data needed for vote weight calculation
type UserVoteData = {
  id: string;
  reputationScore: number;
  sandboxCompleted: boolean;
};

/**
 * MarketService handles market price calculation, impact attribution, and spike detection.
 * 
 * Per Requirements 4.1, 4.5, 5.1, 5.2, 7.4:
 * - Calculate weighted average of post-stances
 * - Weight by user reputation and sandbox status
 * - Attribute stance changes to lastArgumentSeen
 * - Calculate impactScore as sum of attributed deltas
 */
export class MarketService {
  /**
   * Calculate market price for a debate
   * Per Requirements 4.1, 4.5, 7.4:
   * - Calculate weighted average of post-stances
   * - Weight by user reputation and sandbox status
   * - supportPrice + opposePrice = 100
   * 
   * @param debateId - The debate ID
   * @returns MarketPrice with support/oppose percentages
   */
  async calculateMarketPrice(debateId: string): Promise<MarketPrice> {
    // Get all post-stances for this debate with user info
    const postStances = await db.query.stances.findMany({
      where: and(
        eq(stances.debateId, debateId),
        eq(stances.type, 'post')
      ),
    });

    if (postStances.length === 0) {
      // No votes yet, return 50/50
      return {
        supportPrice: 50,
        opposePrice: 50,
        totalVotes: 0,
        mindChangeCount: 0,
      };
    }

    // Get user data for all voters
    const voterIds = postStances.map((s: typeof stances.$inferSelect) => s.voterId);
    const voterUsers = await db.query.users.findMany({
      where: sql`${users.id} IN (${sql.join(voterIds.map((id: string) => sql`${id}`), sql`, `)})`,
    });

    // Create a map for quick lookup
    const userMap = new Map<string, UserVoteData>(
      voterUsers.map((u: typeof users.$inferSelect) => [u.id, {
        id: u.id,
        reputationScore: u.reputationScore,
        sandboxCompleted: u.sandboxCompleted,
      }])
    );

    // Calculate weighted average
    let totalWeight = 0;
    let weightedSum = 0;

    for (const stance of postStances) {
      const user = userMap.get(stance.voterId);
      const weight = this.calculateVoteWeight(user);
      
      totalWeight += weight;
      weightedSum += stance.supportValue * weight;
    }

    const supportPrice = totalWeight > 0 ? weightedSum / totalWeight : 50;

    // Count mind changes (users who changed stance)
    const mindChangeCount = await this.countMindChanges(debateId);

    return {
      supportPrice: Math.round(supportPrice * 100) / 100,
      opposePrice: Math.round((100 - supportPrice) * 100) / 100,
      totalVotes: postStances.length,
      mindChangeCount,
    };
  }

  /**
   * Calculate vote weight for a user based on reputation and sandbox status
   * Per Requirements 7.4, 10.1, 10.2, 10.3:
   * - Sandbox users: 0.5x base weight
   * - Full users: 1.0x base weight
   * - Weight is further scaled by reputation (normalized to 0.5-1.5 range)
   * 
   * @param user - The user object or undefined
   * @returns Vote weight
   */
  calculateVoteWeight(user: { reputationScore: number; sandboxCompleted: boolean } | undefined): number {
    if (!user) {
      return SANDBOX_VOTE_WEIGHT; // Default for unknown users
    }

    // Base weight from sandbox status
    const baseWeight = user.sandboxCompleted ? FULL_VOTE_WEIGHT : SANDBOX_VOTE_WEIGHT;

    // Reputation modifier: normalize reputation (100 is baseline)
    // Reputation 50 -> 0.75x, Reputation 100 -> 1.0x, Reputation 150 -> 1.25x
    const reputationModifier = 0.5 + (user.reputationScore / 200);
    
    // Clamp reputation modifier between 0.5 and 1.5
    const clampedModifier = Math.max(0.5, Math.min(1.5, reputationModifier));

    return baseWeight * clampedModifier;
  }

  /**
   * Count users who changed their stance (pre != post)
   * 
   * @param debateId - The debate ID
   * @returns Number of mind changes
   */
  async countMindChanges(debateId: string): Promise<number> {
    // Get all stances for this debate
    const allStances = await db.query.stances.findMany({
      where: eq(stances.debateId, debateId),
    });

    // Group by voter
    const stancesByVoter = new Map<string, { pre?: number; post?: number }>();
    
    for (const stance of allStances) {
      const existing = stancesByVoter.get(stance.voterId) || {};
      if (stance.type === 'pre') {
        existing.pre = stance.supportValue;
      } else {
        existing.post = stance.supportValue;
      }
      stancesByVoter.set(stance.voterId, existing);
    }

    // Count voters where pre != post
    let mindChangeCount = 0;
    for (const [, stanceData] of stancesByVoter) {
      if (stanceData.pre !== undefined && stanceData.post !== undefined) {
        if (stanceData.pre !== stanceData.post) {
          mindChangeCount++;
        }
      }
    }

    return mindChangeCount;
  }

  /**
   * Calculate impact score for an argument
   * Per Requirements 5.1, 5.2:
   * - Attribute stance changes to lastArgumentSeen
   * - impactScore = sum of all attributed deltas
   * 
   * @param argumentId - The argument ID
   * @returns Impact score (sum of attributed deltas)
   */
  async calculateImpactScore(argumentId: string): Promise<number> {
    // Get all post-stances that reference this argument
    const postStancesWithArg = await db.query.stances.findMany({
      where: and(
        eq(stances.type, 'post'),
        eq(stances.lastArgumentSeen, argumentId)
      ),
    });

    if (postStancesWithArg.length === 0) {
      return 0;
    }

    let totalImpact = 0;

    for (const postStance of postStancesWithArg) {
      // Get the corresponding pre-stance
      const preStance = await db.query.stances.findFirst({
        where: and(
          eq(stances.debateId, postStance.debateId),
          eq(stances.voterId, postStance.voterId),
          eq(stances.type, 'pre')
        ),
      });

      if (preStance) {
        // Calculate delta (absolute value for impact)
        const delta = Math.abs(postStance.supportValue - preStance.supportValue);
        totalImpact += delta;
      }
    }

    return totalImpact;
  }

  /**
   * Update impact score for an argument in the database
   * 
   * @param argumentId - The argument ID
   * @returns Updated impact score
   */
  async updateArgumentImpactScore(argumentId: string): Promise<number> {
    const impactScore = await this.calculateImpactScore(argumentId);

    await db.update(arguments_)
      .set({ impactScore })
      .where(eq(arguments_.id, argumentId));

    return impactScore;
  }

  /**
   * Attribute impact to all arguments that have been referenced
   * Should be called after a post-stance is recorded
   * 
   * @param debateId - The debate ID
   */
  async updateAllImpactScores(debateId: string): Promise<void> {
    // Get all unique argument IDs referenced in post-stances
    const postStances = await db.query.stances.findMany({
      where: and(
        eq(stances.debateId, debateId),
        eq(stances.type, 'post')
      ),
    });

    const argumentIds = new Set<string>();
    for (const stance of postStances) {
      if (stance.lastArgumentSeen) {
        argumentIds.add(stance.lastArgumentSeen);
      }
    }

    // Update each argument's impact score
    for (const argId of argumentIds) {
      await this.updateArgumentImpactScore(argId);
    }
  }

  /**
   * Detect and record significant stance shifts (spikes)
   * Per Requirement 4.3:
   * - Detect large deltas and create spike records
   * - Generate labels for spikes
   * 
   * @param debateId - The debate ID
   * @param argumentId - The argument that may have caused the spike
   * @param delta - The stance change delta
   * @param threshold - Minimum delta to be considered a spike (default: 15)
   * @returns Created spike or null if delta below threshold
   */
  async detectAndRecordSpike(
    debateId: string,
    argumentId: string,
    delta: number,
    threshold: number = 15
  ): Promise<StanceSpike | null> {
    const absDelta = Math.abs(delta);
    
    if (absDelta < threshold) {
      return null;
    }

    // Get argument content for label generation
    const argument = await db.query.arguments_.findFirst({
      where: eq(arguments_.id, argumentId),
    });

    if (!argument) {
      return null;
    }

    const direction: 'support' | 'oppose' = delta > 0 ? 'support' : 'oppose';
    const label = this.generateSpikeLabel(argument.content, absDelta, direction);

    const [spike] = await db.insert(stanceSpikes).values({
      id: nanoid(),
      debateId,
      argumentId,
      timestamp: new Date(),
      deltaAmount: absDelta,
      direction,
      label,
    }).returning();

    return {
      timestamp: spike.timestamp,
      argumentId: spike.argumentId,
      deltaAmount: spike.deltaAmount,
      direction: spike.direction as 'support' | 'oppose',
      label: spike.label,
    };
  }

  /**
   * Generate a human-readable label for a spike
   * 
   * @param content - The argument content
   * @param delta - The delta amount
   * @param direction - The direction of the shift
   * @returns Generated label
   */
  generateSpikeLabel(content: string, delta: number, direction: 'support' | 'oppose'): string {
    // Extract first meaningful phrase from content (up to 50 chars)
    const preview = content.substring(0, 50).trim();
    const truncated = preview.length < content.length ? `${preview}...` : preview;
    
    const directionText = direction === 'support' ? 'toward support' : 'toward oppose';
    
    return `+${delta} ${directionText}: "${truncated}"`;
  }

  /**
   * Get market history for a debate
   * 
   * @param debateId - The debate ID
   * @returns Array of market data points
   */
  async getMarketHistory(debateId: string): Promise<MarketDataPoint[]> {
    const dataPoints = await db.query.marketDataPoints.findMany({
      where: eq(marketDataPoints.debateId, debateId),
      orderBy: [asc(marketDataPoints.timestamp)],
    });

    return dataPoints.map((dp: typeof marketDataPoints.$inferSelect) => ({
      timestamp: dp.timestamp,
      supportPrice: dp.supportPrice,
      voteCount: dp.voteCount,
    }));
  }

  /**
   * Record a market data point
   * 
   * @param debateId - The debate ID
   * @param supportPrice - Current support price
   * @param voteCount - Current vote count
   */
  async recordMarketDataPoint(
    debateId: string,
    supportPrice: number,
    voteCount: number
  ): Promise<void> {
    await db.insert(marketDataPoints).values({
      id: nanoid(),
      debateId,
      timestamp: new Date(),
      supportPrice,
      voteCount,
    });
  }

  /**
   * Get all spikes for a debate
   * 
   * @param debateId - The debate ID
   * @returns Array of stance spikes
   */
  async getSpikes(debateId: string): Promise<StanceSpike[]> {
    const spikes = await db.query.stanceSpikes.findMany({
      where: eq(stanceSpikes.debateId, debateId),
      orderBy: [asc(stanceSpikes.timestamp)],
    });

    return spikes.map((s: typeof stanceSpikes.$inferSelect) => ({
      timestamp: s.timestamp,
      argumentId: s.argumentId,
      deltaAmount: s.deltaAmount,
      direction: s.direction as 'support' | 'oppose',
      label: s.label,
    }));
  }

  /**
   * Get top arguments by impact score (for leaderboard)
   * Returns arguments that changed the most minds
   */
  async getTopArguments(limit: number = 10): Promise<Array<{
    id: string;
    content: string;
    side: 'support' | 'oppose';
    impactScore: number;
    debateId: string;
    resolution: string;
    authorUsername: string;
  }>> {
    const { desc } = await import('drizzle-orm');
    const { debates, users, rounds } = await import('../db');

    const topArgs = await db.query.arguments_.findMany({
      orderBy: [desc(arguments_.impactScore)],
      limit,
    });

    const results = [];
    for (const arg of topArgs) {
      if (arg.impactScore <= 0) continue;

      const round = await db.query.rounds.findFirst({
        where: eq(rounds.id, arg.roundId),
      });
      if (!round) continue;

      const debate = await db.query.debates.findFirst({
        where: eq(debates.id, round.debateId),
      });
      if (!debate) continue;

      const author = await db.query.users.findFirst({
        where: eq(users.id, arg.debaterId),
      });

      results.push({
        id: arg.id,
        content: arg.content.substring(0, 200) + (arg.content.length > 200 ? '...' : ''),
        side: arg.side as 'support' | 'oppose',
        impactScore: arg.impactScore,
        debateId: round.debateId,
        resolution: debate.resolution,
        authorUsername: author?.username || 'Unknown',
      });
    }

    return results;
  }
}

// Export singleton instance
export const marketService = new MarketService();
