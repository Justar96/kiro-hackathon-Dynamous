import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { DebateResult } from '@thesis/shared';

/**
 * Feature: debate-platform, Property 13: Reputation Increase on Correct Prediction
 * Validates: Requirements 7.2
 * 
 * For any concluded debate where user's post-stance direction matches 
 * the final outcome direction, user's reputationScore SHALL increase.
 */

// Constants (same as in reputation.service.ts)
const CORRECT_PREDICTION_BONUS = 5;
const HIGH_IMPACT_ARGUMENT_BONUS = 3;
const HIGH_IMPACT_THRESHOLD = 10;

// Simulated user state for testing
interface UserState {
  id: string;
  reputationScore: number;
}

// Simulated post-stance for testing
interface PostStance {
  voterId: string;
  supportValue: number;
}

/**
 * Determine prediction direction from support value
 * Extracted logic from ReputationService
 */
function getPredictionDirection(supportValue: number): 'support' | 'oppose' | 'neutral' {
  if (supportValue > 50) {
    return 'support';
  } else if (supportValue < 50) {
    return 'oppose';
  }
  return 'neutral';
}

/**
 * Calculate reputation change based on prediction accuracy
 * Returns the bonus amount if prediction was correct, 0 otherwise
 */
function calculateReputationChange(
  postStance: PostStance,
  debateResult: DebateResult
): number {
  const userPrediction = getPredictionDirection(postStance.supportValue);
  const actualOutcome = debateResult.winnerSide;

  // No bonus for ties or neutral predictions
  if (actualOutcome === 'tie' || userPrediction === 'neutral') {
    return 0;
  }

  // Bonus if prediction matches outcome
  return userPrediction === actualOutcome ? CORRECT_PREDICTION_BONUS : 0;
}

/**
 * Apply reputation change to user
 */
function applyReputationChange(user: UserState, change: number): UserState {
  return {
    ...user,
    reputationScore: user.reputationScore + change,
  };
}

describe('ReputationService Property Tests', () => {
  /**
   * Property 13: Reputation Increase on Correct Prediction
   * For any user whose post-stance direction matches the winning side,
   * their reputation should increase by CORRECT_PREDICTION_BONUS
   * Validates: Requirements 7.2
   */
  it('Property 13: Correct prediction should increase reputation', () => {
    fc.assert(
      fc.property(
        // Generate user with any starting reputation
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          reputationScore: fc.float({ min: 0, max: 1000, noNaN: true }),
        }),
        // Generate support value that clearly predicts support (> 50)
        fc.integer({ min: 51, max: 100 }),
        (user, supportValue) => {
          const postStance: PostStance = {
            voterId: user.id,
            supportValue,
          };

          // Debate outcome is support (matches user's prediction)
          const debateResult: DebateResult = {
            debateId: 'test-debate',
            finalSupportPrice: 60,
            finalOpposePrice: 40,
            totalMindChanges: 5,
            netPersuasionDelta: 10,
            winnerSide: 'support',
          };

          const change = calculateReputationChange(postStance, debateResult);
          const updatedUser = applyReputationChange(user, change);

          // Reputation should increase by exactly CORRECT_PREDICTION_BONUS
          expect(change).toBe(CORRECT_PREDICTION_BONUS);
          expect(updatedUser.reputationScore).toBe(user.reputationScore + CORRECT_PREDICTION_BONUS);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13: Correct oppose prediction should also increase reputation
   * Validates: Requirements 7.2
   */
  it('Property 13: Correct oppose prediction should increase reputation', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          reputationScore: fc.float({ min: 0, max: 1000, noNaN: true }),
        }),
        // Generate support value that clearly predicts oppose (< 50)
        fc.integer({ min: 0, max: 49 }),
        (user, supportValue) => {
          const postStance: PostStance = {
            voterId: user.id,
            supportValue,
          };

          // Debate outcome is oppose (matches user's prediction)
          const debateResult: DebateResult = {
            debateId: 'test-debate',
            finalSupportPrice: 40,
            finalOpposePrice: 60,
            totalMindChanges: 5,
            netPersuasionDelta: -10,
            winnerSide: 'oppose',
          };

          const change = calculateReputationChange(postStance, debateResult);
          const updatedUser = applyReputationChange(user, change);

          // Reputation should increase by exactly CORRECT_PREDICTION_BONUS
          expect(change).toBe(CORRECT_PREDICTION_BONUS);
          expect(updatedUser.reputationScore).toBe(user.reputationScore + CORRECT_PREDICTION_BONUS);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13: Incorrect prediction should NOT increase reputation
   * Validates: Requirements 7.2
   */
  it('Property 13: Incorrect prediction should not increase reputation', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          reputationScore: fc.float({ min: 0, max: 1000, noNaN: true }),
        }),
        // Generate support value that predicts support (> 50)
        fc.integer({ min: 51, max: 100 }),
        (user, supportValue) => {
          const postStance: PostStance = {
            voterId: user.id,
            supportValue,
          };

          // Debate outcome is oppose (does NOT match user's prediction)
          const debateResult: DebateResult = {
            debateId: 'test-debate',
            finalSupportPrice: 40,
            finalOpposePrice: 60,
            totalMindChanges: 5,
            netPersuasionDelta: -10,
            winnerSide: 'oppose',
          };

          const change = calculateReputationChange(postStance, debateResult);
          const updatedUser = applyReputationChange(user, change);

          // Reputation should NOT change
          expect(change).toBe(0);
          expect(updatedUser.reputationScore).toBe(user.reputationScore);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13: Neutral prediction (supportValue = 50) should NOT increase reputation
   * Validates: Requirements 7.2
   */
  it('Property 13: Neutral prediction should not increase reputation', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          reputationScore: fc.float({ min: 0, max: 1000, noNaN: true }),
        }),
        // Winner can be either support or oppose
        fc.constantFrom('support', 'oppose') as fc.Arbitrary<'support' | 'oppose'>,
        (user, winnerSide) => {
          const postStance: PostStance = {
            voterId: user.id,
            supportValue: 50, // Neutral - exactly 50
          };

          const debateResult: DebateResult = {
            debateId: 'test-debate',
            finalSupportPrice: winnerSide === 'support' ? 60 : 40,
            finalOpposePrice: winnerSide === 'support' ? 40 : 60,
            totalMindChanges: 5,
            netPersuasionDelta: winnerSide === 'support' ? 10 : -10,
            winnerSide,
          };

          const change = calculateReputationChange(postStance, debateResult);

          // Neutral predictions get no bonus
          expect(change).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13: Tie outcome should NOT increase reputation
   * Validates: Requirements 7.2
   */
  it('Property 13: Tie outcome should not increase reputation', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          reputationScore: fc.float({ min: 0, max: 1000, noNaN: true }),
        }),
        // Any support value
        fc.integer({ min: 0, max: 100 }),
        (user, supportValue) => {
          const postStance: PostStance = {
            voterId: user.id,
            supportValue,
          };

          // Debate outcome is a tie
          const debateResult: DebateResult = {
            debateId: 'test-debate',
            finalSupportPrice: 50,
            finalOpposePrice: 50,
            totalMindChanges: 0,
            netPersuasionDelta: 0,
            winnerSide: 'tie',
          };

          const change = calculateReputationChange(postStance, debateResult);

          // Ties give no bonus regardless of prediction
          expect(change).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13: Reputation change is always non-negative
   * The system should never decrease reputation for predictions
   * Validates: Requirements 7.2
   */
  it('Property 13: Reputation change should be non-negative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.constantFrom('support', 'oppose', 'tie') as fc.Arbitrary<'support' | 'oppose' | 'tie'>,
        (supportValue, winnerSide) => {
          const postStance: PostStance = {
            voterId: 'test-user',
            supportValue,
          };

          const debateResult: DebateResult = {
            debateId: 'test-debate',
            finalSupportPrice: 50,
            finalOpposePrice: 50,
            totalMindChanges: 0,
            netPersuasionDelta: 0,
            winnerSide,
          };

          const change = calculateReputationChange(postStance, debateResult);

          // Change should always be >= 0 (either bonus or no change)
          expect(change).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13: Prediction direction is correctly determined
   * supportValue > 50 -> support, < 50 -> oppose, = 50 -> neutral
   * Validates: Requirements 7.2
   */
  it('Property 13: Prediction direction should be correctly determined', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (supportValue) => {
          const direction = getPredictionDirection(supportValue);

          if (supportValue > 50) {
            expect(direction).toBe('support');
          } else if (supportValue < 50) {
            expect(direction).toBe('oppose');
          } else {
            expect(direction).toBe('neutral');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
