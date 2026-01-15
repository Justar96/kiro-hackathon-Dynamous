import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  SANDBOX_VOTE_WEIGHT, 
  FULL_VOTE_WEIGHT 
} from '@thesis/shared';

/**
 * Feature: debate-platform
 * Property Tests for Market Service
 * 
 * Properties covered:
 * - Property 9: Market Price Calculation
 * - Property 10: Impact Attribution
 * 
 * Validates: Requirements 4.5, 5.1, 5.2, 7.4
 */

// Type for user data needed for vote weight calculation
interface UserVoteData {
  id: string;
  reputationScore: number;
  sandboxCompleted: boolean;
}

// Type for post-stance data
interface PostStanceData {
  voterId: string;
  supportValue: number;
}

// Type for stance pair (pre and post)
interface StancePair {
  voterId: string;
  preValue: number;
  postValue: number;
  lastArgumentSeen: string | null;
}

/**
 * Pure function to calculate vote weight for a user
 * Extracted from MarketService for property testing
 */
function calculateVoteWeight(user: { reputationScore: number; sandboxCompleted: boolean } | undefined): number {
  if (!user) {
    return SANDBOX_VOTE_WEIGHT;
  }

  const baseWeight = user.sandboxCompleted ? FULL_VOTE_WEIGHT : SANDBOX_VOTE_WEIGHT;
  const reputationModifier = 0.5 + (user.reputationScore / 200);
  const clampedModifier = Math.max(0.5, Math.min(1.5, reputationModifier));

  return baseWeight * clampedModifier;
}

/**
 * Pure function to calculate market price from post-stances and user data
 * Extracted from MarketService for property testing
 */
function calculateMarketPrice(
  postStances: PostStanceData[],
  userMap: Map<string, UserVoteData>
): { supportPrice: number; opposePrice: number } {
  if (postStances.length === 0) {
    return { supportPrice: 50, opposePrice: 50 };
  }

  let totalWeight = 0;
  let weightedSum = 0;

  for (const stance of postStances) {
    const user = userMap.get(stance.voterId);
    const weight = calculateVoteWeight(user);
    
    totalWeight += weight;
    weightedSum += stance.supportValue * weight;
  }

  const supportPrice = totalWeight > 0 ? weightedSum / totalWeight : 50;

  return {
    supportPrice: Math.round(supportPrice * 100) / 100,
    opposePrice: Math.round((100 - supportPrice) * 100) / 100,
  };
}

/**
 * Pure function to calculate impact score for an argument
 * Extracted from MarketService for property testing
 */
function calculateImpactScore(
  argumentId: string,
  stancePairs: StancePair[]
): number {
  let totalImpact = 0;

  for (const pair of stancePairs) {
    if (pair.lastArgumentSeen === argumentId) {
      const delta = Math.abs(pair.postValue - pair.preValue);
      totalImpact += delta;
    }
  }

  return totalImpact;
}

// Arbitraries for generating test data
const userIdArbitrary = fc.string({ minLength: 10, maxLength: 21 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s));
const argumentIdArbitrary = fc.string({ minLength: 10, maxLength: 21 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

const userVoteDataArbitrary = fc.record({
  id: userIdArbitrary,
  reputationScore: fc.float({ min: 0, max: 200, noNaN: true }),
  sandboxCompleted: fc.boolean(),
});

const postStanceArbitrary = fc.record({
  voterId: userIdArbitrary,
  supportValue: fc.integer({ min: 0, max: 100 }),
});

const stancePairArbitrary = fc.record({
  voterId: userIdArbitrary,
  preValue: fc.integer({ min: 0, max: 100 }),
  postValue: fc.integer({ min: 0, max: 100 }),
  lastArgumentSeen: fc.option(argumentIdArbitrary, { nil: null }),
});

describe('MarketService Property Tests', () => {
  /**
   * Property 9: Market Price Calculation
   * For any debate with recorded post-stances:
   * - marketPrice.supportPrice = weighted average of all post-stance supportValues
   * - Weights are determined by user reputation and sandbox status
   * - supportPrice + opposePrice = 100
   * 
   * Validates: Requirements 4.5, 7.4
   */
  describe('Property 9: Market Price Calculation', () => {
    it('supportPrice + opposePrice should always equal 100', () => {
      fc.assert(
        fc.property(
          fc.array(postStanceArbitrary, { minLength: 0, maxLength: 20 }),
          fc.array(userVoteDataArbitrary, { minLength: 0, maxLength: 20 }),
          (postStances, users) => {
            // Create user map
            const userMap = new Map<string, UserVoteData>(
              users.map(u => [u.id, u])
            );

            const result = calculateMarketPrice(postStances, userMap);

            // Property: supportPrice + opposePrice = 100
            expect(result.supportPrice + result.opposePrice).toBeCloseTo(100, 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('market price should be 50/50 when no post-stances exist', () => {
      fc.assert(
        fc.property(
          fc.array(userVoteDataArbitrary, { minLength: 0, maxLength: 10 }),
          (users) => {
            const userMap = new Map<string, UserVoteData>(
              users.map(u => [u.id, u])
            );

            const result = calculateMarketPrice([], userMap);

            expect(result.supportPrice).toBe(50);
            expect(result.opposePrice).toBe(50);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('supportPrice should be in range [0, 100]', () => {
      fc.assert(
        fc.property(
          fc.array(postStanceArbitrary, { minLength: 1, maxLength: 20 }),
          fc.array(userVoteDataArbitrary, { minLength: 0, maxLength: 20 }),
          (postStances, users) => {
            const userMap = new Map<string, UserVoteData>(
              users.map(u => [u.id, u])
            );

            const result = calculateMarketPrice(postStances, userMap);

            expect(result.supportPrice).toBeGreaterThanOrEqual(0);
            expect(result.supportPrice).toBeLessThanOrEqual(100);
            expect(result.opposePrice).toBeGreaterThanOrEqual(0);
            expect(result.opposePrice).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('single voter should determine market price exactly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          userVoteDataArbitrary,
          (supportValue, user) => {
            const postStances: PostStanceData[] = [
              { voterId: user.id, supportValue }
            ];
            const userMap = new Map<string, UserVoteData>([[user.id, user]]);

            const result = calculateMarketPrice(postStances, userMap);

            // Single voter's stance should be the market price
            // Use toEqual to handle -0 vs +0 edge case
            expect(result.supportPrice).toEqual(supportValue);
            expect(result.opposePrice).toEqual(100 - supportValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('equal weight voters with same stance should produce that stance as market price', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 2, max: 10 }),
          (supportValue, numVoters) => {
            // Create voters with identical reputation and sandbox status
            const postStances: PostStanceData[] = [];
            const userMap = new Map<string, UserVoteData>();

            for (let i = 0; i < numVoters; i++) {
              const id = `user_${i}_test`;
              postStances.push({ voterId: id, supportValue });
              userMap.set(id, {
                id,
                reputationScore: 100, // Same reputation
                sandboxCompleted: true, // Same sandbox status
              });
            }

            const result = calculateMarketPrice(postStances, userMap);

            // All voters have same stance, so market price should equal that stance
            expect(result.supportPrice).toBe(supportValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sandbox users should have lower vote weight than full users', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 200, noNaN: true }),
          (reputationScore) => {
            const sandboxUser = { reputationScore, sandboxCompleted: false };
            const fullUser = { reputationScore, sandboxCompleted: true };

            const sandboxWeight = calculateVoteWeight(sandboxUser);
            const fullWeight = calculateVoteWeight(fullUser);

            // Full users should have higher weight
            expect(fullWeight).toBeGreaterThan(sandboxWeight);
            // Specifically, full weight should be 2x sandbox weight
            expect(fullWeight / sandboxWeight).toBeCloseTo(2, 5);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('higher reputation should result in higher vote weight', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: 100, max: 200, noNaN: true }),
          fc.boolean(),
          (lowRep, highRep, sandboxCompleted) => {
            const lowRepUser = { reputationScore: lowRep, sandboxCompleted };
            const highRepUser = { reputationScore: highRep, sandboxCompleted };

            const lowWeight = calculateVoteWeight(lowRepUser);
            const highWeight = calculateVoteWeight(highRepUser);

            // Higher reputation should result in higher weight
            expect(highWeight).toBeGreaterThanOrEqual(lowWeight);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('unknown users should get sandbox vote weight', () => {
      const weight = calculateVoteWeight(undefined);
      expect(weight).toBe(SANDBOX_VOTE_WEIGHT);
    });

    it('weighted average should favor higher-weight voters', () => {
      // Create two voters: one sandbox (low weight), one full (high weight)
      // with opposite stances
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 40 }), // Low support value
          fc.integer({ min: 60, max: 100 }), // High support value
          (lowSupport, highSupport) => {
            const sandboxUserId = 'sandbox_user_test';
            const fullUserId = 'full_user_test';

            const postStances: PostStanceData[] = [
              { voterId: sandboxUserId, supportValue: lowSupport },
              { voterId: fullUserId, supportValue: highSupport },
            ];

            const userMap = new Map<string, UserVoteData>([
              [sandboxUserId, { id: sandboxUserId, reputationScore: 100, sandboxCompleted: false }],
              [fullUserId, { id: fullUserId, reputationScore: 100, sandboxCompleted: true }],
            ]);

            const result = calculateMarketPrice(postStances, userMap);

            // Market price should be closer to full user's stance (higher weight)
            const midpoint = (lowSupport + highSupport) / 2;
            expect(result.supportPrice).toBeGreaterThan(midpoint);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 10: Impact Attribution
   * For any stance change (pre to post), the impact SHALL be attributed to the
   * lastArgumentSeen at time of post-stance recording. The argument's impactScore
   * SHALL equal the sum of all attributed deltas.
   * 
   * Validates: Requirements 5.1, 5.2
   */
  describe('Property 10: Impact Attribution', () => {
    it('impact score should be sum of absolute deltas for attributed stances', () => {
      fc.assert(
        fc.property(
          argumentIdArbitrary,
          fc.array(stancePairArbitrary, { minLength: 1, maxLength: 20 }),
          (targetArgumentId, stancePairs) => {
            // Ensure at least some stances reference the target argument
            const modifiedPairs = stancePairs.map((pair, index) => ({
              ...pair,
              lastArgumentSeen: index % 2 === 0 ? targetArgumentId : pair.lastArgumentSeen,
            }));

            const impactScore = calculateImpactScore(targetArgumentId, modifiedPairs);

            // Calculate expected impact manually
            let expectedImpact = 0;
            for (const pair of modifiedPairs) {
              if (pair.lastArgumentSeen === targetArgumentId) {
                expectedImpact += Math.abs(pair.postValue - pair.preValue);
              }
            }

            expect(impactScore).toBe(expectedImpact);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('impact score should be zero when no stances reference the argument', () => {
      fc.assert(
        fc.property(
          argumentIdArbitrary,
          fc.array(stancePairArbitrary, { minLength: 0, maxLength: 10 }),
          (targetArgumentId, stancePairs) => {
            // Ensure no stances reference the target argument
            const modifiedPairs = stancePairs.map(pair => ({
              ...pair,
              lastArgumentSeen: pair.lastArgumentSeen === targetArgumentId 
                ? `different_${targetArgumentId}` 
                : pair.lastArgumentSeen,
            }));

            const impactScore = calculateImpactScore(targetArgumentId, modifiedPairs);

            expect(impactScore).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('impact score should be non-negative', () => {
      fc.assert(
        fc.property(
          argumentIdArbitrary,
          fc.array(stancePairArbitrary, { minLength: 0, maxLength: 20 }),
          (argumentId, stancePairs) => {
            const impactScore = calculateImpactScore(argumentId, stancePairs);

            expect(impactScore).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('impact should be attributed only to lastArgumentSeen', () => {
      fc.assert(
        fc.property(
          argumentIdArbitrary,
          argumentIdArbitrary,
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          userIdArbitrary,
          (arg1, arg2, preValue, postValue, voterId) => {
            // Ensure different arguments
            fc.pre(arg1 !== arg2);

            const stancePairs: StancePair[] = [
              { voterId, preValue, postValue, lastArgumentSeen: arg1 },
            ];

            const impactArg1 = calculateImpactScore(arg1, stancePairs);
            const impactArg2 = calculateImpactScore(arg2, stancePairs);

            // Only arg1 should have impact
            expect(impactArg1).toBe(Math.abs(postValue - preValue));
            expect(impactArg2).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('impact score should accumulate across multiple voters', () => {
      fc.assert(
        fc.property(
          argumentIdArbitrary,
          fc.array(
            fc.record({
              voterId: userIdArbitrary,
              preValue: fc.integer({ min: 0, max: 100 }),
              postValue: fc.integer({ min: 0, max: 100 }),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          (argumentId, voterData) => {
            // All voters reference the same argument
            const stancePairs: StancePair[] = voterData.map(v => ({
              ...v,
              lastArgumentSeen: argumentId,
            }));

            const impactScore = calculateImpactScore(argumentId, stancePairs);

            // Impact should be sum of all individual deltas
            const expectedImpact = voterData.reduce(
              (sum, v) => sum + Math.abs(v.postValue - v.preValue),
              0
            );

            expect(impactScore).toBe(expectedImpact);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('stance with no change should contribute zero impact', () => {
      fc.assert(
        fc.property(
          argumentIdArbitrary,
          fc.integer({ min: 0, max: 100 }),
          userIdArbitrary,
          (argumentId, stanceValue, voterId) => {
            // Pre and post are the same
            const stancePairs: StancePair[] = [
              { voterId, preValue: stanceValue, postValue: stanceValue, lastArgumentSeen: argumentId },
            ];

            const impactScore = calculateImpactScore(argumentId, stancePairs);

            expect(impactScore).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('null lastArgumentSeen should not attribute impact to any argument', () => {
      fc.assert(
        fc.property(
          argumentIdArbitrary,
          fc.integer({ min: 0, max: 50 }),
          fc.integer({ min: 51, max: 100 }),
          userIdArbitrary,
          (argumentId, preValue, postValue, voterId) => {
            const stancePairs: StancePair[] = [
              { voterId, preValue, postValue, lastArgumentSeen: null },
            ];

            const impactScore = calculateImpactScore(argumentId, stancePairs);

            // No impact should be attributed
            expect(impactScore).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
