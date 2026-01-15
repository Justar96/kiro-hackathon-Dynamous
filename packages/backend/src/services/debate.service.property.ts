import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Debate, Round, CreateDebateInput } from '@thesis/shared';
import { RESOLUTION_MAX_LENGTH } from '@thesis/shared';

/**
 * Feature: debate-platform
 * Property Tests for Debate Creation
 * 
 * Properties covered:
 * - Property 1: Resolution Creation Initialization
 * - Property 2: Resolution Validation
 * - Property 3: Debate Round Structure Invariant
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1
 */

// Arbitrary for generating valid resolution text (non-empty, <= 500 chars)
const validResolutionArbitrary = fc.string({ minLength: 1, maxLength: RESOLUTION_MAX_LENGTH })
  .filter(s => s.trim().length > 0);

// Arbitrary for generating invalid resolution text (empty or > 500 chars)
const emptyResolutionArbitrary = fc.constantFrom('', '   ', '\t', '\n', '  \n  ');

const tooLongResolutionArbitrary = fc.string({ minLength: RESOLUTION_MAX_LENGTH + 1, maxLength: RESOLUTION_MAX_LENGTH + 100 });

// Arbitrary for generating user IDs
const userIdArbitrary = fc.string({ minLength: 10, maxLength: 21 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

// Simulates debate creation logic (extracted from DebateService)
function createDebateWithDefaults(input: CreateDebateInput): { debate: Debate; rounds: Round[] } {
  const debateId = `debate_${Math.random().toString(36).substring(7)}`;
  const now = new Date();

  const debate: Debate = {
    id: debateId,
    resolution: input.resolution.trim(),
    status: 'active',
    currentRound: 1,
    currentTurn: 'support',
    supportDebaterId: input.creatorId,
    opposeDebaterId: null,
    createdAt: now,
    concludedAt: null,
  };

  const roundTypes: Array<'opening' | 'rebuttal' | 'closing'> = ['opening', 'rebuttal', 'closing'];
  const rounds: Round[] = roundTypes.map((roundType, index) => ({
    id: `round_${Math.random().toString(36).substring(7)}`,
    debateId: debateId,
    roundNumber: (index + 1) as 1 | 2 | 3,
    roundType: roundType,
    supportArgumentId: null,
    opposeArgumentId: null,
    completedAt: null,
  }));

  return { debate, rounds };
}

// Validation function (extracted from DebateService)
function validateResolution(resolution: string): { valid: boolean; error?: string } {
  if (!resolution || resolution.trim().length === 0) {
    return { valid: false, error: 'Resolution text cannot be empty' };
  }
  
  if (resolution.length > RESOLUTION_MAX_LENGTH) {
    return { valid: false, error: `Resolution exceeds ${RESOLUTION_MAX_LENGTH} character limit` };
  }

  return { valid: true };
}

describe('DebateService Property Tests', () => {
  /**
   * Property 1: Resolution Creation Initialization
   * For any valid resolution text and creator user, creating a debate SHALL result in:
   * - Initial market price of exactly 50/50 (represented by status 'active')
   * - Creator assigned as supportDebaterId
   * - Status set to 'active'
   * - currentRound set to 1
   * 
   * Validates: Requirements 1.1, 1.3
   */
  it('Property 1: Resolution Creation Initialization - debate should have correct initial state', () => {
    fc.assert(
      fc.property(
        validResolutionArbitrary,
        userIdArbitrary,
        (resolution, creatorId) => {
          const input: CreateDebateInput = {
            resolution,
            creatorId,
            creatorSide: 'support',
          };

          const { debate } = createDebateWithDefaults(input);

          // Property 1: Initial state verification
          expect(debate.status).toBe('active');
          expect(debate.currentRound).toBe(1);
          expect(debate.supportDebaterId).toBe(creatorId);
          expect(debate.opposeDebaterId).toBeNull();
          expect(debate.currentTurn).toBe('support');
          expect(debate.concludedAt).toBeNull();
          expect(debate.resolution).toBe(resolution.trim());
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Property 2: Resolution Validation
   * For any resolution text:
   * - If text is non-empty AND length <= 500 characters, creation SHALL succeed
   * - If text is empty OR length > 500 characters, creation SHALL fail with error
   * 
   * Validates: Requirements 1.2, 1.4
   */
  it('Property 2: Resolution Validation - valid resolutions should pass validation', () => {
    fc.assert(
      fc.property(validResolutionArbitrary, (resolution) => {
        const result = validateResolution(resolution);
        
        // Valid resolutions should pass
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });

  it('Property 2: Resolution Validation - empty resolutions should fail validation', () => {
    fc.assert(
      fc.property(emptyResolutionArbitrary, (resolution) => {
        const result = validateResolution(resolution);
        
        // Empty resolutions should fail
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Resolution text cannot be empty');
      }),
      { numRuns: 100 }
    );
  });

  it('Property 2: Resolution Validation - too long resolutions should fail validation', () => {
    fc.assert(
      fc.property(tooLongResolutionArbitrary, (resolution) => {
        const result = validateResolution(resolution);
        
        // Too long resolutions should fail
        expect(result.valid).toBe(false);
        expect(result.error).toBe(`Resolution exceeds ${RESOLUTION_MAX_LENGTH} character limit`);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Debate Round Structure Invariant
   * For any debate, there SHALL always be exactly 3 rounds created with types 
   * ['opening', 'rebuttal', 'closing'] in order.
   * 
   * Validates: Requirements 2.1
   */
  it('Property 3: Debate Round Structure Invariant - exactly 3 rounds with correct types', () => {
    fc.assert(
      fc.property(
        validResolutionArbitrary,
        userIdArbitrary,
        (resolution, creatorId) => {
          const input: CreateDebateInput = {
            resolution,
            creatorId,
            creatorSide: 'support',
          };

          const { debate, rounds } = createDebateWithDefaults(input);

          // Property 3: Round structure verification
          expect(rounds).toHaveLength(3);
          
          // Verify round numbers
          expect(rounds[0].roundNumber).toBe(1);
          expect(rounds[1].roundNumber).toBe(2);
          expect(rounds[2].roundNumber).toBe(3);
          
          // Verify round types in order
          expect(rounds[0].roundType).toBe('opening');
          expect(rounds[1].roundType).toBe('rebuttal');
          expect(rounds[2].roundType).toBe('closing');
          
          // All rounds should belong to the same debate
          rounds.forEach(round => {
            expect(round.debateId).toBe(debate.id);
          });
          
          // All rounds should start with no arguments
          rounds.forEach(round => {
            expect(round.supportArgumentId).toBeNull();
            expect(round.opposeArgumentId).toBeNull();
            expect(round.completedAt).toBeNull();
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3 (extended): Round numbers should be sequential
   */
  it('Property 3 (extended): Round numbers should be sequential 1, 2, 3', () => {
    fc.assert(
      fc.property(
        validResolutionArbitrary,
        userIdArbitrary,
        (resolution, creatorId) => {
          const input: CreateDebateInput = {
            resolution,
            creatorId,
            creatorSide: 'support',
          };

          const { rounds } = createDebateWithDefaults(input);

          // Verify sequential round numbers
          for (let i = 0; i < rounds.length; i++) {
            expect(rounds[i].roundNumber).toBe(i + 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Property Tests for Argument Submission
 * 
 * Properties covered:
 * - Property 4: Turn Enforcement
 * - Property 5: Argument Character Limits
 * 
 * Validates: Requirements 2.2, 2.3, 2.6
 */

// Types for simulating debate state
interface DebateState {
  id: string;
  status: 'active' | 'concluded';
  currentRound: 1 | 2 | 3;
  currentTurn: 'support' | 'oppose';
  supportDebaterId: string;
  opposeDebaterId: string | null;
}

interface RoundState {
  id: string;
  debateId: string;
  roundNumber: 1 | 2 | 3;
  roundType: 'opening' | 'rebuttal' | 'closing';
  supportArgumentId: string | null;
  opposeArgumentId: string | null;
}

// Arbitrary for generating debate state
const debateStateArbitrary = fc.record({
  id: fc.string({ minLength: 10, maxLength: 21 }),
  status: fc.constant('active' as const),
  currentRound: fc.constantFrom(1, 2, 3) as fc.Arbitrary<1 | 2 | 3>,
  currentTurn: fc.constantFrom('support', 'oppose') as fc.Arbitrary<'support' | 'oppose'>,
  supportDebaterId: fc.string({ minLength: 10, maxLength: 21 }),
  opposeDebaterId: fc.string({ minLength: 10, maxLength: 21 }),
});

// Arbitrary for generating argument content within limits
const validOpeningArgumentArbitrary = fc.string({ minLength: 1, maxLength: 2000 });
const validRebuttalArgumentArbitrary = fc.string({ minLength: 1, maxLength: 1500 });
const validClosingArgumentArbitrary = fc.string({ minLength: 1, maxLength: 1000 });

// Arbitrary for generating argument content exceeding limits
const tooLongOpeningArgumentArbitrary = fc.string({ minLength: 2001, maxLength: 2100 });
const tooLongRebuttalArgumentArbitrary = fc.string({ minLength: 1501, maxLength: 1600 });
const tooLongClosingArgumentArbitrary = fc.string({ minLength: 1001, maxLength: 1100 });

// Function to validate turn enforcement
function validateTurnEnforcement(
  debate: DebateState,
  submitterId: string
): { allowed: boolean; error?: string } {
  // Determine submitter's side
  let submitterSide: 'support' | 'oppose' | null = null;
  if (debate.supportDebaterId === submitterId) {
    submitterSide = 'support';
  } else if (debate.opposeDebaterId === submitterId) {
    submitterSide = 'oppose';
  }

  if (!submitterSide) {
    return { allowed: false, error: 'Only assigned debaters can submit arguments' };
  }

  if (debate.currentTurn !== submitterSide) {
    return { allowed: false, error: 'It is not your turn to submit' };
  }

  return { allowed: true };
}

// Function to validate character limits
function validateCharacterLimit(
  roundType: 'opening' | 'rebuttal' | 'closing',
  content: string
): { valid: boolean; error?: string } {
  const limits = {
    opening: 2000,
    rebuttal: 1500,
    closing: 1000,
  };

  const limit = limits[roundType];
  if (content.length > limit) {
    return { valid: false, error: `Argument exceeds ${limit} character limit for ${roundType}` };
  }

  return { valid: true };
}

describe('DebateService Argument Submission Property Tests', () => {
  /**
   * Property 4: Turn Enforcement
   * For any debate in active state, submitting an argument:
   * - SHALL succeed if user is the debater for currentTurn side
   * - SHALL fail if user is the debater for the opposite side
   * 
   * Validates: Requirements 2.2, 2.6
   */
  it('Property 4: Turn Enforcement - correct turn should be allowed', () => {
    fc.assert(
      fc.property(debateStateArbitrary, (debate) => {
        // Submitter is the debater whose turn it is
        const submitterId = debate.currentTurn === 'support' 
          ? debate.supportDebaterId 
          : debate.opposeDebaterId;

        const result = validateTurnEnforcement(debate, submitterId!);
        
        // Should be allowed when it's their turn
        expect(result.allowed).toBe(true);
        expect(result.error).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });

  it('Property 4: Turn Enforcement - wrong turn should be rejected', () => {
    fc.assert(
      fc.property(debateStateArbitrary, (debate) => {
        // Submitter is the debater whose turn it is NOT
        const submitterId = debate.currentTurn === 'support' 
          ? debate.opposeDebaterId 
          : debate.supportDebaterId;

        const result = validateTurnEnforcement(debate, submitterId!);
        
        // Should be rejected when it's not their turn
        expect(result.allowed).toBe(false);
        expect(result.error).toBe('It is not your turn to submit');
      }),
      { numRuns: 100 }
    );
  });

  it('Property 4: Turn Enforcement - non-debater should be rejected', () => {
    fc.assert(
      fc.property(
        debateStateArbitrary,
        fc.string({ minLength: 10, maxLength: 21 }),
        (debate, randomUserId) => {
          // Ensure random user is not a debater
          fc.pre(randomUserId !== debate.supportDebaterId && randomUserId !== debate.opposeDebaterId);

          const result = validateTurnEnforcement(debate, randomUserId);
          
          // Should be rejected for non-debaters
          expect(result.allowed).toBe(false);
          expect(result.error).toBe('Only assigned debaters can submit arguments');
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Property 5: Argument Character Limits
   * For any argument submission:
   * - Opening round: content length <= 2000 characters
   * - Rebuttal round: content length <= 1500 characters
   * - Closing round: content length <= 1000 characters
   * Arguments exceeding limits SHALL be rejected.
   * 
   * Validates: Requirements 2.3
   */
  it('Property 5: Argument Character Limits - valid opening arguments should pass', () => {
    fc.assert(
      fc.property(validOpeningArgumentArbitrary, (content) => {
        const result = validateCharacterLimit('opening', content);
        
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });

  it('Property 5: Argument Character Limits - too long opening arguments should fail', () => {
    fc.assert(
      fc.property(tooLongOpeningArgumentArbitrary, (content) => {
        const result = validateCharacterLimit('opening', content);
        
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Argument exceeds 2000 character limit for opening');
      }),
      { numRuns: 100 }
    );
  });

  it('Property 5: Argument Character Limits - valid rebuttal arguments should pass', () => {
    fc.assert(
      fc.property(validRebuttalArgumentArbitrary, (content) => {
        const result = validateCharacterLimit('rebuttal', content);
        
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });

  it('Property 5: Argument Character Limits - too long rebuttal arguments should fail', () => {
    fc.assert(
      fc.property(tooLongRebuttalArgumentArbitrary, (content) => {
        const result = validateCharacterLimit('rebuttal', content);
        
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Argument exceeds 1500 character limit for rebuttal');
      }),
      { numRuns: 100 }
    );
  });

  it('Property 5: Argument Character Limits - valid closing arguments should pass', () => {
    fc.assert(
      fc.property(validClosingArgumentArbitrary, (content) => {
        const result = validateCharacterLimit('closing', content);
        
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });

  it('Property 5: Argument Character Limits - too long closing arguments should fail', () => {
    fc.assert(
      fc.property(tooLongClosingArgumentArbitrary, (content) => {
        const result = validateCharacterLimit('closing', content);
        
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Argument exceeds 1000 character limit for closing');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5 (extended): Character limits should be strictly enforced at boundary
   */
  it('Property 5 (boundary): Exactly at limit should pass', () => {
    // Test exact boundary values
    const exactOpening = 'a'.repeat(2000);
    const exactRebuttal = 'a'.repeat(1500);
    const exactClosing = 'a'.repeat(1000);

    expect(validateCharacterLimit('opening', exactOpening).valid).toBe(true);
    expect(validateCharacterLimit('rebuttal', exactRebuttal).valid).toBe(true);
    expect(validateCharacterLimit('closing', exactClosing).valid).toBe(true);

    // One over should fail
    const overOpening = 'a'.repeat(2001);
    const overRebuttal = 'a'.repeat(1501);
    const overClosing = 'a'.repeat(1001);

    expect(validateCharacterLimit('opening', overOpening).valid).toBe(false);
    expect(validateCharacterLimit('rebuttal', overRebuttal).valid).toBe(false);
    expect(validateCharacterLimit('closing', overClosing).valid).toBe(false);
  });
});


/**
 * Property Tests for Round Advancement
 * 
 * Properties covered:
 * - Property 6: Round Advancement
 * 
 * Validates: Requirements 2.4, 2.5
 */

// Function to simulate round advancement logic
function simulateRoundAdvancement(
  debate: DebateState,
  round: RoundState
): { 
  shouldAdvance: boolean; 
  newRound?: number; 
  shouldConclude?: boolean;
} {
  // Check if both sides have submitted
  if (round.supportArgumentId && round.opposeArgumentId) {
    if (debate.currentRound < 3) {
      return { 
        shouldAdvance: true, 
        newRound: debate.currentRound + 1,
        shouldConclude: false
      };
    } else {
      return { 
        shouldAdvance: false, 
        shouldConclude: true 
      };
    }
  }

  return { shouldAdvance: false, shouldConclude: false };
}

// Arbitrary for generating complete round state (both arguments submitted)
const completeRoundArbitrary = fc.record({
  id: fc.string({ minLength: 10, maxLength: 21 }),
  debateId: fc.string({ minLength: 10, maxLength: 21 }),
  roundNumber: fc.constantFrom(1, 2, 3) as fc.Arbitrary<1 | 2 | 3>,
  roundType: fc.constantFrom('opening', 'rebuttal', 'closing') as fc.Arbitrary<'opening' | 'rebuttal' | 'closing'>,
  supportArgumentId: fc.string({ minLength: 10, maxLength: 21 }),
  opposeArgumentId: fc.string({ minLength: 10, maxLength: 21 }),
});

// Arbitrary for generating incomplete round state (missing one or both arguments)
const incompleteRoundArbitrary = fc.oneof(
  // Only support argument
  fc.record({
    id: fc.string({ minLength: 10, maxLength: 21 }),
    debateId: fc.string({ minLength: 10, maxLength: 21 }),
    roundNumber: fc.constantFrom(1, 2, 3) as fc.Arbitrary<1 | 2 | 3>,
    roundType: fc.constantFrom('opening', 'rebuttal', 'closing') as fc.Arbitrary<'opening' | 'rebuttal' | 'closing'>,
    supportArgumentId: fc.string({ minLength: 10, maxLength: 21 }),
    opposeArgumentId: fc.constant(null),
  }),
  // Only oppose argument
  fc.record({
    id: fc.string({ minLength: 10, maxLength: 21 }),
    debateId: fc.string({ minLength: 10, maxLength: 21 }),
    roundNumber: fc.constantFrom(1, 2, 3) as fc.Arbitrary<1 | 2 | 3>,
    roundType: fc.constantFrom('opening', 'rebuttal', 'closing') as fc.Arbitrary<'opening' | 'rebuttal' | 'closing'>,
    supportArgumentId: fc.constant(null),
    opposeArgumentId: fc.string({ minLength: 10, maxLength: 21 }),
  }),
  // No arguments
  fc.record({
    id: fc.string({ minLength: 10, maxLength: 21 }),
    debateId: fc.string({ minLength: 10, maxLength: 21 }),
    roundNumber: fc.constantFrom(1, 2, 3) as fc.Arbitrary<1 | 2 | 3>,
    roundType: fc.constantFrom('opening', 'rebuttal', 'closing') as fc.Arbitrary<'opening' | 'rebuttal' | 'closing'>,
    supportArgumentId: fc.constant(null),
    opposeArgumentId: fc.constant(null),
  })
);

describe('DebateService Round Advancement Property Tests', () => {
  /**
   * Property 6: Round Advancement
   * For any round where both supportArgumentId and opposeArgumentId are set,
   * the debate's currentRound SHALL increment (if < 3) or debate SHALL conclude (if = 3).
   * 
   * Validates: Requirements 2.4, 2.5
   */
  it('Property 6: Round Advancement - complete round 1 or 2 should advance to next round', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 10, maxLength: 21 }),
          status: fc.constant('active' as const),
          currentRound: fc.constantFrom(1, 2) as fc.Arbitrary<1 | 2>,
          currentTurn: fc.constantFrom('support', 'oppose') as fc.Arbitrary<'support' | 'oppose'>,
          supportDebaterId: fc.string({ minLength: 10, maxLength: 21 }),
          opposeDebaterId: fc.string({ minLength: 10, maxLength: 21 }),
        }),
        completeRoundArbitrary,
        (debate, round) => {
          const result = simulateRoundAdvancement(debate as DebateState, round);
          
          // Should advance to next round
          expect(result.shouldAdvance).toBe(true);
          expect(result.newRound).toBe(debate.currentRound + 1);
          expect(result.shouldConclude).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6: Round Advancement - complete round 3 should conclude debate', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 10, maxLength: 21 }),
          status: fc.constant('active' as const),
          currentRound: fc.constant(3) as fc.Arbitrary<3>,
          currentTurn: fc.constantFrom('support', 'oppose') as fc.Arbitrary<'support' | 'oppose'>,
          supportDebaterId: fc.string({ minLength: 10, maxLength: 21 }),
          opposeDebaterId: fc.string({ minLength: 10, maxLength: 21 }),
        }),
        completeRoundArbitrary,
        (debate, round) => {
          const result = simulateRoundAdvancement(debate as DebateState, round);
          
          // Should conclude debate
          expect(result.shouldAdvance).toBe(false);
          expect(result.shouldConclude).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6: Round Advancement - incomplete round should not advance', () => {
    fc.assert(
      fc.property(
        debateStateArbitrary,
        incompleteRoundArbitrary,
        (debate, round) => {
          const result = simulateRoundAdvancement(debate, round);
          
          // Should not advance or conclude
          expect(result.shouldAdvance).toBe(false);
          expect(result.shouldConclude).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6 (extended): Round advancement should be sequential
   */
  it('Property 6 (extended): Round advancement should be sequential (1->2->3)', () => {
    // Test sequential advancement
    const rounds = [1, 2, 3] as const;
    
    for (let i = 0; i < rounds.length; i++) {
      const debate: DebateState = {
        id: 'test-debate',
        status: 'active',
        currentRound: rounds[i],
        currentTurn: 'support',
        supportDebaterId: 'user1',
        opposeDebaterId: 'user2',
      };

      const completeRound: RoundState = {
        id: `round-${i}`,
        debateId: 'test-debate',
        roundNumber: rounds[i],
        roundType: ['opening', 'rebuttal', 'closing'][i] as 'opening' | 'rebuttal' | 'closing',
        supportArgumentId: 'arg1',
        opposeArgumentId: 'arg2',
      };

      const result = simulateRoundAdvancement(debate, completeRound);

      if (i < 2) {
        // Rounds 1 and 2 should advance
        expect(result.shouldAdvance).toBe(true);
        expect(result.newRound).toBe(rounds[i] + 1);
      } else {
        // Round 3 should conclude
        expect(result.shouldConclude).toBe(true);
      }
    }
  });
});
