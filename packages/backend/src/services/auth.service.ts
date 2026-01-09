import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, users, neonAuthUsers } from '../db';
import type { User, NeonAuthUser } from '@debate-platform/shared';

/**
 * AuthService handles authentication and user synchronization
 * between Neon Auth (Stack Auth) and the platform's user table
 */
export class AuthService {
  /**
   * Get or create a platform user from a Neon Auth user
   * This links the neon_auth.user to our platform users table
   * 
   * @param authUserId - The UUID from neon_auth.user.id
   * @returns The platform user (existing or newly created)
   */
  async getOrCreatePlatformUser(authUserId: string): Promise<User> {
    // First, check if a platform user already exists with this authUserId
    const existingUser = await db.query.users.findFirst({
      where: eq(users.authUserId, authUserId),
    });

    if (existingUser) {
      return this.mapToUser(existingUser);
    }

    // Fetch the auth user data from neon_auth.user
    const authUser = await db.query.neonAuthUsers.findFirst({
      where: eq(neonAuthUsers.id, authUserId),
    });

    if (!authUser) {
      throw new Error(`Auth user not found: ${authUserId}`);
    }

    // Create a new platform user linked to the auth user
    const newUser = await this.createPlatformUser(authUser);
    return newUser;
  }

  /**
   * Create a new platform user from Neon Auth user data
   * Initializes with default reputation settings per Requirements 7.1
   */
  private async createPlatformUser(authUser: typeof neonAuthUsers.$inferSelect): Promise<User> {
    const userId = nanoid();
    const username = authUser.name || `user_${nanoid(8)}`;
    const email = authUser.email || `${userId}@placeholder.local`;

    const [inserted] = await db.insert(users).values({
      id: userId,
      authUserId: authUser.id,
      username,
      email,
      reputationScore: 100, // Default per Requirements 7.1
      predictionAccuracy: 50,
      debatesParticipated: 0,
      sandboxCompleted: false,
    }).returning();

    return this.mapToUser(inserted);
  }

  /**
   * Get a platform user by their ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    return user ? this.mapToUser(user) : null;
  }

  /**
   * Get a platform user by their auth user ID
   */
  async getUserByAuthId(authUserId: string): Promise<User | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.authUserId, authUserId),
    });

    return user ? this.mapToUser(user) : null;
  }

  /**
   * Sync user profile data from Neon Auth
   * Updates username and email if changed in auth provider
   */
  async syncUserProfile(authUserId: string): Promise<User | null> {
    const authUser = await db.query.neonAuthUsers.findFirst({
      where: eq(neonAuthUsers.id, authUserId),
    });

    if (!authUser) {
      return null;
    }

    const platformUser = await db.query.users.findFirst({
      where: eq(users.authUserId, authUserId),
    });

    if (!platformUser) {
      // User doesn't exist yet, create them
      return this.createPlatformUser(authUser);
    }

    // Update profile data if changed
    const updates: Partial<typeof users.$inferInsert> = {};
    
    if (authUser.name && authUser.name !== platformUser.username) {
      updates.username = authUser.name;
    }
    
    if (authUser.email && authUser.email !== platformUser.email) {
      updates.email = authUser.email;
    }

    if (Object.keys(updates).length > 0) {
      const [updated] = await db.update(users)
        .set(updates)
        .where(eq(users.id, platformUser.id))
        .returning();
      return this.mapToUser(updated);
    }

    return this.mapToUser(platformUser);
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
export const authService = new AuthService();
