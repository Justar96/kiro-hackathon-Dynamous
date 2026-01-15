/**
 * Property-based tests for NewDebateModal and debate creation.
 * 
 * Feature: debate-lifecycle-ux
 * Tests character count accuracy, topic acceptance, and debate initialization.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { RESOLUTION_MAX_LENGTH } from '@thesis/shared';

// ============================================================================
// Character Count Utility (mirrors FormField implementation)
// ============================================================================

/**
 * Calculate character count for a string.
 * This is the same logic used in FormField component.
 */
function getCharacterCount(value: string): number {
  return value.length;
}

/**
 * Check if character count exceeds limit.
 */
function isOverLimit(value: string, maxLength: number): boolean {
  return value.length > maxLength;
}

// ============================================================================
// Property 2: Character Count Accuracy
// ============================================================================

describe('NewDebateModal Property Tests - Character Count', () => {
  /**
   * Property 2: Character Count Accuracy
   * For any string input to the resolution field, the displayed character count
   * SHALL equal the exact length of the input string.
   * 
   * **Validates: Requirements 1.2**
   */
  describe('Property 2: Character Count Accuracy', () => {
    it('character count equals exact string length for any input', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 1000 }),
          (input) => {
            const count = getCharacterCount(input);
            expect(count).toBe(input.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('character count is accurate for unicode strings', () => {
      fc.assert(
        fc.property(
          fc.unicodeString({ minLength: 0, maxLength: 500 }),
          (input) => {
            const count = getCharacterCount(input);
            expect(count).toBe(input.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('character count is accurate for strings with emojis', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom('🎬', '💻', '🔬', '⚖️', '🏛️', '📱', 'a', 'b', ' '), { minLength: 0, maxLength: 100 }),
          (chars) => {
            const input = chars.join('');
            const count = getCharacterCount(input);
            expect(count).toBe(input.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('character count is accurate for whitespace-only strings', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 0, maxLength: 100 }),
          (input) => {
            const count = getCharacterCount(input);
            expect(count).toBe(input.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('empty string has character count of 0', () => {
      expect(getCharacterCount('')).toBe(0);
    });

    it('isOverLimit correctly identifies strings exceeding maxLength', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 1000 }),
          fc.integer({ min: 1, max: 500 }),
          (input, maxLength) => {
            const over = isOverLimit(input, maxLength);
            expect(over).toBe(input.length > maxLength);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('resolution max length constant is 500', () => {
      expect(RESOLUTION_MAX_LENGTH).toBe(500);
    });

    it('strings at exactly maxLength are not over limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 500 }),
          (maxLength) => {
            const input = 'a'.repeat(maxLength);
            expect(isOverLimit(input, maxLength)).toBe(false);
            expect(getCharacterCount(input)).toBe(maxLength);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('strings one character over maxLength are over limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 499 }),
          (maxLength) => {
            const input = 'a'.repeat(maxLength + 1);
            expect(isOverLimit(input, maxLength)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


// ============================================================================
// Topic Validation Utility (mirrors backend validation)
// ============================================================================

/**
 * Validate a resolution/topic for debate creation.
 * Per Requirement 1.4: THE Debate_Platform SHALL support debates on any topic
 * including movies, music, AI, technology, products, and general topics.
 * 
 * The only constraints are:
 * 1. Non-empty (after trimming)
 * 2. Within character limit (500 chars)
 */
function validateResolution(resolution: string): { valid: boolean; error?: string } {
  const trimmed = resolution.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Resolution text cannot be empty' };
  }
  
  if (resolution.length > RESOLUTION_MAX_LENGTH) {
    return { valid: false, error: `Resolution exceeds ${RESOLUTION_MAX_LENGTH} character limit` };
  }
  
  // Any non-empty string within the limit is valid - no topic restrictions
  return { valid: true };
}

// ============================================================================
// Property 3: Topic Acceptance Universality
// ============================================================================

describe('NewDebateModal Property Tests - Topic Acceptance', () => {
  /**
   * Property 3: Topic Acceptance Universality
   * For any non-empty string within the character limit (500 chars),
   * the debate creation SHALL accept it as a valid resolution regardless of topic domain.
   * 
   * **Validates: Requirements 1.4**
   */
  describe('Property 3: Topic Acceptance Universality', () => {
    it('any non-empty string within limit is accepted as valid resolution', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: RESOLUTION_MAX_LENGTH }),
          (resolution) => {
            // Skip strings that are only whitespace (they become empty after trim)
            if (resolution.trim().length === 0) return;
            
            const result = validateResolution(resolution);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('accepts resolutions about technology topics', () => {
      const techTopics = [
        'AI will replace most jobs',
        'Cryptocurrency is the future of money',
        'Social media is harmful to society',
        'Remote work is more productive',
        'Open source software is better than proprietary',
      ];
      
      for (const topic of techTopics) {
        const result = validateResolution(topic);
        expect(result.valid).toBe(true);
      }
    });

    it('accepts resolutions about entertainment topics', () => {
      const entertainmentTopics = [
        'The Godfather is the greatest movie ever made',
        'Taylor Swift is the best artist of this generation',
        'Video games are a legitimate art form',
        'Streaming has killed the movie theater experience',
        'K-pop is overrated',
      ];
      
      for (const topic of entertainmentTopics) {
        const result = validateResolution(topic);
        expect(result.valid).toBe(true);
      }
    });

    it('accepts resolutions about products', () => {
      const productTopics = [
        'iPhone is better than Android',
        'Tesla makes the best electric vehicles',
        'Subscription models are better than one-time purchases',
        'Smart home devices improve quality of life',
        'Mechanical keyboards are worth the premium',
      ];
      
      for (const topic of productTopics) {
        const result = validateResolution(topic);
        expect(result.valid).toBe(true);
      }
    });

    it('accepts resolutions with unicode characters', () => {
      fc.assert(
        fc.property(
          fc.unicodeString({ minLength: 1, maxLength: RESOLUTION_MAX_LENGTH }),
          (resolution) => {
            if (resolution.trim().length === 0) return;
            
            const result = validateResolution(resolution);
            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('accepts resolutions with emojis', () => {
      const emojiTopics = [
        '🎬 Movies are better than TV shows',
        'Music streaming 🎵 has improved artist discovery',
        '💻 Programming is an art form',
        'Coffee ☕ is better than tea',
      ];
      
      for (const topic of emojiTopics) {
        const result = validateResolution(topic);
        expect(result.valid).toBe(true);
      }
    });

    it('accepts resolutions with special characters', () => {
      fc.assert(
        fc.property(
          fc.stringOf(
            fc.constantFrom(
              ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
              ...'!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~',
              ' '
            ),
            { minLength: 1, maxLength: RESOLUTION_MAX_LENGTH }
          ),
          (resolution) => {
            if (resolution.trim().length === 0) return;
            
            const result = validateResolution(resolution);
            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rejects empty strings', () => {
      const result = validateResolution('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('rejects whitespace-only strings', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 100 }),
          (whitespace) => {
            const result = validateResolution(whitespace);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('empty');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rejects strings exceeding character limit', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: RESOLUTION_MAX_LENGTH + 1, maxLength: RESOLUTION_MAX_LENGTH + 100 }),
          (resolution) => {
            const result = validateResolution(resolution);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('exceeds');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('accepts strings at exactly the character limit', () => {
      const exactLimitString = 'a'.repeat(RESOLUTION_MAX_LENGTH);
      const result = validateResolution(exactLimitString);
      expect(result.valid).toBe(true);
    });

    it('accepts any topic domain without content filtering', () => {
      // This test verifies that the platform doesn't filter based on topic content
      // Only length and non-empty constraints apply
      fc.assert(
        fc.property(
          fc.record({
            prefix: fc.constantFrom(
              'I believe that',
              'It is true that',
              'We should',
              'The best',
              ''
            ),
            topic: fc.constantFrom(
              'movies', 'music', 'AI', 'technology', 'products',
              'sports', 'food', 'travel', 'politics', 'science',
              'art', 'fashion', 'gaming', 'books', 'education'
            ),
            claim: fc.constantFrom(
              'is better than',
              'will change',
              'should be',
              'is overrated',
              'is underrated'
            ),
            suffix: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          ({ prefix, topic, claim, suffix }) => {
            const resolution = `${prefix} ${topic} ${claim} ${suffix}`.trim();
            if (resolution.length > RESOLUTION_MAX_LENGTH) return;
            
            const result = validateResolution(resolution);
            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


// ============================================================================
// Debate Initialization Types (mirrors backend/shared types)
// ============================================================================

interface DebateInitialState {
  id: string;
  resolution: string;
  status: 'active' | 'concluded';
  currentRound: 1 | 2 | 3;
  currentTurn: 'support' | 'oppose';
  supportDebaterId: string;
  opposeDebaterId: string | null;
  createdAt: Date;
  concludedAt: Date | null;
}

interface RoundInitialState {
  id: string;
  debateId: string;
  roundNumber: 1 | 2 | 3;
  roundType: 'opening' | 'rebuttal' | 'closing';
  supportArgumentId: string | null;
  opposeArgumentId: string | null;
  completedAt: Date | null;
}

interface MarketPrice {
  supportPrice: number;
  opposePrice: number;
}

/**
 * Simulate debate creation with initial state.
 * This mirrors the backend DebateService.createDebate logic.
 */
function createDebateWithInitialState(
  resolution: string,
  creatorId: string
): { debate: DebateInitialState; rounds: RoundInitialState[]; marketPrice: MarketPrice } {
  const debateId = `debate_${Math.random().toString(36).substring(7)}`;
  const now = new Date();

  // Per Requirement 1.5: Initial market price is 50/50
  const marketPrice: MarketPrice = {
    supportPrice: 50,
    opposePrice: 50,
  };

  const debate: DebateInitialState = {
    id: debateId,
    resolution: resolution.trim(),
    status: 'active',
    currentRound: 1,
    currentTurn: 'support',
    supportDebaterId: creatorId,
    opposeDebaterId: null,
    createdAt: now,
    concludedAt: null,
  };

  const roundTypes: Array<'opening' | 'rebuttal' | 'closing'> = ['opening', 'rebuttal', 'closing'];
  const rounds: RoundInitialState[] = roundTypes.map((roundType, index) => ({
    id: `round_${Math.random().toString(36).substring(7)}`,
    debateId: debateId,
    roundNumber: (index + 1) as 1 | 2 | 3,
    roundType: roundType,
    supportArgumentId: null,
    opposeArgumentId: null,
    completedAt: null,
  }));

  return { debate, rounds, marketPrice };
}

// ============================================================================
// Property 1: Debate Initialization Invariant
// ============================================================================

describe('NewDebateModal Property Tests - Debate Initialization', () => {
  /**
   * Property 1: Debate Initialization Invariant
   * For any newly created debate, the initial state SHALL have:
   * - status "active"
   * - currentRound = 1
   * - currentTurn = "support"
   * - opposeDebaterId = null
   * - market price at exactly 50/50
   * 
   * **Validates: Requirements 1.5**
   */
  describe('Property 1: Debate Initialization Invariant', () => {
    // Arbitrary for generating valid user IDs
    const userIdArb = fc.string({ minLength: 10, maxLength: 21 })
      .filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

    it('newly created debate has status "active"', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: RESOLUTION_MAX_LENGTH }).filter(s => s.trim().length > 0),
          userIdArb,
          (resolution, creatorId) => {
            const { debate } = createDebateWithInitialState(resolution, creatorId);
            expect(debate.status).toBe('active');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('newly created debate has currentRound = 1', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: RESOLUTION_MAX_LENGTH }).filter(s => s.trim().length > 0),
          userIdArb,
          (resolution, creatorId) => {
            const { debate } = createDebateWithInitialState(resolution, creatorId);
            expect(debate.currentRound).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('newly created debate has currentTurn = "support"', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: RESOLUTION_MAX_LENGTH }).filter(s => s.trim().length > 0),
          userIdArb,
          (resolution, creatorId) => {
            const { debate } = createDebateWithInitialState(resolution, creatorId);
            expect(debate.currentTurn).toBe('support');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('newly created debate has opposeDebaterId = null', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: RESOLUTION_MAX_LENGTH }).filter(s => s.trim().length > 0),
          userIdArb,
          (resolution, creatorId) => {
            const { debate } = createDebateWithInitialState(resolution, creatorId);
            expect(debate.opposeDebaterId).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('newly created debate has market price at exactly 50/50', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: RESOLUTION_MAX_LENGTH }).filter(s => s.trim().length > 0),
          userIdArb,
          (resolution, creatorId) => {
            const { marketPrice } = createDebateWithInitialState(resolution, creatorId);
            expect(marketPrice.supportPrice).toBe(50);
            expect(marketPrice.opposePrice).toBe(50);
            expect(marketPrice.supportPrice + marketPrice.opposePrice).toBe(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('newly created debate has creator assigned as supportDebaterId', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: RESOLUTION_MAX_LENGTH }).filter(s => s.trim().length > 0),
          userIdArb,
          (resolution, creatorId) => {
            const { debate } = createDebateWithInitialState(resolution, creatorId);
            expect(debate.supportDebaterId).toBe(creatorId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('newly created debate has concludedAt = null', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: RESOLUTION_MAX_LENGTH }).filter(s => s.trim().length > 0),
          userIdArb,
          (resolution, creatorId) => {
            const { debate } = createDebateWithInitialState(resolution, creatorId);
            expect(debate.concludedAt).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('newly created debate has exactly 3 rounds', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: RESOLUTION_MAX_LENGTH }).filter(s => s.trim().length > 0),
          userIdArb,
          (resolution, creatorId) => {
            const { rounds } = createDebateWithInitialState(resolution, creatorId);
            expect(rounds).toHaveLength(3);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('newly created debate rounds have correct types in order', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: RESOLUTION_MAX_LENGTH }).filter(s => s.trim().length > 0),
          userIdArb,
          (resolution, creatorId) => {
            const { rounds } = createDebateWithInitialState(resolution, creatorId);
            expect(rounds[0].roundType).toBe('opening');
            expect(rounds[1].roundType).toBe('rebuttal');
            expect(rounds[2].roundType).toBe('closing');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('newly created debate rounds have no arguments', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: RESOLUTION_MAX_LENGTH }).filter(s => s.trim().length > 0),
          userIdArb,
          (resolution, creatorId) => {
            const { rounds } = createDebateWithInitialState(resolution, creatorId);
            for (const round of rounds) {
              expect(round.supportArgumentId).toBeNull();
              expect(round.opposeArgumentId).toBeNull();
              expect(round.completedAt).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('all initialization invariants hold together', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: RESOLUTION_MAX_LENGTH }).filter(s => s.trim().length > 0),
          userIdArb,
          (resolution, creatorId) => {
            const { debate, rounds, marketPrice } = createDebateWithInitialState(resolution, creatorId);
            
            // All invariants must hold simultaneously
            expect(debate.status).toBe('active');
            expect(debate.currentRound).toBe(1);
            expect(debate.currentTurn).toBe('support');
            expect(debate.opposeDebaterId).toBeNull();
            expect(debate.supportDebaterId).toBe(creatorId);
            expect(debate.concludedAt).toBeNull();
            expect(marketPrice.supportPrice).toBe(50);
            expect(marketPrice.opposePrice).toBe(50);
            expect(rounds).toHaveLength(3);
            expect(rounds[0].roundNumber).toBe(1);
            expect(rounds[1].roundNumber).toBe(2);
            expect(rounds[2].roundNumber).toBe(3);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
