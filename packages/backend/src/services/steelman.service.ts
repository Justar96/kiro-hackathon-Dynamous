import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, steelmans, debates, arguments_, users, rounds } from '../db';
import type { 
  Steelman, 
  CreateSteelmanInput, 
  ReviewSteelmanInput,
  RoundNumber,
} from '@thesis/shared';

/**
 * SteelmanService handles the Steelman Gate feature.
 * 
 * Per original vision: Before rebuttal, debater must write a steelman
 * of opponent's argument. Opponent approves or rejects.
 * 
 * This makes debates feel "alien compared to Reddit" - forces good faith.
 */
export class SteelmanService {
  /**
   * Submit a steelman of opponent's argument.
   * Required before submitting rebuttal (round 2) or closing (round 3).
   */
  async submitSteelman(input: CreateSteelmanInput): Promise<Steelman> {
    // Validate debate exists
    const debate = await db.query.debates.findFirst({
      where: eq(debates.id, input.debateId),
    });
    if (!debate) throw new Error('Debate not found');

    // Validate target argument exists
    const targetArg = await db.query.arguments_.findFirst({
      where: eq(arguments_.id, input.targetArgumentId),
    });
    if (!targetArg) throw new Error('Target argument not found');

    // Author must be a debater in this debate
    const authorSide = debate.supportDebaterId === input.authorId ? 'support' 
      : debate.opposeDebaterId === input.authorId ? 'oppose' : null;
    if (!authorSide) throw new Error('Only debaters can submit steelmans');

    // Target argument must be from opponent
    if (targetArg.side === authorSide) {
      throw new Error('Must steelman opponent\'s argument, not your own');
    }

    // Check if steelman already exists for this round
    const existing = await db.query.steelmans.findFirst({
      where: and(
        eq(steelmans.debateId, input.debateId),
        eq(steelmans.authorId, input.authorId),
        eq(steelmans.roundNumber, input.roundNumber)
      ),
    });
    if (existing) throw new Error('Steelman already submitted for this round');

    // Content validation
    if (!input.content || input.content.trim().length < 50) {
      throw new Error('Steelman must be at least 50 characters');
    }
    if (input.content.length > 500) {
      throw new Error('Steelman cannot exceed 500 characters');
    }

    const [steelman] = await db.insert(steelmans).values({
      id: nanoid(),
      debateId: input.debateId,
      roundNumber: input.roundNumber,
      authorId: input.authorId,
      targetArgumentId: input.targetArgumentId,
      content: input.content.trim(),
      status: 'pending',
      rejectionReason: null,
      createdAt: new Date(),
      reviewedAt: null,
    }).returning();

    return this.mapToSteelman(steelman);
  }

  /**
   * Opponent reviews the steelman - approve or reject.
   */
  async reviewSteelman(input: ReviewSteelmanInput): Promise<Steelman> {
    const steelman = await db.query.steelmans.findFirst({
      where: eq(steelmans.id, input.steelmanId),
    });
    if (!steelman) throw new Error('Steelman not found');

    if (steelman.status !== 'pending') {
      throw new Error('Steelman already reviewed');
    }

    // Get debate to verify reviewer is the opponent
    const debate = await db.query.debates.findFirst({
      where: eq(debates.id, steelman.debateId),
    });
    if (!debate) throw new Error('Debate not found');

    // Reviewer must be the opponent (not the author)
    const authorSide = debate.supportDebaterId === steelman.authorId ? 'support' : 'oppose';
    const expectedReviewer = authorSide === 'support' ? debate.opposeDebaterId : debate.supportDebaterId;
    
    if (input.reviewerId !== expectedReviewer) {
      throw new Error('Only the opponent can review this steelman');
    }

    const [updated] = await db.update(steelmans)
      .set({
        status: input.approved ? 'approved' : 'rejected',
        rejectionReason: input.approved ? null : (input.rejectionReason || 'Not accurate'),
        reviewedAt: new Date(),
      })
      .where(eq(steelmans.id, input.steelmanId))
      .returning();

    return this.mapToSteelman(updated);
  }

  /**
   * Check if debater can submit argument for a round.
   * For rounds 2 and 3, requires approved steelman first.
   */
  async canSubmitArgument(debateId: string, debaterId: string, roundNumber: RoundNumber): Promise<{
    canSubmit: boolean;
    reason?: string;
    requiresSteelman: boolean;
    steelmanStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  }> {
    // Round 1 (opening) doesn't require steelman
    if (roundNumber === 1) {
      return { canSubmit: true, requiresSteelman: false };
    }

    // Rounds 2 and 3 require approved steelman
    const steelman = await db.query.steelmans.findFirst({
      where: and(
        eq(steelmans.debateId, debateId),
        eq(steelmans.authorId, debaterId),
        eq(steelmans.roundNumber, roundNumber)
      ),
    });

    if (!steelman) {
      return { 
        canSubmit: false, 
        reason: 'Submit a steelman of opponent\'s argument first',
        requiresSteelman: true,
        steelmanStatus: 'none',
      };
    }

    if (steelman.status === 'pending') {
      return { 
        canSubmit: false, 
        reason: 'Waiting for opponent to review your steelman',
        requiresSteelman: true,
        steelmanStatus: 'pending',
      };
    }

    if (steelman.status === 'rejected') {
      return { 
        canSubmit: false, 
        reason: `Steelman rejected: ${steelman.rejectionReason}. Please revise.`,
        requiresSteelman: true,
        steelmanStatus: 'rejected',
      };
    }

    return { canSubmit: true, requiresSteelman: true, steelmanStatus: 'approved' };
  }

  /**
   * Get steelman for a specific round and author.
   */
  async getSteelman(debateId: string, authorId: string, roundNumber: RoundNumber): Promise<Steelman | null> {
    const steelman = await db.query.steelmans.findFirst({
      where: and(
        eq(steelmans.debateId, debateId),
        eq(steelmans.authorId, authorId),
        eq(steelmans.roundNumber, roundNumber)
      ),
    });
    return steelman ? this.mapToSteelman(steelman) : null;
  }

  /**
   * Get pending steelmans that need review by a user.
   */
  async getPendingReviews(debateId: string, reviewerId: string): Promise<Steelman[]> {
    const debate = await db.query.debates.findFirst({
      where: eq(debates.id, debateId),
    });
    if (!debate) return [];

    // Find steelmans where reviewer is the opponent
    const reviewerSide = debate.supportDebaterId === reviewerId ? 'support' : 'oppose';
    const authorId = reviewerSide === 'support' ? debate.opposeDebaterId : debate.supportDebaterId;

    if (!authorId) return [];

    const pending = await db.query.steelmans.findMany({
      where: and(
        eq(steelmans.debateId, debateId),
        eq(steelmans.authorId, authorId),
        eq(steelmans.status, 'pending')
      ),
    });

    return pending.map(s => this.mapToSteelman(s));
  }

  /**
   * Delete a rejected steelman so author can resubmit.
   */
  async deleteSteelman(steelmanId: string, authorId: string): Promise<boolean> {
    const steelman = await db.query.steelmans.findFirst({
      where: eq(steelmans.id, steelmanId),
    });

    if (!steelman) return false;
    if (steelman.authorId !== authorId) throw new Error('Not authorized');
    if (steelman.status !== 'rejected') throw new Error('Can only delete rejected steelmans');

    await db.delete(steelmans).where(eq(steelmans.id, steelmanId));
    return true;
  }

  private mapToSteelman(row: typeof steelmans.$inferSelect): Steelman {
    return {
      id: row.id,
      debateId: row.debateId,
      roundNumber: row.roundNumber as RoundNumber,
      authorId: row.authorId,
      targetArgumentId: row.targetArgumentId,
      content: row.content,
      status: row.status,
      rejectionReason: row.rejectionReason,
      createdAt: row.createdAt,
      reviewedAt: row.reviewedAt,
    };
  }
}

export const steelmanService = new SteelmanService();
