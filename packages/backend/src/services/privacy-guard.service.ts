import { eq, and, sql } from 'drizzle-orm';
import { db, stances, debates, users } from '../db';
import type { 
  Stance, 
  AggregateStanceData,
} from '@thesis/shared';

/**
 * PrivacyGuard Service
 * 
 * Ensures stance data privacy and aggregate-only exposure.
 * Per Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6:
 * - Filters stance data to remove voter IDs from public responses
 * - Returns only aggregate statistics (counts, averages)
 * - Enforces self-access authorization for personal stance data
 * - Enforces blind voting (pre-stance required before market access)
 */
export class PrivacyGuard {
  /**
   * Check if a user can access their own stance data
   * Per Requirement 3.4: Users can only view their own voting history
   * 
   * @param ownerId - The owner of the stance data
   * @param requesterId - The user requesting access
   * @returns True if requester is the owner
   */
  canAccessOwnStance(ownerId: string, requesterId: string): boolean {
    return ownerId === requesterId;
  }

  /**
   * Filter stance data for public API responses
   * Per Requirements 3.1, 3.2, 3.3: Remove all voter IDs and individual data
   * 
   * @param stances - Array of stance records (with voter IDs)
   * @returns Aggregate data only, no individual voter information
   */
  filterForPublicResponse(stances: Stance[]): AggregateStanceData {
    // Group stances by voter to calculate per-voter deltas
    const byVoter = new Map<string, { pre?: number; post?: number }>();
    
    for (const stance of stances) {
      const existing = byVoter.get(stance.voterId) || {};
      if (stance.type === 'pre') {
        existing.pre = stance.supportValue;
      } else if (stance.type === 'post') {
        existing.post = stance.supportValue;
      }
      byVoter.set(stance.voterId, existing);
    }

    // Only count voters who have both pre and post stances
    const votersWithBoth = [...byVoter.values()].filter(
      v => v.pre !== undefined && v.post !== undefined
    );
    
    const totalVoters = votersWithBoth.length;

    if (totalVoters === 0) {
      return {
        totalVoters: 0,
        averagePreStance: 50,
        averagePostStance: 50,
        averageDelta: 0,
        mindChangedCount: 0,
      };
    }

    // Calculate averages
    const sumPre = votersWithBoth.reduce((sum, v) => sum + v.pre!, 0);
    const sumPost = votersWithBoth.reduce((sum, v) => sum + v.post!, 0);
    const averagePreStance = sumPre / totalVoters;
    const averagePostStance = sumPost / totalVoters;
    const averageDelta = averagePostStance - averagePreStance;

    // Count mind changes (delta >= 10 points)
    const mindChangedCount = votersWithBoth.filter(
      v => Math.abs(v.post! - v.pre!) >= 10
    ).length;

    return {
      totalVoters,
      averagePreStance: Math.round(averagePreStance * 10) / 10,
      averagePostStance: Math.round(averagePostStance * 10) / 10,
      averageDelta: Math.round(averageDelta * 10) / 10,
      mindChangedCount,
    };
  }

  /**
   * Get aggregate statistics for a debate
   * Per Requirements 3.1, 3.2, 3.3: Returns only counts and averages
   * 
   * @param debateId - The debate ID
   * @returns Aggregate stance data without individual voter information
   */
  async getAggregateStats(debateId: string): Promise<AggregateStanceData> {
    // Fetch all stances for the debate
    const allStances = await db.query.stances.findMany({
      where: eq(stances.debateId, debateId),
    });

    // Map to Stance type
    const mappedStances: Stance[] = allStances.map(s => ({
      id: s.id,
      debateId: s.debateId,
      voterId: s.voterId,
      type: s.type,
      supportValue: s.supportValue,
      confidence: s.confidence,
      lastArgumentSeen: s.lastArgumentSeen,
      createdAt: s.createdAt,
    }));

    // Use filterForPublicResponse to ensure privacy
    return this.filterForPublicResponse(mappedStances);
  }

  /**
   * Get a user's own stances for a debate (self-access only)
   * Per Requirement 3.4: Users can view their own voting history
   * 
   * @param debateId - The debate ID
   * @param ownerId - The owner of the stance data
   * @param requesterId - The user requesting access
   * @returns User's stances if authorized, null otherwise
   */
  async getOwnStances(
    debateId: string, 
    ownerId: string, 
    requesterId: string
  ): Promise<{ pre?: Stance; post?: Stance } | null> {
    // Check authorization
    if (!this.canAccessOwnStance(ownerId, requesterId)) {
      return null;
    }

    // Fetch user's stances
    const userStances = await db.query.stances.findMany({
      where: and(
        eq(stances.debateId, debateId),
        eq(stances.voterId, ownerId)
      ),
    });

    const result: { pre?: Stance; post?: Stance } = {};

    for (const stance of userStances) {
      const mapped: Stance = {
        id: stance.id,
        debateId: stance.debateId,
        voterId: stance.voterId,
        type: stance.type,
        supportValue: stance.supportValue,
        confidence: stance.confidence,
        lastArgumentSeen: stance.lastArgumentSeen,
        createdAt: stance.createdAt,
      };

      if (stance.type === 'pre') {
        result.pre = mapped;
      } else if (stance.type === 'post') {
        result.post = mapped;
      }
    }

    return result;
  }

  /**
   * Check if user has recorded pre-stance for a debate
   * Per Requirement 3.6: Used for blind voting enforcement
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
   * Check if user can access market price (blind voting enforcement)
   * Per Requirement 3.6: Pre-stance required before market access
   * 
   * @param debateId - The debate ID
   * @param userId - The user ID
   * @returns Object with canAccess boolean and optional reason
   */
  async canAccessMarketPrice(
    debateId: string, 
    userId: string
  ): Promise<{ canAccess: boolean; reason?: string }> {
    const hasRecordedPreStance = await this.hasPreStance(debateId, userId);
    
    if (!hasRecordedPreStance) {
      return { 
        canAccess: false, 
        reason: 'Record your initial stance to see the market price' 
      };
    }
    
    return { canAccess: true };
  }

  /**
   * Enforce blind voting - throws if pre-stance not recorded
   * Per Requirement 3.6: Prevent market price access before pre-stance
   * 
   * @param debateId - The debate ID
   * @param userId - The user ID
   * @throws Error if pre-stance not recorded
   */
  async enforceBlindVoting(debateId: string, userId: string): Promise<void> {
    const result = await this.canAccessMarketPrice(debateId, userId);
    
    if (!result.canAccess) {
      throw new Error(result.reason || 'Pre-stance required');
    }
  }

  /**
   * Validate that a query doesn't expose individual votes
   * Per Requirement 3.5: Stance data cannot be queried by user ID through public API
   * 
   * @param query - The query parameters to validate
   * @returns Validation result
   */
  validatePrivacyCompliance(query: {
    includesVoterId?: boolean;
    isAggregateOnly?: boolean;
    isSelfAccess?: boolean;
    requesterId?: string;
    targetUserId?: string;
  }): { valid: boolean; reason?: string } {
    // Aggregate-only queries are always valid (no individual data exposed)
    if (query.isAggregateOnly) {
      return { valid: true };
    }

    // If query includes voter ID and is not self-access, reject
    if (query.includesVoterId && !query.isSelfAccess) {
      return {
        valid: false,
        reason: 'Cannot query stance data by voter ID through public API',
      };
    }

    // If self-access, verify requester matches target
    if (query.isSelfAccess && query.requesterId !== query.targetUserId) {
      return {
        valid: false,
        reason: 'Can only access your own stance data',
      };
    }

    return { valid: true };
  }

  /**
   * Get a user's complete voting history across all debates (self-access only)
   * Per Requirement 3.4: Users can view their own voting history privately
   * 
   * @param ownerId - The owner of the stance data
   * @param requesterId - The user requesting access
   * @returns Array of voting records with debate info if authorized, null otherwise
   */
  async getVotingHistory(
    ownerId: string, 
    requesterId: string
  ): Promise<VotingHistoryEntry[] | null> {
    // Check authorization - only owner can access their voting history
    if (!this.canAccessOwnStance(ownerId, requesterId)) {
      return null;
    }

    // Fetch all stances for this user with debate info
    const userStances = await db.query.stances.findMany({
      where: eq(stances.voterId, ownerId),
      with: {
        debate: true,
      },
      orderBy: (stances, { desc }) => [desc(stances.createdAt)],
    }) as Array<typeof stances.$inferSelect & { debate?: typeof debates.$inferSelect | null }>;


    // Group stances by debate
    type DebateStanceSummary = {
      debateId: string;
      resolution: string;
      debateStatus: string;
      pre?: { supportValue: number; createdAt: Date };
      post?: { supportValue: number; createdAt: Date };
    };

    const byDebate = new Map<string, DebateStanceSummary>();

    for (const stance of userStances) {
      const existing: DebateStanceSummary = byDebate.get(stance.debateId) ?? {
        debateId: stance.debateId,
        resolution: stance.debate?.resolution ?? 'Unknown',
        debateStatus: stance.debate?.status ?? 'unknown',
      };


      if (stance.type === 'pre') {
        existing.pre = {
          supportValue: stance.supportValue,
          createdAt: stance.createdAt,
        };
      } else if (stance.type === 'post') {
        existing.post = {
          supportValue: stance.supportValue,
          createdAt: stance.createdAt,
        };
      }

      byDebate.set(stance.debateId, existing);
    }

    // Convert to array and calculate deltas
    const history: VotingHistoryEntry[] = [];
    
    for (const entry of byDebate.values()) {
      const delta = entry.pre && entry.post 
        ? entry.post.supportValue - entry.pre.supportValue 
        : null;
      
      history.push({
        debateId: entry.debateId,
        resolution: entry.resolution,
        debateStatus: entry.debateStatus as 'active' | 'concluded',
        preStance: entry.pre?.supportValue ?? null,
        postStance: entry.post?.supportValue ?? null,
        delta,
        votedAt: entry.post?.createdAt || entry.pre?.createdAt || new Date(),
      });
    }

    // Sort by most recent vote
    history.sort((a, b) => b.votedAt.getTime() - a.votedAt.getTime());

    return history;
  }
}

/**
 * Voting history entry for a single debate
 * Per Requirement 3.4: Private voting history for user profile
 */
export interface VotingHistoryEntry {
  debateId: string;
  resolution: string;
  debateStatus: 'active' | 'concluded';
  preStance: number | null;
  postStance: number | null;
  delta: number | null;
  votedAt: Date;
}

// Export singleton instance
export const privacyGuard = new PrivacyGuard();
