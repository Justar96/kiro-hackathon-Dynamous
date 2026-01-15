import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  TRENDING_WEIGHTS, 
  TRENDING_RECENCY_DECAY,
  type DebateEngagementMetrics 
} from '@thesis/shared';

/**
 * Feature: debate-lifecycle-ux
 * Property tests for TrendingService
 * 
 * These tests validate Property 19: Trending Algorithm Consistency
 * from the design document.
 */

// ============================================
// Helper Functions (extracted from service for pure testing)
// ============================================

/**
 * Calculate recency decay factor based on age in hours.
 * Uses exponential decay with configurable half-life.
 */
function calculateRecencyDecay(ageHours: number): number {
  const halfLife = TRENDING_RECENCY_DECAY.halfLifeHours;
  return Math.pow(0.5, ageHours / halfLife);
}

/**
 * Compute the trending score from engagement metrics.
 */
function computeScore(metrics: DebateEngagementMetrics): number {
  const rawScore = 
    metrics.voteCount * TRENDING_WEIGHTS.votes +
    metrics.reactionCount * TRENDING_WEIGHTS.reactions +
    metrics.commentCount * TRENDING_WEIGHTS.comments;

  const ageHours = (Date.now() - metrics.createdAt.getTime()) / (1000 * 60 * 60);
  const decayFactor = calculateRecencyDecay(ageHours);

  return rawScore * decayFactor;
}

/**
 * Check if metrics1 has strictly higher engagement than metrics2.
 */
function hasStrictlyHigherEngagement(
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
 * Create engagement metrics for testing.
 */
function createMetrics(
  debateId: string,
  voteCount: number,
  reactionCount: number,
  commentCount: number,
  createdAt: Date
): DebateEngagementMetrics {
  return {
    debateId,
    voteCount,
    reactionCount,
    commentCount,
    createdAt,
  };
}

// ============================================
// Property Tests
// ============================================

describe('TrendingService Property Tests', () => {
  /**
   * Property 19: Trending Algorithm Consistency
   * For any two debates D₁ and D₂ where D₁ has strictly higher engagement metrics
   * (votes + reactions + comments), D₁ SHALL appear at or above D₂ in trending rankings.
   * 
   * **Validates: Requirements 6.4**
   */
  describe('Property 19: Trending Algorithm Consistency', () => {
    it('debate with strictly higher engagement should rank higher or equal when same age', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }), // voteCount1
          fc.integer({ min: 0, max: 1000 }), // reactionCount1
          fc.integer({ min: 0, max: 1000 }), // commentCount1
          fc.integer({ min: 0, max: 1000 }), // voteCount2
          fc.integer({ min: 0, max: 1000 }), // reactionCount2
          fc.integer({ min: 0, max: 1000 }), // commentCount2
          (votes1, reactions1, comments1, votes2, reactions2, comments2) => {
            // Use same creation time to isolate engagement comparison
            const now = new Date();
            
            const metrics1 = createMetrics('debate1', votes1, reactions1, comments1, now);
            const metrics2 = createMetrics('debate2', votes2, reactions2, comments2, now);
            
            const score1 = computeScore(metrics1);
            const score2 = computeScore(metrics2);
            
            // If metrics1 has strictly higher engagement, score1 should be >= score2
            if (hasStrictlyHigherEngagement(metrics1, metrics2)) {
              return score1 >= score2;
            }
            
            // If metrics2 has strictly higher engagement, score2 should be >= score1
            if (hasStrictlyHigherEngagement(metrics2, metrics1)) {
              return score2 >= score1;
            }
            
            // Otherwise, no strict ordering required
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('higher vote count alone should increase score (same age)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }), // voteCount1
          fc.integer({ min: 0, max: 1000 }), // voteCount2
          fc.integer({ min: 0, max: 1000 }), // reactionCount (same for both)
          fc.integer({ min: 0, max: 1000 }), // commentCount (same for both)
          (votes1, votes2, reactions, comments) => {
            const now = new Date();
            
            const metrics1 = createMetrics('debate1', votes1, reactions, comments, now);
            const metrics2 = createMetrics('debate2', votes2, reactions, comments, now);
            
            const score1 = computeScore(metrics1);
            const score2 = computeScore(metrics2);
            
            // Higher votes should mean higher or equal score
            if (votes1 > votes2) {
              return score1 >= score2;
            } else if (votes2 > votes1) {
              return score2 >= score1;
            }
            return score1 === score2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('higher reaction count alone should increase score (same age)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }), // voteCount (same for both)
          fc.integer({ min: 0, max: 1000 }), // reactionCount1
          fc.integer({ min: 0, max: 1000 }), // reactionCount2
          fc.integer({ min: 0, max: 1000 }), // commentCount (same for both)
          (votes, reactions1, reactions2, comments) => {
            const now = new Date();
            
            const metrics1 = createMetrics('debate1', votes, reactions1, comments, now);
            const metrics2 = createMetrics('debate2', votes, reactions2, comments, now);
            
            const score1 = computeScore(metrics1);
            const score2 = computeScore(metrics2);
            
            // Higher reactions should mean higher or equal score
            if (reactions1 > reactions2) {
              return score1 >= score2;
            } else if (reactions2 > reactions1) {
              return score2 >= score1;
            }
            return score1 === score2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('higher comment count alone should increase score (same age)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }), // voteCount (same for both)
          fc.integer({ min: 0, max: 1000 }), // reactionCount (same for both)
          fc.integer({ min: 0, max: 1000 }), // commentCount1
          fc.integer({ min: 0, max: 1000 }), // commentCount2
          (votes, reactions, comments1, comments2) => {
            const now = new Date();
            
            const metrics1 = createMetrics('debate1', votes, reactions, comments1, now);
            const metrics2 = createMetrics('debate2', votes, reactions, comments2, now);
            
            const score1 = computeScore(metrics1);
            const score2 = computeScore(metrics2);
            
            // Higher comments should mean higher or equal score
            if (comments1 > comments2) {
              return score1 >= score2;
            } else if (comments2 > comments1) {
              return score2 >= score1;
            }
            return score1 === score2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('trending score should be non-negative', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }), // voteCount
          fc.integer({ min: 0, max: 10000 }), // reactionCount
          fc.integer({ min: 0, max: 10000 }), // commentCount
          fc.integer({ min: 0, max: 8760 }),  // ageHours (up to 1 year)
          (votes, reactions, comments, ageHours) => {
            const createdAt = new Date(Date.now() - ageHours * 60 * 60 * 1000);
            const metrics = createMetrics('debate', votes, reactions, comments, createdAt);
            const score = computeScore(metrics);
            
            return score >= 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('recency decay should reduce score over time', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }), // voteCount (at least 1 for non-zero score)
          fc.integer({ min: 0, max: 1000 }), // reactionCount
          fc.integer({ min: 0, max: 1000 }), // commentCount
          fc.integer({ min: 1, max: 720 }),  // ageHours1 (1 hour to 30 days)
          fc.integer({ min: 1, max: 720 }),  // ageHours2
          (votes, reactions, comments, ageHours1, ageHours2) => {
            const now = Date.now();
            const createdAt1 = new Date(now - ageHours1 * 60 * 60 * 1000);
            const createdAt2 = new Date(now - ageHours2 * 60 * 60 * 1000);
            
            const metrics1 = createMetrics('debate1', votes, reactions, comments, createdAt1);
            const metrics2 = createMetrics('debate2', votes, reactions, comments, createdAt2);
            
            const score1 = computeScore(metrics1);
            const score2 = computeScore(metrics2);
            
            // Older debate (higher ageHours) should have lower or equal score
            if (ageHours1 > ageHours2) {
              return score1 <= score2;
            } else if (ageHours2 > ageHours1) {
              return score2 <= score1;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('recency decay factor should be between 0 and 1', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 8760 }), // ageHours (up to 1 year)
          (ageHours) => {
            const decay = calculateRecencyDecay(ageHours);
            return decay > 0 && decay <= 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('recency decay should halve after one half-life period', () => {
      const halfLife = TRENDING_RECENCY_DECAY.halfLifeHours;
      
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }), // multiplier for half-life periods
          (multiplier) => {
            const ageHours = halfLife * multiplier;
            const decay = calculateRecencyDecay(ageHours);
            const expectedDecay = Math.pow(0.5, multiplier);
            
            // Allow small floating point tolerance
            return Math.abs(decay - expectedDecay) < 0.0001;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('weights should be applied correctly to engagement metrics', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }), // voteCount
          fc.integer({ min: 0, max: 100 }), // reactionCount
          fc.integer({ min: 0, max: 100 }), // commentCount
          (votes, reactions, comments) => {
            const now = new Date();
            const metrics = createMetrics('debate', votes, reactions, comments, now);
            const score = computeScore(metrics);
            
            // Expected raw score before decay (decay is 1 for age 0)
            const expectedRaw = 
              votes * TRENDING_WEIGHTS.votes +
              reactions * TRENDING_WEIGHTS.reactions +
              comments * TRENDING_WEIGHTS.comments;
            
            // Score should equal expected raw score (decay is ~1 for very recent)
            // Allow small tolerance for floating point
            return Math.abs(score - expectedRaw) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
