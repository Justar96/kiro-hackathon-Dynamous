import { eq, and, isNull, asc, sql } from 'drizzle-orm';
import { db, debates, users } from '../db';
import type { 
  Debate, 
  QueuedDebate, 
  MatchResult, 
  QueueFilter 
} from '@thesis/shared';

/**
 * MatchingService handles opponent matching and queue management.
 * Debates without opponents are automatically in the queue.
 * 
 * Per Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.5:
 * - Queue contains active debates without opponents
 * - Queue is ordered by creation time (FIFO)
 * - Supports filtering by keywords and reputation
 * - Auto-matching prioritizes reputation similarity
 */
export class MatchingService {
  /**
   * Get the opponent queue - debates seeking opponents
   * Per Requirements 4.1, 4.3, 4.5:
   * - Returns active debates without opponents
   * - Ordered by creation time (oldest first - FIFO)
   * - Supports filtering by keywords and reputation
   * 
   * @param filter - Optional filter criteria
   * @returns Array of queued debates with creator info
   */
  async getOpponentQueue(filter?: QueueFilter): Promise<QueuedDebate[]> {
    // Build base query: active debates without opponents
    let query = db
      .select({
        debate: debates,
        creatorUsername: users.username,
        creatorReputation: users.reputationScore,
      })
      .from(debates)
      .innerJoin(users, eq(debates.supportDebaterId, users.id))
      .where(
        and(
          eq(debates.status, 'active'),
          isNull(debates.opposeDebaterId)
        )
      )
      .orderBy(asc(debates.createdAt));

    const results = await query;

    // Apply filters in memory for flexibility
    let filtered = results;

    // Filter by keywords in resolution
    if (filter?.keywords && filter.keywords.length > 0) {
      const lowerKeywords = filter.keywords.map((keyword: string) => keyword.toLowerCase());
      filtered = filtered.filter(r => {
        const resolution = r.debate.resolution.toLowerCase();
        return lowerKeywords.some((keyword: string) => resolution.includes(keyword));
      });
    }

    // Filter by max reputation difference
    if (filter?.maxReputationDiff !== undefined && filter?.userId) {
      // Get the requesting user's reputation
      const requestingUser = await (db.query as any).users.findFirst({
        where: eq(users.id, filter.userId),
      });
      
      if (requestingUser) {
        const userRep = requestingUser.reputationScore;
        filtered = filtered.filter(r => 
          Math.abs(r.creatorReputation - userRep) <= filter.maxReputationDiff!
        );
      }
    }

    return filtered.map(r => ({
      debate: this.mapToDebate(r.debate),
      creatorUsername: r.creatorUsername,
      creatorReputation: r.creatorReputation,
      queuedAt: r.debate.createdAt,
    }));
  }

  /**
   * Find matches for a user - debates they can join as opponent
   * Per Requirements 5.1, 5.2, 5.3, 5.5:
   * - Excludes user's own debates
   * - Prioritizes reputation similarity (within 20 points first)
   * - Returns oldest first within priority groups (FIFO)
   * 
   * @param userId - The user looking for matches
   * @param limit - Maximum number of matches to return
   * @returns Array of match results with reputation diff
   */
  async findMatches(userId: string, limit: number = 10): Promise<MatchResult[]> {
    // Get the user's reputation
    const user = await (db.query as any).users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return [];
    }

    const userReputation = user.reputationScore;

    // Get all debates in queue, excluding user's own debates
    const results = await db
      .select({
        debate: debates,
        creatorUsername: users.username,
        creatorReputation: users.reputationScore,
      })
      .from(debates)
      .innerJoin(users, eq(debates.supportDebaterId, users.id))
      .where(
        and(
          eq(debates.status, 'active'),
          isNull(debates.opposeDebaterId),
          // Exclude user's own debates (Requirement 5.3)
          sql`${debates.supportDebaterId} != ${userId}`
        )
      )
      .orderBy(asc(debates.createdAt));

    // Calculate reputation difference and sort by priority
    const withRepDiff = results.map(r => ({
      debate: this.mapToDebate(r.debate),
      creatorUsername: r.creatorUsername,
      creatorReputation: r.creatorReputation,
      reputationDiff: Math.abs(r.creatorReputation - userReputation),
    }));

    // Sort by reputation priority (within 20 points first), then by creation time (FIFO)
    // Per Requirement 5.2: Prioritize debates with similar reputation levels (within 20 points)
    // Per Requirement 5.5: Return oldest first within priority groups
    const sorted = withRepDiff.sort((a, b) => {
      const aInRange = a.reputationDiff <= 20;
      const bInRange = b.reputationDiff <= 20;
      
      // Priority group: within 20 points comes first
      if (aInRange && !bInRange) return -1;
      if (!aInRange && bInRange) return 1;
      
      // Within same priority group, sort by creation time (oldest first - FIFO)
      return a.debate.createdAt.getTime() - b.debate.createdAt.getTime();
    });

    return sorted.slice(0, limit);
  }

  /**
   * Check if a debate is in the opponent queue
   * A debate is in queue if: active AND no opponent
   * 
   * @param debateId - The debate ID to check
   * @returns true if debate is in queue
   */
  async isInQueue(debateId: string): Promise<boolean> {
    const debate = await (db.query as any).debates.findFirst({
      where: eq(debates.id, debateId),
    });

    if (!debate) {
      return false;
    }

    // Queue membership invariant: active AND no opponent
    return debate.status === 'active' && debate.opposeDebaterId === null;
  }

  /**
   * Lifecycle hook: Called when a debate is created
   * Per Requirement 4.1: Add to queue if no opponent
   * 
   * Note: This is a no-op since queue membership is derived from debate state.
   * The debate is automatically "in queue" if it has no opponent and is active.
   * 
   * @param debate - The created debate
   */
  async onDebateCreated(debate: Debate): Promise<void> {
    // Queue membership is derived from debate state (active + no opponent)
    // No explicit action needed - the debate is automatically in queue
    // This hook exists for future extensibility (e.g., notifications, analytics)
  }

  /**
   * Lifecycle hook: Called when an opponent joins a debate
   * Per Requirement 4.2: Remove from queue
   * 
   * Note: This is a no-op since queue membership is derived from debate state.
   * The debate is automatically removed from queue when opponent is assigned.
   * 
   * @param debateId - The debate ID
   */
  async onOpponentJoined(debateId: string): Promise<void> {
    // Queue membership is derived from debate state
    // When opposeDebaterId is set, the debate is no longer in queue
    // This hook exists for future extensibility (e.g., notifications)
  }

  /**
   * Lifecycle hook: Called when a debate is concluded
   * Per Requirement 4.4: Remove from queue
   * 
   * Note: This is a no-op since queue membership is derived from debate state.
   * The debate is automatically removed from queue when status is 'concluded'.
   * 
   * @param debateId - The debate ID
   */
  async onDebateConcluded(debateId: string): Promise<void> {
    // Queue membership is derived from debate state
    // When status is 'concluded', the debate is no longer in queue
    // This hook exists for future extensibility (e.g., cleanup, analytics)
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
}

// Export singleton instance
export const matchingService = new MatchingService();
