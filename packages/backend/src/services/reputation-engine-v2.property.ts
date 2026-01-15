import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  REPUTATION_WEIGHTS,
  calculateDiminishingReturns,
  REPUTATION_DECAY_THRESHOLD_DAYS,
  REPUTATION_DECAY_RATE_PER_WEEK,
  LOW_IMPACT_THRESHOLD
} from '@thesis/shared';

/**
 * Feature: debate-lifecycle-ux
 * Property tests for ReputationEngineV2
 * 
 * These tests validate the correctness properties defined in the design document
 * for the enhanced reputation calculation system.
 */

// ============================================
// Helper Functions (extracted from service for pure testing)
// ============================================

/**
 * Normalize impact score to 0-100 scale
 */
function normalizeImpactScore(totalImpact: number): number {
  if (totalImpact <= 0) return 0;
  const normalized = Math.log10(totalImpact + 1) * 25;
  return Math.min(100, Math.round(normalized * 100) / 100);
}

/**
 * Calculate consistency score based on participation and quality
 */
function calculateConsistencyScore(participationCount: number, qualityScore: number): number {
  if (participationCount === 0) return 50;
  const participationFactor = Math.min(1, participationCount / 50);
  const qualityFactor = qualityScore / 100;
  return Math.round((50 + participationFactor * qualityFactor * 50) * 100) / 100;
}

/**
 * Calculate trust level from other factors
 */
function calculateTrustLevel(persuasion: number, accuracy: number, consistency: number): number {
  return Math.round((persuasion * 0.4 + accuracy * 0.4 + consistency * 0.2) * 100) / 100;
}

/**
 * Calculate overall reputation score from factors
 */
function calculateOverallReputation(
  persuasionSkill: number,
  predictionAccuracy: number,
  qualityScore: number,
  consistency: number,
  trustLevel: number
): number {
  const overall = Math.round(
    (persuasionSkill * REPUTATION_WEIGHTS.impactScore +
     predictionAccuracy * REPUTATION_WEIGHTS.predictionAccuracy +
     qualityScore * REPUTATION_WEIGHTS.participationQuality +
     consistency * REPUTATION_WEIGHTS.consistency +
     trustLevel * REPUTATION_WEIGHTS.communityTrust) * 10
  );
  return Math.max(0, Math.min(1000, overall));
}

/**
 * Calculate vote weight based on reputation and accuracy
 */
function calculateVoteWeight(
  reputationScore: number,
  predictionAccuracy: number,
  sandboxCompleted: boolean
): number {
  if (!sandboxCompleted) return 0.5;
  
  const reputationModifier = (reputationScore - 100) / 400;
  const accuracyModifier = (predictionAccuracy - 50) / 200;
  const weight = 1.0 + reputationModifier + accuracyModifier;
  
  return Math.max(0.5, Math.min(1.5, weight));
}

/**
 * Calculate reputation change from impact score with diminishing returns
 */
function calculateReputationChangeFromImpact(
  impactScore: number,
  participationCount: number
): number {
  if (impactScore < LOW_IMPACT_THRESHOLD) return 0;
  
  const rawGain = impactScore * 0.5;
  const adjustedGain = calculateDiminishingReturns(rawGain, participationCount);
  return Math.round(adjustedGain * 100) / 100;
}

/**
 * Calculate reputation decay
 */
function calculateDecay(
  currentScore: number,
  daysSinceActive: number
): number {
  if (daysSinceActive <= REPUTATION_DECAY_THRESHOLD_DAYS) {
    return currentScore;
  }
  
  const weeksInactive = Math.floor((daysSinceActive - REPUTATION_DECAY_THRESHOLD_DAYS) / 7);
  const decayMultiplier = Math.pow(1 - REPUTATION_DECAY_RATE_PER_WEEK, weeksInactive);
  return Math.round(currentScore * decayMultiplier * 100) / 100;
}

/**
 * Update prediction accuracy
 */
function updatePredictionAccuracy(currentAccuracy: number, wasCorrect: boolean): number {
  const weight = 0.1;
  let newAccuracy: number;
  if (wasCorrect) {
    newAccuracy = currentAccuracy + (100 - currentAccuracy) * weight;
  } else {
    newAccuracy = currentAccuracy - currentAccuracy * weight;
  }
  return Math.round(newAccuracy * 100) / 100;
}

// ============================================
// Property Tests
// ============================================

describe('ReputationEngineV2 Property Tests', () => {
  /**
   * Property 10: Multi-Factor Reputation Calculation
   * For any reputation calculation, the result SHALL be influenced by at least two distinct factors.
   * Changing only one factor while holding others constant SHALL produce a different reputation score.
   * Validates: Requirements 4.1, 4.5
   */
  describe('Property 10: Multi-Factor Reputation Calculation', () => {
    it('changing impact score alone should change overall reputation', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000, noNaN: true }), // impactScoreTotal1
          fc.float({ min: 0, max: 1000, noNaN: true }), // impactScoreTotal2
          fc.float({ min: 0, max: 100, noNaN: true }),  // predictionAccuracy
          fc.float({ min: 0, max: 100, noNaN: true }),  // qualityScore
          fc.integer({ min: 0, max: 100 }),              // participationCount
          (impact1, impact2, accuracy, quality, participation) => {
            // Ensure impacts are different enough to matter
            if (Math.abs(impact1 - impact2) < 10) return true;
            
            const persuasion1 = normalizeImpactScore(impact1);
            const persuasion2 = normalizeImpactScore(impact2);
            const consistency = calculateConsistencyScore(participation, quality);
            const trust1 = calculateTrustLevel(persuasion1, accuracy, consistency);
            const trust2 = calculateTrustLevel(persuasion2, accuracy, consistency);
            
            const overall1 = calculateOverallReputation(persuasion1, accuracy, quality, consistency, trust1);
            const overall2 = calculateOverallReputation(persuasion2, accuracy, quality, consistency, trust2);
            
            // Different impact scores should produce different overall scores
            return overall1 !== overall2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('changing prediction accuracy alone should change overall reputation', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000, noNaN: true }), // impactScoreTotal
          fc.float({ min: 0, max: 100, noNaN: true }),  // predictionAccuracy1
          fc.float({ min: 0, max: 100, noNaN: true }),  // predictionAccuracy2
          fc.float({ min: 0, max: 100, noNaN: true }),  // qualityScore
          fc.integer({ min: 0, max: 100 }),              // participationCount
          (impact, accuracy1, accuracy2, quality, participation) => {
            // Ensure accuracies are different enough to matter
            if (Math.abs(accuracy1 - accuracy2) < 5) return true;
            
            const persuasion = normalizeImpactScore(impact);
            const consistency = calculateConsistencyScore(participation, quality);
            const trust1 = calculateTrustLevel(persuasion, accuracy1, consistency);
            const trust2 = calculateTrustLevel(persuasion, accuracy2, consistency);
            
            const overall1 = calculateOverallReputation(persuasion, accuracy1, quality, consistency, trust1);
            const overall2 = calculateOverallReputation(persuasion, accuracy2, quality, consistency, trust2);
            
            // Different accuracies should produce different overall scores
            return overall1 !== overall2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('overall reputation should be bounded between 0 and 1000', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 10000, noNaN: true }), // impactScoreTotal
          fc.float({ min: 0, max: 100, noNaN: true }),   // predictionAccuracy
          fc.float({ min: 0, max: 100, noNaN: true }),   // qualityScore
          fc.integer({ min: 0, max: 1000 }),              // participationCount
          (impact, accuracy, quality, participation) => {
            const persuasion = normalizeImpactScore(impact);
            const consistency = calculateConsistencyScore(participation, quality);
            const trust = calculateTrustLevel(persuasion, accuracy, consistency);
            const overall = calculateOverallReputation(persuasion, accuracy, quality, consistency, trust);
            
            return overall >= 0 && overall <= 1000;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('vote weight should consider both reputation and accuracy', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 200, noNaN: true }),  // reputationScore
          fc.float({ min: 0, max: 100, noNaN: true }),  // predictionAccuracy
          (reputation, accuracy) => {
            const weight = calculateVoteWeight(reputation, accuracy, true);
            
            // Weight should be bounded
            return weight >= 0.5 && weight <= 1.5;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sandbox users should always have 0.5 vote weight', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000, noNaN: true }), // reputationScore
          fc.float({ min: 0, max: 100, noNaN: true }),  // predictionAccuracy
          (reputation, accuracy) => {
            const weight = calculateVoteWeight(reputation, accuracy, false);
            return weight === 0.5;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 11: Impact-Proportional Reputation
   * For any argument with impact score I₁ and another with I₂ where I₁ > I₂,
   * the reputation increase from I₁ SHALL be >= the increase from I₂.
   * Validates: Requirements 4.2
   */
  describe('Property 11: Impact-Proportional Reputation', () => {
    it('higher impact should result in higher or equal reputation gain', () => {
      fc.assert(
        fc.property(
          fc.float({ min: LOW_IMPACT_THRESHOLD, max: 100, noNaN: true }), // impactScore1
          fc.float({ min: LOW_IMPACT_THRESHOLD, max: 100, noNaN: true }), // impactScore2
          fc.integer({ min: 0, max: 100 }),                                // participationCount
          (impact1, impact2, participation) => {
            const change1 = calculateReputationChangeFromImpact(impact1, participation);
            const change2 = calculateReputationChangeFromImpact(impact2, participation);
            
            // Higher impact should give higher or equal gain
            if (impact1 > impact2) {
              return change1 >= change2;
            } else if (impact2 > impact1) {
              return change2 >= change1;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('reputation change should be non-negative for valid impacts', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }), // impactScore
          fc.integer({ min: 0, max: 100 }),             // participationCount
          (impact, participation) => {
            const change = calculateReputationChangeFromImpact(impact, participation);
            return change >= 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 12: Prediction Accuracy Update
   * For any correct prediction, accuracy SHALL increase.
   * For any incorrect prediction, accuracy SHALL decrease or remain unchanged.
   * Validates: Requirements 4.3
   */
  describe('Property 12: Prediction Accuracy Update', () => {
    it('correct prediction should increase accuracy', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: Math.fround(99), noNaN: true }), // currentAccuracy (not 100 to allow increase)
          (currentAccuracy) => {
            const newAccuracy = updatePredictionAccuracy(currentAccuracy, true);
            return newAccuracy > currentAccuracy;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('incorrect prediction should decrease accuracy', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(1), max: 100, noNaN: true }), // currentAccuracy (not 0 to allow decrease)
          (currentAccuracy) => {
            const newAccuracy = updatePredictionAccuracy(currentAccuracy, false);
            return newAccuracy < currentAccuracy;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('accuracy should stay bounded between 0 and 100', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }), // currentAccuracy
          fc.boolean(),                                 // wasCorrect
          (currentAccuracy, wasCorrect) => {
            const newAccuracy = updatePredictionAccuracy(currentAccuracy, wasCorrect);
            return newAccuracy >= 0 && newAccuracy <= 100;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 13: Diminishing Returns Formula
   * For any sequence of N identical actions, totalGain < N × firstActionGain.
   * Validates: Requirements 4.4
   */
  describe('Property 13: Diminishing Returns Formula', () => {
    it('total gain from N actions should be less than N times first action gain', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1, max: 100, noNaN: true }), // rawScore
          fc.integer({ min: 2, max: 50 }),              // actionCount
          (rawScore, actionCount) => {
            const firstGain = calculateDiminishingReturns(rawScore, 1);
            let totalGain = 0;
            for (let i = 1; i <= actionCount; i++) {
              totalGain += calculateDiminishingReturns(rawScore, i);
            }
            
            // Total gain should be less than actionCount * firstGain
            return totalGain < actionCount * firstGain;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('each subsequent action should give less or equal gain', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1, max: 100, noNaN: true }), // rawScore
          fc.integer({ min: 1, max: 100 }),             // count
          (rawScore, count) => {
            const gain1 = calculateDiminishingReturns(rawScore, count);
            const gain2 = calculateDiminishingReturns(rawScore, count + 1);
            
            // Later actions should give less or equal gain
            return gain2 <= gain1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('diminishing returns should always be non-negative', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000, noNaN: true }), // rawScore
          fc.integer({ min: 0, max: 1000 }),             // count
          (rawScore, count) => {
            const gain = calculateDiminishingReturns(rawScore, count);
            return gain >= 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 14: Reputation Decay Over Time
   * For any user inactive for D days where D > threshold,
   * their reputation SHALL be <= their score at start of inactivity.
   * Validates: Requirements 4.6
   */
  describe('Property 14: Reputation Decay Over Time', () => {
    it('reputation should not decay within threshold period', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000, noNaN: true }),                    // currentScore
          fc.integer({ min: 0, max: REPUTATION_DECAY_THRESHOLD_DAYS }),    // daysSinceActive
          (currentScore, daysSinceActive) => {
            const newScore = calculateDecay(currentScore, daysSinceActive);
            return newScore === currentScore;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('reputation should decay after threshold period', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1, max: 1000, noNaN: true }),                              // currentScore (> 0)
          fc.integer({ min: REPUTATION_DECAY_THRESHOLD_DAYS + 7, max: 365 }),        // daysSinceActive (at least 1 week past threshold)
          (currentScore, daysSinceActive) => {
            const newScore = calculateDecay(currentScore, daysSinceActive);
            return newScore <= currentScore;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('decayed reputation should be non-negative', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000, noNaN: true }), // currentScore
          fc.integer({ min: 0, max: 1000 }),             // daysSinceActive
          (currentScore, daysSinceActive) => {
            const newScore = calculateDecay(currentScore, daysSinceActive);
            return newScore >= 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 15: Low-Impact Neutrality
   * Arguments with impact < threshold result in ±0 reputation change.
   * Validates: Requirements 4.7
   */
  describe('Property 15: Low-Impact Neutrality', () => {
    it('low impact arguments should result in zero reputation change', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: Math.fround(LOW_IMPACT_THRESHOLD - 1), noNaN: true }), // impactScore below threshold
          fc.integer({ min: 0, max: 100 }),                                      // participationCount
          (impactScore, participationCount) => {
            const change = calculateReputationChangeFromImpact(impactScore, participationCount);
            return change === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('impact at or above threshold should result in positive change', () => {
      fc.assert(
        fc.property(
          fc.float({ min: LOW_IMPACT_THRESHOLD, max: 100, noNaN: true }), // impactScore at or above threshold
          fc.integer({ min: 0, max: 100 }),                                 // participationCount
          (impactScore, participationCount) => {
            const change = calculateReputationChangeFromImpact(impactScore, participationCount);
            return change > 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
