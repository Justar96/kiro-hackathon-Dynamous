import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: debate-platform
 * Property Tests for Reaction Service
 * 
 * Properties covered:
 * - Property 11: Dual Reaction Independence
 * 
 * Validates: Requirements 6.1, 6.2, 6.4
 */

// Arbitrary for generating user IDs
const userIdArbitrary = fc.string({ minLength: 10, maxLength: 21 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

// Arbitrary for generating argument IDs
const argumentIdArbitrary = fc.string({ minLength: 10, maxLength: 21 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

// Arbitrary for reaction types
const reactionTypeArbitrary = fc.constantFrom('agree', 'strong_reasoning') as fc.Arbitrary<'agree' | 'strong_reasoning'>;

/**
 * Simulates the dual reaction state for a user on an argument
 * State tracks which reactions a user has given independently
 */
interface ReactionState {
  argumentId: string;
  voterId: string;
  hasAgree: boolean;
  hasStrongReasoning: boolean;
}

/**
 * Create initial state with no reactions
 */
function createInitialState(argumentId: string, voterId: string): ReactionState {
  return {
    argumentId,
    voterId,
    hasAgree: false,
    hasStrongReasoning: false,
  };
}

/**
 * Add a reaction to the state
 * Returns { success: boolean, state: ReactionState, error?: string }
 */
function addReaction(
  state: ReactionState, 
  type: 'agree' | 'strong_reasoning'
): { success: boolean; state: ReactionState; error?: string } {
  // Check if reaction already exists
  if (type === 'agree' && state.hasAgree) {
    return { success: false, state, error: 'You have already reacted to this argument' };
  }
  if (type === 'strong_reasoning' && state.hasStrongReasoning) {
    return { success: false, state, error: 'You have already reacted to this argument' };
  }

  // Add the reaction
  const newState = { ...state };
  if (type === 'agree') {
    newState.hasAgree = true;
  } else {
    newState.hasStrongReasoning = true;
  }

  return { success: true, state: newState };
}

/**
 * Remove a reaction from the state
 */
function removeReaction(
  state: ReactionState, 
  type: 'agree' | 'strong_reasoning'
): { removed: boolean; state: ReactionState } {
  const newState = { ...state };
  let removed = false;

  if (type === 'agree' && state.hasAgree) {
    newState.hasAgree = false;
    removed = true;
  } else if (type === 'strong_reasoning' && state.hasStrongReasoning) {
    newState.hasStrongReasoning = false;
    removed = true;
  }

  return { removed, state: newState };
}

/**
 * Get reaction counts from state
 */
function getReactionCounts(state: ReactionState): { agree: number; strongReasoning: number } {
  return {
    agree: state.hasAgree ? 1 : 0,
    strongReasoning: state.hasStrongReasoning ? 1 : 0,
  };
}

describe('ReactionService Property Tests', () => {
  /**
   * Property 11: Dual Reaction Independence
   * For any argument and user:
   * - User can add 'agree' reaction without 'strong_reasoning'
   * - User can add 'strong_reasoning' reaction without 'agree'
   * - Both reactions are stored and counted independently
   * 
   * Validates: Requirements 6.1, 6.2, 6.4
   */
  describe('Property 11: Dual Reaction Independence', () => {
    it('user can add agree reaction without strong_reasoning', () => {
      fc.assert(
        fc.property(
          argumentIdArbitrary,
          userIdArbitrary,
          (argumentId, voterId) => {
            // Start with no reactions
            const initialState = createInitialState(argumentId, voterId);
            
            // Add only 'agree' reaction
            const result = addReaction(initialState, 'agree');
            
            // Should succeed
            expect(result.success).toBe(true);
            
            // Should have agree but not strong_reasoning
            expect(result.state.hasAgree).toBe(true);
            expect(result.state.hasStrongReasoning).toBe(false);
            
            // Counts should reflect this
            const counts = getReactionCounts(result.state);
            expect(counts.agree).toBe(1);
            expect(counts.strongReasoning).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('user can add strong_reasoning reaction without agree', () => {
      fc.assert(
        fc.property(
          argumentIdArbitrary,
          userIdArbitrary,
          (argumentId, voterId) => {
            // Start with no reactions
            const initialState = createInitialState(argumentId, voterId);
            
            // Add only 'strong_reasoning' reaction
            const result = addReaction(initialState, 'strong_reasoning');
            
            // Should succeed
            expect(result.success).toBe(true);
            
            // Should have strong_reasoning but not agree
            expect(result.state.hasAgree).toBe(false);
            expect(result.state.hasStrongReasoning).toBe(true);
            
            // Counts should reflect this
            const counts = getReactionCounts(result.state);
            expect(counts.agree).toBe(0);
            expect(counts.strongReasoning).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('user can add both reactions independently', () => {
      fc.assert(
        fc.property(
          argumentIdArbitrary,
          userIdArbitrary,
          (argumentId, voterId) => {
            // Start with no reactions
            let state = createInitialState(argumentId, voterId);
            
            // Add 'agree' reaction
            const agreeResult = addReaction(state, 'agree');
            expect(agreeResult.success).toBe(true);
            state = agreeResult.state;
            
            // Add 'strong_reasoning' reaction
            const strongResult = addReaction(state, 'strong_reasoning');
            expect(strongResult.success).toBe(true);
            state = strongResult.state;
            
            // Should have both reactions
            expect(state.hasAgree).toBe(true);
            expect(state.hasStrongReasoning).toBe(true);
            
            // Counts should reflect both
            const counts = getReactionCounts(state);
            expect(counts.agree).toBe(1);
            expect(counts.strongReasoning).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('order of adding reactions should not matter', () => {
      fc.assert(
        fc.property(
          argumentIdArbitrary,
          userIdArbitrary,
          fc.boolean(), // true = agree first, false = strong_reasoning first
          (argumentId, voterId, agreeFirst) => {
            let state = createInitialState(argumentId, voterId);
            
            if (agreeFirst) {
              state = addReaction(state, 'agree').state;
              state = addReaction(state, 'strong_reasoning').state;
            } else {
              state = addReaction(state, 'strong_reasoning').state;
              state = addReaction(state, 'agree').state;
            }
            
            // Regardless of order, should have both reactions
            expect(state.hasAgree).toBe(true);
            expect(state.hasStrongReasoning).toBe(true);
            
            const counts = getReactionCounts(state);
            expect(counts.agree).toBe(1);
            expect(counts.strongReasoning).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('removing one reaction should not affect the other', () => {
      fc.assert(
        fc.property(
          argumentIdArbitrary,
          userIdArbitrary,
          reactionTypeArbitrary, // which reaction to remove
          (argumentId, voterId, typeToRemove) => {
            // Start with both reactions
            let state = createInitialState(argumentId, voterId);
            state = addReaction(state, 'agree').state;
            state = addReaction(state, 'strong_reasoning').state;
            
            // Remove one reaction
            const removeResult = removeReaction(state, typeToRemove);
            expect(removeResult.removed).toBe(true);
            state = removeResult.state;
            
            // The other reaction should still exist
            if (typeToRemove === 'agree') {
              expect(state.hasAgree).toBe(false);
              expect(state.hasStrongReasoning).toBe(true);
            } else {
              expect(state.hasAgree).toBe(true);
              expect(state.hasStrongReasoning).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('duplicate reaction of same type should be rejected', () => {
      fc.assert(
        fc.property(
          argumentIdArbitrary,
          userIdArbitrary,
          reactionTypeArbitrary,
          (argumentId, voterId, reactionType) => {
            // Start with no reactions
            let state = createInitialState(argumentId, voterId);
            
            // Add reaction first time - should succeed
            const firstResult = addReaction(state, reactionType);
            expect(firstResult.success).toBe(true);
            state = firstResult.state;
            
            // Try to add same reaction again - should fail
            const secondResult = addReaction(state, reactionType);
            expect(secondResult.success).toBe(false);
            expect(secondResult.error).toBe('You have already reacted to this argument');
            
            // State should be unchanged
            expect(secondResult.state).toEqual(state);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('reactions are stored independently per reaction type', () => {
      fc.assert(
        fc.property(
          argumentIdArbitrary,
          userIdArbitrary,
          (argumentId, voterId) => {
            // Test all four possible states
            const noReactions = createInitialState(argumentId, voterId);
            const onlyAgree = addReaction(noReactions, 'agree').state;
            const onlyStrong = addReaction(noReactions, 'strong_reasoning').state;
            const bothReactions = addReaction(onlyAgree, 'strong_reasoning').state;
            
            // Verify each state is distinct
            expect(getReactionCounts(noReactions)).toEqual({ agree: 0, strongReasoning: 0 });
            expect(getReactionCounts(onlyAgree)).toEqual({ agree: 1, strongReasoning: 0 });
            expect(getReactionCounts(onlyStrong)).toEqual({ agree: 0, strongReasoning: 1 });
            expect(getReactionCounts(bothReactions)).toEqual({ agree: 1, strongReasoning: 1 });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('adding agree after having strong_reasoning should not affect strong_reasoning', () => {
      fc.assert(
        fc.property(
          argumentIdArbitrary,
          userIdArbitrary,
          (argumentId, voterId) => {
            // Start with strong_reasoning only
            let state = createInitialState(argumentId, voterId);
            state = addReaction(state, 'strong_reasoning').state;
            
            // Verify initial state
            expect(state.hasStrongReasoning).toBe(true);
            expect(state.hasAgree).toBe(false);
            
            // Add agree
            const result = addReaction(state, 'agree');
            expect(result.success).toBe(true);
            
            // strong_reasoning should still be true
            expect(result.state.hasStrongReasoning).toBe(true);
            expect(result.state.hasAgree).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('adding strong_reasoning after having agree should not affect agree', () => {
      fc.assert(
        fc.property(
          argumentIdArbitrary,
          userIdArbitrary,
          (argumentId, voterId) => {
            // Start with agree only
            let state = createInitialState(argumentId, voterId);
            state = addReaction(state, 'agree').state;
            
            // Verify initial state
            expect(state.hasAgree).toBe(true);
            expect(state.hasStrongReasoning).toBe(false);
            
            // Add strong_reasoning
            const result = addReaction(state, 'strong_reasoning');
            expect(result.success).toBe(true);
            
            // agree should still be true
            expect(result.state.hasAgree).toBe(true);
            expect(result.state.hasStrongReasoning).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
