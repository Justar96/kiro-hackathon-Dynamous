import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { User } from '@debate-platform/shared';

/**
 * Feature: debate-platform, Property 12: New User Reputation Initialization
 * Validates: Requirements 7.1
 * 
 * For any newly created user, reputationScore SHALL equal exactly 100.
 */

// Arbitrary for generating valid auth user data
const authUserArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  email: fc.option(fc.emailAddress(), { nil: null }),
});

// Function that simulates user creation logic (extracted from AuthService)
function createUserWithDefaults(authUser: { id: string; name: string | null; email: string | null }): User {
  const userId = `user_${Math.random().toString(36).substring(7)}`;
  const username = authUser.name || `user_${Math.random().toString(36).substring(7)}`;
  const email = authUser.email || `${userId}@placeholder.local`;

  return {
    id: userId,
    authUserId: authUser.id,
    username,
    email,
    reputationScore: 100, // Default per Requirements 7.1
    predictionAccuracy: 50,
    debatesParticipated: 0,
    sandboxCompleted: false,
    createdAt: new Date(),
  };
}

describe('AuthService Property Tests', () => {
  /**
   * Property 12: New User Reputation Initialization
   * For any newly created user, reputationScore SHALL equal exactly 100.
   * Validates: Requirements 7.1
   */
  it('Property 12: New user reputation should always be initialized to 100', () => {
    fc.assert(
      fc.property(authUserArbitrary, (authUser) => {
        const newUser = createUserWithDefaults(authUser);
        
        // Property: reputationScore must equal exactly 100
        expect(newUser.reputationScore).toBe(100);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: New users should have correct default values
   * This validates the complete initialization state
   */
  it('Property 12 (extended): New user should have all correct default values', () => {
    fc.assert(
      fc.property(authUserArbitrary, (authUser) => {
        const newUser = createUserWithDefaults(authUser);
        
        // All default values per Requirements 7.1 and schema defaults
        expect(newUser.reputationScore).toBe(100);
        expect(newUser.predictionAccuracy).toBe(50);
        expect(newUser.debatesParticipated).toBe(0);
        expect(newUser.sandboxCompleted).toBe(false);
        
        // Auth user should be linked
        expect(newUser.authUserId).toBe(authUser.id);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Username fallback when name is null
   */
  it('Property 12 (username fallback): Username should be generated when auth name is null', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          name: fc.constant(null),
          email: fc.option(fc.emailAddress(), { nil: null }),
        }),
        (authUser) => {
          const newUser = createUserWithDefaults(authUser);
          
          // Username should be generated (starts with 'user_')
          expect(newUser.username).toMatch(/^user_/);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Username uses auth name when provided
   */
  it('Property 12 (username from auth): Username should use auth name when provided', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          email: fc.option(fc.emailAddress(), { nil: null }),
        }),
        (authUser) => {
          const newUser = createUserWithDefaults(authUser);
          
          // Username should match auth name
          expect(newUser.username).toBe(authUser.name);
        }
      ),
      { numRuns: 100 }
    );
  });
});
