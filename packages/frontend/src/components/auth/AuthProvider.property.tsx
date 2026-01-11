import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateUsername } from './AuthProvider';

/**
 * Feature: auth-profile-enhancements
 * Property 6: Username Validation
 * 
 * For any username input:
 * - Strings with fewer than 3 characters SHALL be rejected
 * - Strings with 3+ alphanumeric characters and underscores SHALL be accepted
 * - Strings with special characters (other than underscore) SHALL be rejected
 * 
 * **Validates: Requirements 2.2**
 */
describe('AuthProvider Property Tests', () => {
  describe('Property 6: Username Validation', () => {
    /**
     * Property 6.1: Strings with fewer than 3 characters SHALL be rejected
     */
    it('should reject usernames with fewer than 3 characters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 2 }),
          (shortUsername) => {
            const result = validateUsername(shortUsername);
            expect(result).toBe('Username must be at least 3 characters');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 6.2: Strings with 3+ alphanumeric characters and underscores SHALL be accepted
     */
    it('should accept valid usernames with 3+ alphanumeric characters and underscores', () => {
      // Generate valid usernames: alphanumeric + underscore, length >= 3
      const validUsernameArb = fc.stringMatching(/^[a-zA-Z0-9_]{3,30}$/);

      fc.assert(
        fc.property(validUsernameArb, (validUsername) => {
          const result = validateUsername(validUsername);
          expect(result).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 6.3: Strings with special characters (other than underscore) SHALL be rejected
     */
    it('should reject usernames with special characters other than underscore', () => {
      // Generate strings with at least one special character (not alphanumeric or underscore)
      const specialChars = '!@#$%^&*()-+=[]{}|;:\'",.<>?/`~ ';
      const specialCharArb = fc.constantFrom(...specialChars.split(''));
      
      // Create username with at least 3 chars including a special character
      const invalidUsernameArb = fc.tuple(
        fc.stringMatching(/^[a-zA-Z0-9_]{0,10}$/),
        specialCharArb,
        fc.stringMatching(/^[a-zA-Z0-9_]{0,10}$/)
      ).map(([prefix, special, suffix]) => {
        const combined = prefix + special + suffix;
        // Ensure minimum length of 3 to isolate the special char test from length test
        if (combined.length < 3) {
          return 'ab' + special;
        }
        return combined;
      });

      fc.assert(
        fc.property(invalidUsernameArb, (invalidUsername) => {
          const result = validateUsername(invalidUsername);
          // Should be rejected for special characters
          expect(result).toBe('Username can only contain letters, numbers, and underscores');
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 6.4: Empty string SHALL be rejected
     */
    it('should reject empty username', () => {
      const result = validateUsername('');
      expect(result).toBe('Username must be at least 3 characters');
    });

    /**
     * Property 6.5: Underscore-only usernames with 3+ chars SHALL be accepted
     */
    it('should accept underscore-only usernames with 3+ characters', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 20 }),
          (length) => {
            const underscoreUsername = '_'.repeat(length);
            const result = validateUsername(underscoreUsername);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 6.6: Mixed valid characters SHALL be accepted
     */
    it('should accept mixed alphanumeric and underscore usernames', () => {
      // Generate usernames with mix of letters, numbers, and underscores
      const mixedUsernameArb = fc.tuple(
        fc.stringMatching(/^[a-zA-Z]{1,5}$/),
        fc.stringMatching(/^[0-9]{1,5}$/),
        fc.stringMatching(/^_{1,3}$/)
      ).map(([letters, numbers, underscores]) => {
        const combined = letters + numbers + underscores;
        return combined.length >= 3 ? combined : combined + 'abc';
      });

      fc.assert(
        fc.property(mixedUsernameArb, (mixedUsername) => {
          const result = validateUsername(mixedUsername);
          expect(result).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });
});
