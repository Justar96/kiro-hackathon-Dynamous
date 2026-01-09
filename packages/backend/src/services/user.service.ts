import { eq, or } from 'drizzle-orm';
import { db, users } from '../db';
import type { User } from '@debate-platform/shared';
import { 
  SANDBOX_DEBATES_REQUIRED, 
  SANDBOX_VOTE_WEIGHT, 
  FULL_VOTE_WEIGHT 
} from '@debate-platform/shared';

/**
 * UserService handles user-related operations including
 * sandbox tracking and vote weight calculations
 */
export class UserService {
  /**
   * Increment the debates participated count for a user
   * Automatically completes sandbox mode after 5 debates
   * 
   * @param userId - The user's ID
   * @returns Updated user or null if not found
   */
  async incrementDebatesParticipated(userId: string): Promise<User | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return null;
    }

    const newCount = user.debatesParticipated + 1;
    const sandboxCompleted = newCount >= SANDBOX_DEBATES_REQUIRED;

    const [updated] = await db.update(users)
      .set({
        debatesParticipated: newCount,
        sandboxCompleted: sandboxCompleted || user.sandboxCompleted,
      })
      .where(eq(users.id, userId))
      .returning();

    return this.mapToUser(updated);
  }

  /**
   * Get the vote weight for a user based on sandbox status
   * Per Requirements 10.1, 10.2, 10.3:
   * - Sandbox users (< 5 debates): 0.5x weight
   * - Full users (>= 5 debates): 1.0x weight
   * 
   * @param userId - The user's ID
   * @returns Vote weight (0.5 or 1.0)
   */
  async getVoteWeight(userId: string): Promise<number> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return SANDBOX_VOTE_WEIGHT; // Default to sandbox weight for unknown users
    }

    return user.sandboxCompleted ? FULL_VOTE_WEIGHT : SANDBOX_VOTE_WEIGHT;
  }

  /**
   * Check if a user is still in sandbox mode
   * 
   * @param userId - The user's ID
   * @returns true if user is in sandbox mode
   */
  async isSandboxUser(userId: string): Promise<boolean> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return true; // Unknown users are treated as sandbox
    }

    return !user.sandboxCompleted;
  }

  /**
   * Get user by ID (supports both platform user ID and auth user ID)
   */
  async getUserById(userId: string): Promise<User | null> {
    // First try to find by platform user ID
    let user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    // If not found, try to find by auth user ID
    if (!user) {
      user = await db.query.users.findFirst({
        where: eq(users.authUserId, userId),
      });
    }

    return user ? this.mapToUser(user) : null;
  }

  /**
   * Get user statistics (supports both platform user ID and auth user ID)
   */
  async getUserStats(userId: string): Promise<{
    reputationScore: number;
    predictionAccuracy: number;
    debatesParticipated: number;
    sandboxCompleted: boolean;
    voteWeight: number;
  } | null> {
    // First try to find by platform user ID
    let user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    // If not found, try to find by auth user ID
    if (!user) {
      user = await db.query.users.findFirst({
        where: eq(users.authUserId, userId),
      });
    }

    if (!user) {
      return null;
    }

    return {
      reputationScore: user.reputationScore,
      predictionAccuracy: user.predictionAccuracy,
      debatesParticipated: user.debatesParticipated,
      sandboxCompleted: user.sandboxCompleted,
      voteWeight: user.sandboxCompleted ? FULL_VOTE_WEIGHT : SANDBOX_VOTE_WEIGHT,
    };
  }

  /**
   * Map database row to User type
   */
  private mapToUser(row: typeof users.$inferSelect): User {
    return {
      id: row.id,
      authUserId: row.authUserId,
      username: row.username,
      email: row.email,
      reputationScore: row.reputationScore,
      predictionAccuracy: row.predictionAccuracy,
      debatesParticipated: row.debatesParticipated,
      sandboxCompleted: row.sandboxCompleted,
      createdAt: row.createdAt,
    };
  }
}

// Export singleton instance
export const userService = new UserService();
