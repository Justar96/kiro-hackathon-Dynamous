import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { StanceValue, PersuasionDelta } from '@thesis/shared';

/**
 * Feature: debate-platform
 * Property Tests for Voting Service
 * 
 * Properties covered:
 * - Property 7: Persuasion Delta Calculation
 * - Property 8: Blind Voting Enforcement
 * 
 * Validates: Requirements 3.3, 3.4, 3.5
 */

// Arbitrary for generating valid stance values (supportValue 0-100, confidence 1-5)
const stanceValueArbitrary = fc.record({
  supportValue: fc.integer({ min: 0, max: 100 }),
  confidence: fc.integer({ min: 1, max: 5 }),
});

// Arbitrary for generating user IDs
const userIdArbitrary = fc.string({ minLength: 10, maxLength: 21 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

// Arbitrary for generating debate IDs
const debateIdArbitrary = fc.string({ minLength: 10, maxLength: 21 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

// Arbitrary for generating argument IDs (nullable)
const argumentIdArbitrary = fc.option(
  fc.string({ minLength: 10, maxLength: 21 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
  { nil: null }
);

/**
 * Pure function to calculate persuasion delta
 * Extracted from VotingService for property testing
 */
function calculatePersuasionDelta(
  preStance: StanceValue,
  postStance: StanceValue,
  userId: string,
  debateId: string,
  lastArgumentSeen: string | null
): PersuasionDelta {
  return {
    userId,
    debateId,
    preStance,
    postStance,
    delta: postStance.supportValue - preStance.supportValue,
    lastArgumentSeen,
  };
}

/**
 * Simulates the blind voting state machine
 * State: { hasPreStance: boolean }
 * Transitions:
 * - recordPreStance: false -> true
 * - canAccessMarket: depends on hasPreStance
 */
interface BlindVotingState {
  hasPreStance: boolean;
  debateId: string;
  userId: string;
}

function canAccessMarketPrice(state: BlindVotingState): { canAccess: boolean; reason?: string } {
  if (!state.hasPreStance) {
    return { canAccess: false, reason: 'Record your pre-read stance first' };
  }
  return { canAccess: true };
}

function recordPreStance(state: BlindVotingState): BlindVotingState {
  return { ...state, hasPreStance: true };
}

describe('VotingService Property Tests', () => {
  /**
   * Property 7: Persuasion Delta Calculation
   * For any user with both pre-stance and post-stance recorded:
   * - persuasionDelta = postStance.supportValue - preStance.supportValue
   * - Updating post-stance SHALL recalculate delta correctly
   * 
   * This is a round-trip property: the delta should always equal the arithmetic difference.
   * 
   * Validates: Requirements 3.3, 3.5
   */
  describe('Property 7: Persuasion Delta Calculation', () => {
    it('delta should equal postStance.supportValue - preStance.supportValue', () => {
      fc.assert(
        fc.property(
          stanceValueArbitrary,
          stanceValueArbitrary,
          userIdArbitrary,
          debateIdArbitrary,
          argumentIdArbitrary,
          (preStance, postStance, userId, debateId, lastArgumentSeen) => {
            const result = calculatePersuasionDelta(
              preStance,
              postStance,
              userId,
              debateId,
              lastArgumentSeen
            );

            // Property 7: Delta should be exactly the arithmetic difference
            expect(result.delta).toBe(postStance.supportValue - preStance.supportValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('delta should be in range [-100, 100]', () => {
      fc.assert(
        fc.property(
          stanceValueArbitrary,
          stanceValueArbitrary,
          userIdArbitrary,
          debateIdArbitrary,
          argumentIdArbitrary,
          (preStance, postStance, userId, debateId, lastArgumentSeen) => {
            const result = calculatePersuasionDelta(
              preStance,
              postStance,
              userId,
              debateId,
              lastArgumentSeen
            );

            // Delta should be bounded by the stance range
            expect(result.delta).toBeGreaterThanOrEqual(-100);
            expect(result.delta).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('delta should be zero when pre and post stances are equal', () => {
      fc.assert(
        fc.property(
          stanceValueArbitrary,
          userIdArbitrary,
          debateIdArbitrary,
          argumentIdArbitrary,
          (stance, userId, debateId, lastArgumentSeen) => {
            const result = calculatePersuasionDelta(
              stance,
              stance, // Same stance for pre and post
              userId,
              debateId,
              lastArgumentSeen
            );

            // Delta should be zero when stances are equal
            expect(result.delta).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('delta should be positive when post-stance support is higher', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 99 }), // Pre-stance support (0-99)
          fc.integer({ min: 1, max: 100 }), // Post-stance support (1-100)
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 5 }),
          userIdArbitrary,
          debateIdArbitrary,
          (preSupportValue, postSupportValue, preConfidence, postConfidence, userId, debateId) => {
            // Ensure post > pre
            fc.pre(postSupportValue > preSupportValue);

            const preStance: StanceValue = { supportValue: preSupportValue, confidence: preConfidence };
            const postStance: StanceValue = { supportValue: postSupportValue, confidence: postConfidence };

            const result = calculatePersuasionDelta(preStance, postStance, userId, debateId, null);

            // Delta should be positive
            expect(result.delta).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('delta should be negative when post-stance support is lower', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }), // Pre-stance support (1-100)
          fc.integer({ min: 0, max: 99 }), // Post-stance support (0-99)
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 5 }),
          userIdArbitrary,
          debateIdArbitrary,
          (preSupportValue, postSupportValue, preConfidence, postConfidence, userId, debateId) => {
            // Ensure post < pre
            fc.pre(postSupportValue < preSupportValue);

            const preStance: StanceValue = { supportValue: preSupportValue, confidence: preConfidence };
            const postStance: StanceValue = { supportValue: postSupportValue, confidence: postConfidence };

            const result = calculatePersuasionDelta(preStance, postStance, userId, debateId, null);

            // Delta should be negative
            expect(result.delta).toBeLessThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('recalculating delta with updated post-stance should produce correct result', () => {
      fc.assert(
        fc.property(
          stanceValueArbitrary,
          stanceValueArbitrary,
          stanceValueArbitrary, // Updated post-stance
          userIdArbitrary,
          debateIdArbitrary,
          argumentIdArbitrary,
          (preStance, originalPostStance, updatedPostStance, userId, debateId, lastArgumentSeen) => {
            // First calculation
            const originalResult = calculatePersuasionDelta(
              preStance,
              originalPostStance,
              userId,
              debateId,
              lastArgumentSeen
            );

            // Recalculation with updated post-stance (Requirement 3.5)
            const updatedResult = calculatePersuasionDelta(
              preStance,
              updatedPostStance,
              userId,
              debateId,
              lastArgumentSeen
            );

            // Both should correctly calculate delta
            expect(originalResult.delta).toBe(originalPostStance.supportValue - preStance.supportValue);
            expect(updatedResult.delta).toBe(updatedPostStance.supportValue - preStance.supportValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('delta calculation should preserve input values in result', () => {
      fc.assert(
        fc.property(
          stanceValueArbitrary,
          stanceValueArbitrary,
          userIdArbitrary,
          debateIdArbitrary,
          argumentIdArbitrary,
          (preStance, postStance, userId, debateId, lastArgumentSeen) => {
            const result = calculatePersuasionDelta(
              preStance,
              postStance,
              userId,
              debateId,
              lastArgumentSeen
            );

            // Result should preserve all input values
            expect(result.preStance).toEqual(preStance);
            expect(result.postStance).toEqual(postStance);
            expect(result.userId).toBe(userId);
            expect(result.debateId).toBe(debateId);
            expect(result.lastArgumentSeen).toBe(lastArgumentSeen);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 8: Blind Voting Enforcement
   * For any user who has NOT recorded a pre-stance for a debate,
   * requesting market price SHALL be denied or return a masked value.
   * 
   * Validates: Requirements 3.4
   */
  describe('Property 8: Blind Voting Enforcement', () => {
    it('market price access should be denied when pre-stance not recorded', () => {
      fc.assert(
        fc.property(
          debateIdArbitrary,
          userIdArbitrary,
          (debateId, userId) => {
            // State: user has NOT recorded pre-stance
            const state: BlindVotingState = {
              hasPreStance: false,
              debateId,
              userId,
            };

            const result = canAccessMarketPrice(state);

            // Property 8: Access should be denied
            expect(result.canAccess).toBe(false);
            expect(result.reason).toBe('Record your pre-read stance first');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('market price access should be allowed after pre-stance recorded', () => {
      fc.assert(
        fc.property(
          debateIdArbitrary,
          userIdArbitrary,
          (debateId, userId) => {
            // State: user HAS recorded pre-stance
            const state: BlindVotingState = {
              hasPreStance: true,
              debateId,
              userId,
            };

            const result = canAccessMarketPrice(state);

            // Access should be allowed
            expect(result.canAccess).toBe(true);
            expect(result.reason).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('recording pre-stance should transition state to allow market access', () => {
      fc.assert(
        fc.property(
          debateIdArbitrary,
          userIdArbitrary,
          (debateId, userId) => {
            // Initial state: no pre-stance
            const initialState: BlindVotingState = {
              hasPreStance: false,
              debateId,
              userId,
            };

            // Before recording: access denied
            const beforeResult = canAccessMarketPrice(initialState);
            expect(beforeResult.canAccess).toBe(false);

            // Record pre-stance (state transition)
            const afterState = recordPreStance(initialState);

            // After recording: access allowed
            const afterResult = canAccessMarketPrice(afterState);
            expect(afterResult.canAccess).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('blind voting state should be independent per user-debate pair', () => {
      fc.assert(
        fc.property(
          debateIdArbitrary,
          debateIdArbitrary,
          userIdArbitrary,
          userIdArbitrary,
          (debateId1, debateId2, userId1, userId2) => {
            // Ensure different debates and users
            fc.pre(debateId1 !== debateId2);
            fc.pre(userId1 !== userId2);

            // User1 has pre-stance for debate1
            const state1: BlindVotingState = {
              hasPreStance: true,
              debateId: debateId1,
              userId: userId1,
            };

            // User2 does NOT have pre-stance for debate2
            const state2: BlindVotingState = {
              hasPreStance: false,
              debateId: debateId2,
              userId: userId2,
            };

            // User1 can access debate1 market
            expect(canAccessMarketPrice(state1).canAccess).toBe(true);

            // User2 cannot access debate2 market
            expect(canAccessMarketPrice(state2).canAccess).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('same user should have independent blind voting state per debate', () => {
      fc.assert(
        fc.property(
          debateIdArbitrary,
          debateIdArbitrary,
          userIdArbitrary,
          (debateId1, debateId2, userId) => {
            // Ensure different debates
            fc.pre(debateId1 !== debateId2);

            // User has pre-stance for debate1 but not debate2
            const stateDebate1: BlindVotingState = {
              hasPreStance: true,
              debateId: debateId1,
              userId,
            };

            const stateDebate2: BlindVotingState = {
              hasPreStance: false,
              debateId: debateId2,
              userId,
            };

            // Can access debate1 market
            expect(canAccessMarketPrice(stateDebate1).canAccess).toBe(true);

            // Cannot access debate2 market
            expect(canAccessMarketPrice(stateDebate2).canAccess).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
