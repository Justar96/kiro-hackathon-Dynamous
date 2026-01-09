import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, reactions, arguments_, users } from '../db';
import type { 
  Reaction, 
  CreateReactionInput,
  ReactionCounts 
} from '@debate-platform/shared';

/**
 * ReactionService handles the dual reaction system for arguments.
 * 
 * Per Requirements 6.1, 6.2, 6.4:
 * - Provides two distinct reactions: 'agree' and 'strong_reasoning'
 * - Stores both reaction types independently
 * - Allows users to give either reaction without the other
 */
export class ReactionService {
  /**
   * Add a reaction to an argument
   * Per Requirements 6.1, 6.2, 6.4: Support independent 'agree' and 'strong_reasoning' reactions
   * 
   * @param input - The reaction input
   * @returns Created reaction
   * @throws Error if argument not found, user not found, or duplicate reaction
   */
  async addReaction(input: CreateReactionInput): Promise<Reaction> {
    // Verify argument exists
    const argument = await db.query.arguments_.findFirst({
      where: eq(arguments_.id, input.argumentId),
    });

    if (!argument) {
      throw new Error('Argument not found');
    }

    // Verify voter exists
    const voter = await db.query.users.findFirst({
      where: eq(users.id, input.voterId),
    });

    if (!voter) {
      throw new Error('User not found');
    }

    // Check if this specific reaction type already exists for this user/argument
    const existingReaction = await db.query.reactions.findFirst({
      where: and(
        eq(reactions.argumentId, input.argumentId),
        eq(reactions.voterId, input.voterId),
        eq(reactions.type, input.type)
      ),
    });

    if (existingReaction) {
      throw new Error('You have already reacted to this argument');
    }

    // Create the reaction
    const [reaction] = await db.insert(reactions).values({
      id: nanoid(),
      argumentId: input.argumentId,
      voterId: input.voterId,
      type: input.type,
      createdAt: new Date(),
    }).returning();

    return this.mapToReaction(reaction);
  }

  /**
   * Remove a reaction from an argument
   * 
   * @param argumentId - The argument ID
   * @param voterId - The voter ID
   * @param type - The reaction type to remove
   * @returns True if removed, false if not found
   */
  async removeReaction(
    argumentId: string, 
    voterId: string, 
    type: 'agree' | 'strong_reasoning'
  ): Promise<boolean> {
    const result = await db.delete(reactions)
      .where(and(
        eq(reactions.argumentId, argumentId),
        eq(reactions.voterId, voterId),
        eq(reactions.type, type)
      ))
      .returning();

    return result.length > 0;
  }

  /**
   * Get reaction counts for an argument
   * Per Requirement 6.3: Show counts for both reaction types separately
   * 
   * @param argumentId - The argument ID
   * @returns Counts for agree and strong_reasoning reactions
   */
  async getReactionCounts(argumentId: string): Promise<ReactionCounts> {
    const argumentReactions = await db.query.reactions.findMany({
      where: eq(reactions.argumentId, argumentId),
    });

    let agree = 0;
    let strongReasoning = 0;

    for (const reaction of argumentReactions) {
      if (reaction.type === 'agree') {
        agree++;
      } else if (reaction.type === 'strong_reasoning') {
        strongReasoning++;
      }
    }

    return { agree, strongReasoning };
  }

  /**
   * Get user's reactions for an argument
   * 
   * @param argumentId - The argument ID
   * @param voterId - The voter ID
   * @returns Object indicating which reactions the user has given
   */
  async getUserReactions(
    argumentId: string, 
    voterId: string
  ): Promise<{ agree: boolean; strongReasoning: boolean }> {
    const userReactions = await db.query.reactions.findMany({
      where: and(
        eq(reactions.argumentId, argumentId),
        eq(reactions.voterId, voterId)
      ),
    });

    return {
      agree: userReactions.some((r: typeof reactions.$inferSelect) => r.type === 'agree'),
      strongReasoning: userReactions.some((r: typeof reactions.$inferSelect) => r.type === 'strong_reasoning'),
    };
  }

  /**
   * Check if user has a specific reaction on an argument
   * 
   * @param argumentId - The argument ID
   * @param voterId - The voter ID
   * @param type - The reaction type to check
   * @returns True if reaction exists
   */
  async hasReaction(
    argumentId: string, 
    voterId: string, 
    type: 'agree' | 'strong_reasoning'
  ): Promise<boolean> {
    const reaction = await db.query.reactions.findFirst({
      where: and(
        eq(reactions.argumentId, argumentId),
        eq(reactions.voterId, voterId),
        eq(reactions.type, type)
      ),
    });

    return reaction !== undefined;
  }

  /**
   * Get all reactions for an argument
   * 
   * @param argumentId - The argument ID
   * @returns Array of reactions
   */
  async getArgumentReactions(argumentId: string): Promise<Reaction[]> {
    const argumentReactions = await db.query.reactions.findMany({
      where: eq(reactions.argumentId, argumentId),
    });

    return argumentReactions.map((r: typeof reactions.$inferSelect) => this.mapToReaction(r));
  }

  /**
   * Map database row to Reaction type
   */
  private mapToReaction(row: typeof reactions.$inferSelect): Reaction {
    return {
      id: row.id,
      argumentId: row.argumentId,
      voterId: row.voterId,
      type: row.type,
      createdAt: row.createdAt,
    };
  }
}

// Export singleton instance
export const reactionService = new ReactionService();
