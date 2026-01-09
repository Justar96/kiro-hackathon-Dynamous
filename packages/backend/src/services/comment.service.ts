import { eq, and, gte, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, comments, debates, users } from '../db';
import type { 
  Comment, 
  CreateCommentInput 
} from '@debate-platform/shared';
import { COMMENT_RATE_LIMIT, COMMENT_RATE_WINDOW_MINUTES } from '@debate-platform/shared';

/**
 * CommentService handles spectator comments with threading support.
 * 
 * Per Requirements 8.1, 8.2, 8.3:
 * - Provides a separate spectator comment section
 * - Displays comments in the spectator area, not debate rounds
 * - Supports threaded replies
 * 
 * Per Requirement 10.4:
 * - Implements rate limiting (max 3 comments per 10 minutes per user per debate)
 */
export class CommentService {
  /**
   * Add a comment to a debate
   * Per Requirements 8.1, 8.2, 8.3: Support threaded comments in spectator area
   * Per Requirement 10.4: Enforce rate limiting
   * 
   * @param input - The comment input
   * @returns Created comment
   * @throws Error if debate not found, user not found, parent comment invalid, or rate limit exceeded
   */
  async addComment(input: CreateCommentInput): Promise<Comment> {
    // Verify debate exists
    const debate = await db.query.debates.findFirst({
      where: eq(debates.id, input.debateId),
    });

    if (!debate) {
      throw new Error('Debate not found');
    }

    // Verify user exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, input.userId),
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Validate parent comment if provided (Property 16: Comment Threading)
    if (input.parentId) {
      const parentComment = await db.query.comments.findFirst({
        where: eq(comments.id, input.parentId),
      });

      if (!parentComment) {
        throw new Error('Parent comment not found');
      }

      // Parent comment must belong to the same debate
      if (parentComment.debateId !== input.debateId) {
        throw new Error('Parent comment must belong to the same debate');
      }
    }

    // Check rate limiting (Property 15: Comment Rate Limiting)
    const isRateLimited = await this.isRateLimited(input.userId, input.debateId);
    if (isRateLimited) {
      throw new Error(`Maximum ${COMMENT_RATE_LIMIT} comments per ${COMMENT_RATE_WINDOW_MINUTES} minutes`);
    }

    // Create the comment
    const [comment] = await db.insert(comments).values({
      id: nanoid(),
      debateId: input.debateId,
      userId: input.userId,
      parentId: input.parentId ?? null,
      content: input.content,
      createdAt: new Date(),
    }).returning();

    return this.mapToComment(comment);
  }

  /**
   * Check if a user is rate limited for commenting on a debate
   * Per Requirement 10.4: Max 3 comments per 10 minutes per user per debate
   * 
   * @param userId - The user ID
   * @param debateId - The debate ID
   * @returns True if rate limited
   */
  async isRateLimited(userId: string, debateId: string): Promise<boolean> {
    const windowStart = new Date(Date.now() - COMMENT_RATE_WINDOW_MINUTES * 60 * 1000);

    const recentComments = await db.query.comments.findMany({
      where: and(
        eq(comments.userId, userId),
        eq(comments.debateId, debateId),
        gte(comments.createdAt, windowStart)
      ),
    });

    return recentComments.length >= COMMENT_RATE_LIMIT;
  }

  /**
   * Get the count of comments in the rate limit window
   * 
   * @param userId - The user ID
   * @param debateId - The debate ID
   * @returns Number of comments in the window
   */
  async getCommentCountInWindow(userId: string, debateId: string): Promise<number> {
    const windowStart = new Date(Date.now() - COMMENT_RATE_WINDOW_MINUTES * 60 * 1000);

    const recentComments = await db.query.comments.findMany({
      where: and(
        eq(comments.userId, userId),
        eq(comments.debateId, debateId),
        gte(comments.createdAt, windowStart)
      ),
    });

    return recentComments.length;
  }

  /**
   * Get all comments for a debate
   * 
   * @param debateId - The debate ID
   * @returns Array of comments ordered by creation time
   */
  async getDebateComments(debateId: string): Promise<Comment[]> {
    const debateComments = await db.query.comments.findMany({
      where: eq(comments.debateId, debateId),
      orderBy: [desc(comments.createdAt)],
    });

    return debateComments.map((c: typeof comments.$inferSelect) => this.mapToComment(c));
  }

  /**
   * Get a comment by ID
   * 
   * @param commentId - The comment ID
   * @returns Comment or null if not found
   */
  async getComment(commentId: string): Promise<Comment | null> {
    const comment = await db.query.comments.findFirst({
      where: eq(comments.id, commentId),
    });

    return comment ? this.mapToComment(comment) : null;
  }

  /**
   * Get replies to a comment (direct children)
   * 
   * @param parentId - The parent comment ID
   * @returns Array of reply comments
   */
  async getReplies(parentId: string): Promise<Comment[]> {
    const replies = await db.query.comments.findMany({
      where: eq(comments.parentId, parentId),
      orderBy: [desc(comments.createdAt)],
    });

    return replies.map((c: typeof comments.$inferSelect) => this.mapToComment(c));
  }

  /**
   * Get top-level comments for a debate (no parent)
   * 
   * @param debateId - The debate ID
   * @returns Array of top-level comments
   */
  async getTopLevelComments(debateId: string): Promise<Comment[]> {
    const topLevel = await db.query.comments.findMany({
      where: and(
        eq(comments.debateId, debateId),
        eq(comments.parentId, null as unknown as string)
      ),
      orderBy: [desc(comments.createdAt)],
    });

    return topLevel.map((c: typeof comments.$inferSelect) => this.mapToComment(c));
  }

  /**
   * Delete a comment
   * 
   * @param commentId - The comment ID
   * @returns True if deleted, false if not found
   */
  async deleteComment(commentId: string): Promise<boolean> {
    const result = await db.delete(comments)
      .where(eq(comments.id, commentId))
      .returning();

    return result.length > 0;
  }

  /**
   * Map database row to Comment type
   */
  private mapToComment(row: typeof comments.$inferSelect): Comment {
    return {
      id: row.id,
      debateId: row.debateId,
      userId: row.userId,
      parentId: row.parentId,
      content: row.content,
      createdAt: row.createdAt,
    };
  }
}

// Export singleton instance
export const commentService = new CommentService();
