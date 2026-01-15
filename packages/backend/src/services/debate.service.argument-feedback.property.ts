import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateArgumentContent,
  ARGUMENT_MIN_CHAR_LIMIT,
  getCharLimit,
  type RoundType,
  type ArgumentValidationError,
} from '@thesis/shared';

/**
 * Feature: debate-lifecycle-ux, Property 22: Short Argument Feedback
 * Validates: Requirements 7.5
 * 
 * For any argument submission rejected for being too short, the error response
 * SHALL include a specific character count requirement and improvement suggestion.
 */

// Round types for testing
const roundTypes: RoundType[] = ['opening', 'rebuttal', 'closing'];

// Arbitrary for generating round types
const roundTypeArbitrary = fc.constantFrom<RoundType>(...roundTypes);

// Arbitrary for generating short content (below minimum) - must have at least one non-whitespace character
const shortContentArbitrary = fc.tuple(
  fc.stringOf(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')),
    { minLength: 1, maxLength: ARGUMENT_MIN_CHAR_LIMIT - 1 }
  ),
  fc.stringOf(
    fc.constantFrom(...' '.split('')),
    { minLength: 0, maxLength: 10 }
  )
).map(([nonWhitespace, whitespace]) => nonWhitespace + whitespace);

// Arbitrary for generating empty or whitespace-only content
const emptyContentArbitrary = fc.constantFrom('', '   ', '\t', '\n', '  \n  ');

// Arbitrary for generating valid content (within limits)
const validContentArbitrary = (roundType: RoundType) => {
  const maxLength = getCharLimit(roundType);
  return fc.stringOf(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '.split('')),
    { minLength: ARGUMENT_MIN_CHAR_LIMIT, maxLength }
  );
};

// Arbitrary for generating content that exceeds max limit
const tooLongContentArbitrary = (roundType: RoundType) => {
  const maxLength = getCharLimit(roundType);
  return fc.stringOf(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '.split('')),
    { minLength: maxLength + 1, maxLength: maxLength + 500 }
  );
};

describe('Argument Validation Feedback Property Tests', () => {
  /**
   * Property 22: Short Argument Feedback
   * For any argument that is too short, the error SHALL include:
   * - Specific character count requirement
   * - Improvement suggestions
   * Validates: Requirements 7.5
   */
  it('Property 22: Short arguments should return error with character count and suggestions', () => {
    fc.assert(
      fc.property(
        shortContentArbitrary,
        roundTypeArbitrary,
        (content, roundType) => {
          const result = validateArgumentContent(content, roundType);
          
          // Property: Short content must return an error
          expect(result).not.toBeNull();
          expect(result!.code).toBe('TOO_SHORT');
          
          // Property: Error must include specific character count
          expect(result!.message).toContain(content.trim().length.toString());
          expect(result!.message).toContain(ARGUMENT_MIN_CHAR_LIMIT.toString());
          
          // Property: Error must include details with required length
          expect(result!.details.currentLength).toBe(content.trim().length);
          expect(result!.details.requiredLength).toBe(ARGUMENT_MIN_CHAR_LIMIT);
          expect(result!.details.roundType).toBe(roundType);
          
          // Property: Error must include improvement suggestions
          expect(result!.details.suggestions).toBeDefined();
          expect(Array.isArray(result!.details.suggestions)).toBe(true);
          expect(result!.details.suggestions.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22: Empty arguments should return error with suggestions
   * Validates: Requirements 7.5
   */
  it('Property 22: Empty arguments should return error with character count and suggestions', () => {
    fc.assert(
      fc.property(
        emptyContentArbitrary,
        roundTypeArbitrary,
        (content, roundType) => {
          const result = validateArgumentContent(content, roundType);
          
          // Property: Empty content must return an error
          expect(result).not.toBeNull();
          expect(result!.code).toBe('EMPTY');
          
          // Property: Error must include details
          expect(result!.details.currentLength).toBe(0);
          expect(result!.details.requiredLength).toBe(ARGUMENT_MIN_CHAR_LIMIT);
          expect(result!.details.roundType).toBe(roundType);
          
          // Property: Error must include improvement suggestions
          expect(result!.details.suggestions).toBeDefined();
          expect(Array.isArray(result!.details.suggestions)).toBe(true);
          expect(result!.details.suggestions.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22: Valid arguments should pass validation
   * Validates: Requirements 7.5
   */
  it('Property 22: Valid arguments (within limits) should pass validation', () => {
    fc.assert(
      fc.property(
        roundTypeArbitrary,
        (roundType) => {
          // Generate valid content for this round type
          const minLen = ARGUMENT_MIN_CHAR_LIMIT;
          const maxLen = getCharLimit(roundType);
          const contentLength = Math.floor((minLen + maxLen) / 2);
          const content = 'a'.repeat(contentLength);
          
          const result = validateArgumentContent(content, roundType);
          
          // Property: Valid content must pass validation
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22: Too long arguments should return error with character count
   * Validates: Requirements 7.5
   */
  it('Property 22: Too long arguments should return error with character count', () => {
    fc.assert(
      fc.property(
        roundTypeArbitrary,
        (roundType) => {
          const maxLength = getCharLimit(roundType);
          const content = 'a'.repeat(maxLength + 100);
          
          const result = validateArgumentContent(content, roundType);
          
          // Property: Too long content must return an error
          expect(result).not.toBeNull();
          expect(result!.code).toBe('TOO_LONG');
          
          // Property: Error must include specific character count
          expect(result!.message).toContain(content.length.toString());
          expect(result!.message).toContain(maxLength.toString());
          
          // Property: Error must include details
          expect(result!.details.currentLength).toBe(content.length);
          expect(result!.details.requiredLength).toBe(maxLength);
          expect(result!.details.roundType).toBe(roundType);
          
          // Property: Error must include suggestions
          expect(result!.details.suggestions).toBeDefined();
          expect(Array.isArray(result!.details.suggestions)).toBe(true);
          expect(result!.details.suggestions.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22: Suggestions should be round-type specific
   * Validates: Requirements 7.5
   */
  it('Property 22: Suggestions should be contextual to round type', () => {
    fc.assert(
      fc.property(
        shortContentArbitrary,
        roundTypeArbitrary,
        (content, roundType) => {
          const result = validateArgumentContent(content, roundType);
          
          // Property: Suggestions must exist
          expect(result).not.toBeNull();
          expect(result!.details.suggestions.length).toBeGreaterThan(0);
          
          // Property: At least one suggestion should be round-specific
          const suggestions = result!.details.suggestions.join(' ').toLowerCase();
          
          // Check for round-specific keywords
          switch (roundType) {
            case 'opening':
              // Opening suggestions should mention position, framework, or main reasons
              expect(
                suggestions.includes('position') ||
                suggestions.includes('framework') ||
                suggestions.includes('main') ||
                suggestions.includes('claim') ||
                suggestions.includes('supporting')
              ).toBe(true);
              break;
            case 'rebuttal':
              // Rebuttal suggestions should mention opponent, address, or counter
              expect(
                suggestions.includes('opponent') ||
                suggestions.includes('address') ||
                suggestions.includes('counter') ||
                suggestions.includes('flawed') ||
                suggestions.includes('reasoning')
              ).toBe(true);
              break;
            case 'closing':
              // Closing suggestions should mention summarize, strongest, or prevail
              expect(
                suggestions.includes('summarize') ||
                suggestions.includes('strongest') ||
                suggestions.includes('prevail') ||
                suggestions.includes('points')
              ).toBe(true);
              break;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22: Boundary test - exactly at minimum should pass
   * Validates: Requirements 7.5
   */
  it('Property 22: Arguments at exactly minimum length should pass validation', () => {
    fc.assert(
      fc.property(
        roundTypeArbitrary,
        (roundType) => {
          const content = 'a'.repeat(ARGUMENT_MIN_CHAR_LIMIT);
          
          const result = validateArgumentContent(content, roundType);
          
          // Property: Content at exactly minimum should pass
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22: Boundary test - one below minimum should fail
   * Validates: Requirements 7.5
   */
  it('Property 22: Arguments one character below minimum should fail with feedback', () => {
    fc.assert(
      fc.property(
        roundTypeArbitrary,
        (roundType) => {
          const content = 'a'.repeat(ARGUMENT_MIN_CHAR_LIMIT - 1);
          
          const result = validateArgumentContent(content, roundType);
          
          // Property: Content just below minimum should fail
          expect(result).not.toBeNull();
          expect(result!.code).toBe('TOO_SHORT');
          expect(result!.details.currentLength).toBe(ARGUMENT_MIN_CHAR_LIMIT - 1);
          expect(result!.details.suggestions.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22: Boundary test - exactly at maximum should pass
   * Validates: Requirements 7.5
   */
  it('Property 22: Arguments at exactly maximum length should pass validation', () => {
    fc.assert(
      fc.property(
        roundTypeArbitrary,
        (roundType) => {
          const maxLength = getCharLimit(roundType);
          const content = 'a'.repeat(maxLength);
          
          const result = validateArgumentContent(content, roundType);
          
          // Property: Content at exactly maximum should pass
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22: Boundary test - one above maximum should fail
   * Validates: Requirements 7.5
   */
  it('Property 22: Arguments one character above maximum should fail with feedback', () => {
    fc.assert(
      fc.property(
        roundTypeArbitrary,
        (roundType) => {
          const maxLength = getCharLimit(roundType);
          const content = 'a'.repeat(maxLength + 1);
          
          const result = validateArgumentContent(content, roundType);
          
          // Property: Content just above maximum should fail
          expect(result).not.toBeNull();
          expect(result!.code).toBe('TOO_LONG');
          expect(result!.details.currentLength).toBe(maxLength + 1);
          expect(result!.details.suggestions.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
