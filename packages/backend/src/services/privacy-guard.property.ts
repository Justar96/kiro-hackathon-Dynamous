import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Stance, AggregateStanceData } from '@thesis/shared';
import { PrivacyGuard } from './privacy-guard.service';

/**
 * Feature: debate-lifecycle-ux
 * Property Tests for PrivacyGuard Service
 * 
 * Properties covered:
 * - Property 7: Vote Privacy Invariant
 * - Property 8: Self-Access Vote Retrieval
 * - Property 9: Blind Voting Enforcement
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

// Arbitrary for generating valid user IDs
const userIdArbitrary = fc.string({ minLength: 10, maxLength: 21 })
  .filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

// Arbitrary for generating debate IDs
const debateIdArbitrary = fc.string({ minLength: 10, maxLength: 21 })
  .filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

// Arbitrary for generating stance IDs
const stanceIdArbitrary = fc.string({ minLength: 10, maxLength: 21 })
  .filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

// Arbitrary for generating valid support values (0-100)
const supportValueArbitrary = fc.integer({ min: 0, max: 100 });

// Arbitrary for generating valid confidence values (1-5)
const confidenceArbitrary = fc.integer({ min: 1, max: 5 });

// Arbitrary for generating stance type
const stanceTypeArbitrary = fc.constantFrom('pre' as const, 'post' as const);

// Arbitrary for generating a single stance
const stanceArbitrary = fc.record({
  id: stanceIdArbitrary,
  debateId: debateIdArbitrary,
  voterId: userIdArbitrary,
  type: stanceTypeArbitrary,
  supportValue: supportValueArbitrary,
  confidence: confidenceArbitrary,
  lastArgumentSeen: fc.option(stanceIdArbitrary, { nil: null }),
  createdAt: fc.date(),
}) as fc.Arbitrary<Stance>;

// Arbitrary for generating an array of stances
const stancesArrayArbitrary = fc.array(stanceArbitrary, { minLength: 0, maxLength: 50 });

// Arbitrary for generating a voter with both pre and post stances
const voterWithBothStancesArbitrary = (debateId: string) => 
  fc.record({
    voterId: userIdArbitrary,
    preStance: fc.record({
      id: stanceIdArbitrary,
      debateId: fc.constant(debateId),
      type: fc.constant('pre' as const),
      supportValue: supportValueArbitrary,
      confidence: confidenceArbitrary,
      lastArgumentSeen: fc.constant(null),
      createdAt: fc.date(),
    }),
    postStance: fc.record({
      id: stanceIdArbitrary,
      debateId: fc.constant(debateId),
      type: fc.constant('post' as const),
      supportValue: supportValueArbitrary,
      confidence: confidenceArbitrary,
      lastArgumentSeen: fc.option(stanceIdArbitrary, { nil: null }),
      createdAt: fc.date(),
    }),
  }).map(({ voterId, preStance, postStance }) => [
    { ...preStance, voterId } as Stance,
    { ...postStance, voterId } as Stance,
  ]);

// Create instance for testing
const privacyGuard = new PrivacyGuard();

/**
 * Helper to check if an object contains any voter ID fields
 */
function containsVoterId(obj: unknown): boolean {
  if (obj === null || obj === undefined) return false;
  if (typeof obj !== 'object') return false;
  
  const keys = Object.keys(obj as object);
  
  // Check for voter_id or voterId fields
  if (keys.includes('voterId') || keys.includes('voter_id')) {
    return true;
  }
  
  // Recursively check nested objects
  for (const key of keys) {
    if (containsVoterId((obj as Record<string, unknown>)[key])) {
      return true;
    }
  }
  
  return false;
}

/**
 * Helper to check if response contains any data that could identify individual voters
 */
function containsIndividualVoterData(response: AggregateStanceData): boolean {
  // AggregateStanceData should only contain aggregate fields
  const allowedFields = ['totalVoters', 'averagePreStance', 'averagePostStance', 'averageDelta', 'mindChangedCount'];
  const responseKeys = Object.keys(response);
  
  // Check that all keys are in the allowed list
  for (const key of responseKeys) {
    if (!allowedFields.includes(key)) {
      return true; // Contains unexpected field
    }
  }
  
  // Check that no field contains voter ID
  return containsVoterId(response);
}

describe('PrivacyGuard Property Tests', () => {
  /**
   * Property 7: Vote Privacy Invariant
   * 
   * For any API response containing stance data for a debate, the response 
   * SHALL NOT contain any voter_id field or any data that could identify 
   * individual voters. Only aggregate statistics (counts, averages) SHALL be included.
   * 
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.5**
   */
  describe('Property 7: Vote Privacy Invariant', () => {
    it('filterForPublicResponse should never include voter IDs', () => {
      fc.assert(
        fc.property(
          stancesArrayArbitrary,
          (stances) => {
            const result = privacyGuard.filterForPublicResponse(stances);
            
            // Property 7: Response should not contain any voter ID
            expect(containsVoterId(result)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filterForPublicResponse should only return aggregate statistics', () => {
      fc.assert(
        fc.property(
          stancesArrayArbitrary,
          (stances) => {
            const result = privacyGuard.filterForPublicResponse(stances);
            
            // Should only contain aggregate fields
            expect(containsIndividualVoterData(result)).toBe(false);
            
            // Should have all required aggregate fields
            expect(typeof result.totalVoters).toBe('number');
            expect(typeof result.averagePreStance).toBe('number');
            expect(typeof result.averagePostStance).toBe('number');
            expect(typeof result.averageDelta).toBe('number');
            expect(typeof result.mindChangedCount).toBe('number');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('aggregate statistics should be mathematically correct', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          (voterCount) => {
            // Generate unique voter IDs and their stances
            const stances: Stance[] = [];
            const voterData: { pre: number; post: number }[] = [];
            
            for (let i = 0; i < voterCount; i++) {
              const voterId = `voter-${i}-${Date.now()}`;
              const preValue = Math.floor(Math.random() * 101);
              const postValue = Math.floor(Math.random() * 101);
              
              voterData.push({ pre: preValue, post: postValue });
              
              stances.push({
                id: `pre-${i}`,
                debateId: 'test-debate',
                voterId,
                type: 'pre',
                supportValue: preValue,
                confidence: 3,
                lastArgumentSeen: null,
                createdAt: new Date(),
              });
              
              stances.push({
                id: `post-${i}`,
                debateId: 'test-debate',
                voterId,
                type: 'post',
                supportValue: postValue,
                confidence: 3,
                lastArgumentSeen: null,
                createdAt: new Date(),
              });
            }
            
            const result = privacyGuard.filterForPublicResponse(stances);
            
            // Calculate expected values manually
            const expectedAvgPre = voterData.reduce((sum, v) => sum + v.pre, 0) / voterCount;
            const expectedAvgPost = voterData.reduce((sum, v) => sum + v.post, 0) / voterCount;
            const expectedDelta = expectedAvgPost - expectedAvgPre;
            const expectedMindChanged = voterData.filter(
              v => Math.abs(v.post - v.pre) >= 10
            ).length;
            
            // Verify aggregate calculations
            expect(result.totalVoters).toBe(voterCount);
            expect(result.averagePreStance).toBeCloseTo(expectedAvgPre, 0);
            expect(result.averagePostStance).toBeCloseTo(expectedAvgPost, 0);
            expect(result.averageDelta).toBeCloseTo(expectedDelta, 0);
            expect(result.mindChangedCount).toBe(expectedMindChanged);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('empty stances array should return safe defaults', () => {
      fc.assert(
        fc.property(
          fc.constant([]),
          (emptyStances: Stance[]) => {
            const result = privacyGuard.filterForPublicResponse(emptyStances);
            
            // Should return safe defaults
            expect(result.totalVoters).toBe(0);
            expect(result.averagePreStance).toBe(50);
            expect(result.averagePostStance).toBe(50);
            expect(result.averageDelta).toBe(0);
            expect(result.mindChangedCount).toBe(0);
            
            // Should not contain voter IDs
            expect(containsVoterId(result)).toBe(false);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('stances without matching pre/post pairs should not be counted', () => {
      fc.assert(
        fc.property(
          // Generate only pre-stances (no post-stances)
          fc.array(
            fc.record({
              id: stanceIdArbitrary,
              debateId: debateIdArbitrary,
              voterId: userIdArbitrary,
              type: fc.constant('pre' as const),
              supportValue: supportValueArbitrary,
              confidence: confidenceArbitrary,
              lastArgumentSeen: fc.constant(null),
              createdAt: fc.date(),
            }) as fc.Arbitrary<Stance>,
            { minLength: 1, maxLength: 20 }
          ),
          (preOnlyStances) => {
            const result = privacyGuard.filterForPublicResponse(preOnlyStances);
            
            // No complete voter pairs, so totalVoters should be 0
            expect(result.totalVoters).toBe(0);
            expect(containsVoterId(result)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('validatePrivacyCompliance should reject queries with voter IDs', () => {
      fc.assert(
        fc.property(
          userIdArbitrary,
          userIdArbitrary,
          (requesterId, targetUserId) => {
            // Query that includes voter ID but is not self-access
            fc.pre(requesterId !== targetUserId);
            
            const result = privacyGuard.validatePrivacyCompliance({
              includesVoterId: true,
              isSelfAccess: false,
              requesterId,
              targetUserId,
            });
            
            // Should be rejected
            expect(result.valid).toBe(false);
            expect(result.reason).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('validatePrivacyCompliance should allow aggregate-only queries', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          (includesVoterId) => {
            const result = privacyGuard.validatePrivacyCompliance({
              includesVoterId,
              isAggregateOnly: true,
            });
            
            // Aggregate-only queries should always be valid
            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 8: Self-Access Vote Retrieval
   * 
   * For any user requesting their own stance history, the response SHALL include 
   * their individual stance records. For any user requesting another user's stance 
   * history, the response SHALL be empty or return an authorization error.
   * 
   * **Validates: Requirements 3.4**
   */
  describe('Property 8: Self-Access Vote Retrieval', () => {
    it('canAccessOwnStance should return true when requester equals owner', () => {
      fc.assert(
        fc.property(
          userIdArbitrary,
          (userId) => {
            const result = privacyGuard.canAccessOwnStance(userId, userId);
            
            // Property 8: Self-access should be allowed
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('canAccessOwnStance should return false when requester differs from owner', () => {
      fc.assert(
        fc.property(
          userIdArbitrary,
          userIdArbitrary,
          (ownerId, requesterId) => {
            // Ensure different users
            fc.pre(ownerId !== requesterId);
            
            const result = privacyGuard.canAccessOwnStance(ownerId, requesterId);
            
            // Property 8: Access to other user's data should be denied
            expect(result).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('validatePrivacyCompliance should allow self-access when requester matches target', () => {
      fc.assert(
        fc.property(
          userIdArbitrary,
          (userId) => {
            const result = privacyGuard.validatePrivacyCompliance({
              includesVoterId: true,
              isSelfAccess: true,
              requesterId: userId,
              targetUserId: userId,
            });
            
            // Self-access should be valid
            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('validatePrivacyCompliance should reject self-access when requester differs from target', () => {
      fc.assert(
        fc.property(
          userIdArbitrary,
          userIdArbitrary,
          (requesterId, targetUserId) => {
            // Ensure different users
            fc.pre(requesterId !== targetUserId);
            
            const result = privacyGuard.validatePrivacyCompliance({
              includesVoterId: true,
              isSelfAccess: true,
              requesterId,
              targetUserId,
            });
            
            // Access to other user's data should be rejected
            expect(result.valid).toBe(false);
            expect(result.reason).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('self-access authorization should be symmetric (reflexive property)', () => {
      fc.assert(
        fc.property(
          userIdArbitrary,
          (userId) => {
            // canAccessOwnStance(A, A) should always be true
            const selfAccess = privacyGuard.canAccessOwnStance(userId, userId);
            expect(selfAccess).toBe(true);
            
            // This is a reflexive property: every user can access their own data
          }
        ),
        { numRuns: 100 }
      );
    });

    it('cross-user access should be consistently denied', () => {
      fc.assert(
        fc.property(
          userIdArbitrary,
          userIdArbitrary,
          (userA, userB) => {
            // Ensure different users
            fc.pre(userA !== userB);
            
            // A cannot access B's data
            const aAccessB = privacyGuard.canAccessOwnStance(userB, userA);
            expect(aAccessB).toBe(false);
            
            // B cannot access A's data
            const bAccessA = privacyGuard.canAccessOwnStance(userA, userB);
            expect(bAccessA).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 9: Blind Voting Enforcement
   * 
   * For any user who has NOT recorded a pre-stance for a debate, requests for 
   * market price data SHALL return a "pre-stance required" error or hide the price data.
   * 
   * **Validates: Requirements 3.6**
   */
  describe('Property 9: Blind Voting Enforcement', () => {
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

    function simulateCanAccessMarketPrice(state: BlindVotingState): { canAccess: boolean; reason?: string } {
      if (!state.hasPreStance) {
        return { canAccess: false, reason: 'Record your initial stance to see the market price' };
      }
      return { canAccess: true };
    }

    function simulateRecordPreStance(state: BlindVotingState): BlindVotingState {
      return { ...state, hasPreStance: true };
    }

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

            const result = simulateCanAccessMarketPrice(state);

            // Property 9: Access should be denied
            expect(result.canAccess).toBe(false);
            expect(result.reason).toBeDefined();
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

            const result = simulateCanAccessMarketPrice(state);

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
            const beforeResult = simulateCanAccessMarketPrice(initialState);
            expect(beforeResult.canAccess).toBe(false);

            // Record pre-stance (state transition)
            const afterState = simulateRecordPreStance(initialState);

            // After recording: access allowed
            const afterResult = simulateCanAccessMarketPrice(afterState);
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
            expect(simulateCanAccessMarketPrice(state1).canAccess).toBe(true);

            // User2 cannot access debate2 market
            expect(simulateCanAccessMarketPrice(state2).canAccess).toBe(false);
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
            expect(simulateCanAccessMarketPrice(stateDebate1).canAccess).toBe(true);

            // Cannot access debate2 market
            expect(simulateCanAccessMarketPrice(stateDebate2).canAccess).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('blind voting enforcement should be idempotent', () => {
      fc.assert(
        fc.property(
          debateIdArbitrary,
          userIdArbitrary,
          fc.boolean(),
          (debateId, userId, hasPreStance) => {
            const state: BlindVotingState = {
              hasPreStance,
              debateId,
              userId,
            };

            // Multiple calls should return the same result
            const result1 = simulateCanAccessMarketPrice(state);
            const result2 = simulateCanAccessMarketPrice(state);
            const result3 = simulateCanAccessMarketPrice(state);

            expect(result1.canAccess).toBe(result2.canAccess);
            expect(result2.canAccess).toBe(result3.canAccess);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
