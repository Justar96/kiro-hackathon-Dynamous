import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  SANDBOX_DEBATES_REQUIRED, 
  SANDBOX_VOTE_WEIGHT, 
  FULL_VOTE_WEIGHT 
} from '@debate-platform/shared';

/**
 * Feature: debate-platform, Property 14: Sandbox Vote Weight
 * Validates: Requirements 10.1, 10.2, 10.3
 * 
 * For any user:
 * - If sandboxCompleted = false, vote weight = 0.5
 * - If sandboxCompleted = true, vote weight = 1.0
 * - sandboxCompleted becomes true after participating in 5 debates
 */

// Simulated user state for testing
interface UserState {
  debatesParticipated: number;
  sandboxCompleted: boolean;
}

// Function that calculates vote weight (extracted logic from UserService)
function calculateVoteWeight(user: UserState): number {
  return user.sandboxCompleted ? FULL_VOTE_WEIGHT : SANDBOX_VOTE_WEIGHT;
}

// Function that determines if sandbox should be completed
function shouldCompleteSandbox(debatesParticipated: number): boolean {
  return debatesParticipated >= SANDBOX_DEBATES_REQUIRED;
}

// Function that simulates incrementing debates participated
function incrementDebates(user: UserState): UserState {
  const newCount = user.debatesParticipated + 1;
  return {
    debatesParticipated: newCount,
    sandboxCompleted: shouldCompleteSandbox(newCount) || user.sandboxCompleted,
  };
}

describe('UserService Property Tests', () => {
  /**
   * Property 14: Sandbox Vote Weight
   * For any user with sandboxCompleted = false, vote weight = 0.5
   * Validates: Requirements 10.1, 10.2
   */
  it('Property 14: Sandbox users should have 0.5x vote weight', () => {
    fc.assert(
      fc.property(
        fc.record({
          debatesParticipated: fc.integer({ min: 0, max: SANDBOX_DEBATES_REQUIRED - 1 }),
          sandboxCompleted: fc.constant(false),
        }),
        (user) => {
          const weight = calculateVoteWeight(user);
          expect(weight).toBe(SANDBOX_VOTE_WEIGHT);
          expect(weight).toBe(0.5);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14: Full users should have 1.0x vote weight
   * For any user with sandboxCompleted = true, vote weight = 1.0
   * Validates: Requirements 10.3
   */
  it('Property 14: Full users should have 1.0x vote weight', () => {
    fc.assert(
      fc.property(
        fc.record({
          debatesParticipated: fc.integer({ min: SANDBOX_DEBATES_REQUIRED, max: 1000 }),
          sandboxCompleted: fc.constant(true),
        }),
        (user) => {
          const weight = calculateVoteWeight(user);
          expect(weight).toBe(FULL_VOTE_WEIGHT);
          expect(weight).toBe(1.0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14: Sandbox completion threshold
   * sandboxCompleted becomes true after participating in exactly 5 debates
   * Validates: Requirements 10.1, 10.3
   */
  it('Property 14: Sandbox should complete after exactly 5 debates', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (debatesCount) => {
          const shouldComplete = shouldCompleteSandbox(debatesCount);
          
          if (debatesCount >= SANDBOX_DEBATES_REQUIRED) {
            expect(shouldComplete).toBe(true);
          } else {
            expect(shouldComplete).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14: Incrementing debates eventually completes sandbox
   * Starting from 0 debates, after 5 increments, sandbox should be completed
   * Validates: Requirements 10.1, 10.3
   */
  it('Property 14: Incrementing debates 5 times should complete sandbox', () => {
    fc.assert(
      fc.property(
        fc.constant(null), // No input needed, we test the fixed scenario
        () => {
          let user: UserState = { debatesParticipated: 0, sandboxCompleted: false };
          
          // Before any debates
          expect(calculateVoteWeight(user)).toBe(SANDBOX_VOTE_WEIGHT);
          
          // Increment 4 times - should still be sandbox
          for (let i = 0; i < 4; i++) {
            user = incrementDebates(user);
            expect(user.sandboxCompleted).toBe(false);
            expect(calculateVoteWeight(user)).toBe(SANDBOX_VOTE_WEIGHT);
          }
          
          // 5th increment - should complete sandbox
          user = incrementDebates(user);
          expect(user.debatesParticipated).toBe(5);
          expect(user.sandboxCompleted).toBe(true);
          expect(calculateVoteWeight(user)).toBe(FULL_VOTE_WEIGHT);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14: Sandbox completion is permanent
   * Once sandboxCompleted = true, it should remain true regardless of further changes
   * Validates: Requirements 10.3
   */
  it('Property 14: Sandbox completion should be permanent', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: SANDBOX_DEBATES_REQUIRED, max: 1000 }),
        (additionalDebates) => {
          let user: UserState = { debatesParticipated: SANDBOX_DEBATES_REQUIRED, sandboxCompleted: true };
          
          // Increment more debates
          for (let i = 0; i < additionalDebates % 100; i++) {
            user = incrementDebates(user);
          }
          
          // Should still be completed
          expect(user.sandboxCompleted).toBe(true);
          expect(calculateVoteWeight(user)).toBe(FULL_VOTE_WEIGHT);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14: Vote weight is binary
   * Vote weight should only ever be 0.5 or 1.0, nothing else
   * Validates: Requirements 10.2, 10.3
   */
  it('Property 14: Vote weight should only be 0.5 or 1.0', () => {
    fc.assert(
      fc.property(
        fc.record({
          debatesParticipated: fc.integer({ min: 0, max: 1000 }),
          sandboxCompleted: fc.boolean(),
        }),
        (user) => {
          const weight = calculateVoteWeight(user);
          expect([SANDBOX_VOTE_WEIGHT, FULL_VOTE_WEIGHT]).toContain(weight);
        }
      ),
      { numRuns: 100 }
    );
  });
});
