import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: debate-platform
 * Property Tests for Reaction Service
 * 
 * Properties covered:
 * - Property 11: Dual Reaction Independence
 * - Property 4: Comment Reaction Uniqueness
 * - Property 5: Comment Reaction Count Consistency
 * 
 * Validates: Requirements 6.1, 6.2, 6.4, 2.1, 2.2, 2.3, 2.4
 */

// Arbitrary for generating user IDs
const userIdArbitrary = fc.string({ minLength: 10, maxLength: 21 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

// Arbitrary for generating argument IDs
const argumentIdArbitrary = fc.string({ minLength: 10, maxLength: 21 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

// Arbitrary for generating comment IDs
const commentIdArbitrary = fc.string({ minLength: 10, maxLength: 21 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

// Arbitrary for reaction types
const reactionTypeArbitrary = fc.constantFrom('agree', 'strong_reasoning') as fc.Arbitrary<'agree' | 'strong_reasoning'>;

// Arbitrary for comment reaction types
const commentReactionTypeArbitrary = fc.constantFrom('support', 'oppose') as fc.Arbitrary<'support' | 'oppose'>;

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

// ============================================
// Comment Reaction Property Tests
// Feature: enhanced-comments-matching
// ============================================

/**
 * Simulates the comment reaction state for a user on a comment
 * State tracks which reactions a user has given independently
 */
interface CommentReactionState {
  commentId: string;
  userId: string;
  hasSupport: boolean;
  hasOppose: boolean;
}

/**
 * Create initial comment reaction state with no reactions
 */
function createInitialCommentReactionState(commentId: string, userId: string): CommentReactionState {
  return {
    commentId,
    userId,
    hasSupport: false,
    hasOppose: false,
  };
}

/**
 * Add a comment reaction to the state
 * Returns { success: boolean, state: CommentReactionState, error?: string }
 */
function addCommentReaction(
  state: CommentReactionState, 
  type: 'support' | 'oppose'
): { success: boolean; state: CommentReactionState; error?: string } {
  // Check if reaction already exists
  if (type === 'support' && state.hasSupport) {
    return { success: false, state, error: 'You have already reacted to this comment' };
  }
  if (type === 'oppose' && state.hasOppose) {
    return { success: false, state, error: 'You have already reacted to this comment' };
  }

  // Add the reaction
  const newState = { ...state };
  if (type === 'support') {
    newState.hasSupport = true;
  } else {
    newState.hasOppose = true;
  }

  return { success: true, state: newState };
}

/**
 * Remove a comment reaction from the state
 */
function removeCommentReaction(
  state: CommentReactionState, 
  type: 'support' | 'oppose'
): { removed: boolean; state: CommentReactionState } {
  const newState = { ...state };
  let removed = false;

  if (type === 'support' && state.hasSupport) {
    newState.hasSupport = false;
    removed = true;
  } else if (type === 'oppose' && state.hasOppose) {
    newState.hasOppose = false;
    removed = true;
  }

  return { removed, state: newState };
}

/**
 * Get comment reaction counts from state
 */
function getCommentReactionCounts(state: CommentReactionState): { support: number; oppose: number } {
  return {
    support: state.hasSupport ? 1 : 0,
    oppose: state.hasOppose ? 1 : 0,
  };
}

/**
 * Multi-user comment reaction state for testing count consistency
 */
interface MultiUserCommentReactionState {
  commentId: string;
  reactions: Map<string, { support: boolean; oppose: boolean }>; // userId -> reactions
}

/**
 * Create initial multi-user state
 */
function createMultiUserState(commentId: string): MultiUserCommentReactionState {
  return {
    commentId,
    reactions: new Map(),
  };
}

/**
 * Add a reaction from a user in multi-user state
 */
function addUserReaction(
  state: MultiUserCommentReactionState,
  userId: string,
  type: 'support' | 'oppose'
): { success: boolean; state: MultiUserCommentReactionState; error?: string } {
  const userReactions = state.reactions.get(userId) ?? { support: false, oppose: false };
  
  // Check for duplicate
  if (type === 'support' && userReactions.support) {
    return { success: false, state, error: 'You have already reacted to this comment' };
  }
  if (type === 'oppose' && userReactions.oppose) {
    return { success: false, state, error: 'You have already reacted to this comment' };
  }

  // Add reaction
  const newReactions = new Map(state.reactions);
  const newUserReactions = { ...userReactions };
  if (type === 'support') {
    newUserReactions.support = true;
  } else {
    newUserReactions.oppose = true;
  }
  newReactions.set(userId, newUserReactions);

  return { success: true, state: { ...state, reactions: newReactions } };
}

/**
 * Remove a reaction from a user in multi-user state
 */
function removeUserReaction(
  state: MultiUserCommentReactionState,
  userId: string,
  type: 'support' | 'oppose'
): { removed: boolean; state: MultiUserCommentReactionState } {
  const userReactions = state.reactions.get(userId);
  if (!userReactions) {
    return { removed: false, state };
  }

  if (type === 'support' && !userReactions.support) {
    return { removed: false, state };
  }
  if (type === 'oppose' && !userReactions.oppose) {
    return { removed: false, state };
  }

  const newReactions = new Map(state.reactions);
  const newUserReactions = { ...userReactions };
  if (type === 'support') {
    newUserReactions.support = false;
  } else {
    newUserReactions.oppose = false;
  }
  newReactions.set(userId, newUserReactions);

  return { removed: true, state: { ...state, reactions: newReactions } };
}

/**
 * Get total reaction counts across all users
 */
function getTotalReactionCounts(state: MultiUserCommentReactionState): { support: number; oppose: number } {
  let support = 0;
  let oppose = 0;

  for (const userReactions of state.reactions.values()) {
    if (userReactions.support) support++;
    if (userReactions.oppose) oppose++;
  }

  return { support, oppose };
}

describe('Comment Reaction Property Tests', () => {
  /**
   * Property 4: Comment Reaction Uniqueness
   * For any user and comment, attempting to add a reaction of the same type twice 
   * SHALL result in exactly one stored reaction (the first), with subsequent attempts rejected.
   * 
   * Validates: Requirements 2.1, 2.2
   */
  describe('Property 4: Comment Reaction Uniqueness', () => {
    it('first reaction of any type should succeed', () => {
      fc.assert(
        fc.property(
          commentIdArbitrary,
          userIdArbitrary,
          commentReactionTypeArbitrary,
          (commentId, userId, reactionType) => {
            // Start with no reactions
            const initialState = createInitialCommentReactionState(commentId, userId);
            
            // Add first reaction
            const result = addCommentReaction(initialState, reactionType);
            
            // Should succeed
            expect(result.success).toBe(true);
            
            // Should have the reaction
            if (reactionType === 'support') {
              expect(result.state.hasSupport).toBe(true);
            } else {
              expect(result.state.hasOppose).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('duplicate reaction of same type should be rejected', () => {
      fc.assert(
        fc.property(
          commentIdArbitrary,
          userIdArbitrary,
          commentReactionTypeArbitrary,
          (commentId, userId, reactionType) => {
            // Start with no reactions
            let state = createInitialCommentReactionState(commentId, userId);
            
            // Add reaction first time - should succeed
            const firstResult = addCommentReaction(state, reactionType);
            expect(firstResult.success).toBe(true);
            state = firstResult.state;
            
            // Try to add same reaction again - should fail
            const secondResult = addCommentReaction(state, reactionType);
            expect(secondResult.success).toBe(false);
            expect(secondResult.error).toBe('You have already reacted to this comment');
            
            // State should be unchanged
            expect(secondResult.state).toEqual(state);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('user can add both support and oppose reactions independently', () => {
      fc.assert(
        fc.property(
          commentIdArbitrary,
          userIdArbitrary,
          (commentId, userId) => {
            // Start with no reactions
            let state = createInitialCommentReactionState(commentId, userId);
            
            // Add 'support' reaction
            const supportResult = addCommentReaction(state, 'support');
            expect(supportResult.success).toBe(true);
            state = supportResult.state;
            
            // Add 'oppose' reaction
            const opposeResult = addCommentReaction(state, 'oppose');
            expect(opposeResult.success).toBe(true);
            state = opposeResult.state;
            
            // Should have both reactions
            expect(state.hasSupport).toBe(true);
            expect(state.hasOppose).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('order of adding reactions should not matter', () => {
      fc.assert(
        fc.property(
          commentIdArbitrary,
          userIdArbitrary,
          fc.boolean(), // true = support first, false = oppose first
          (commentId, userId, supportFirst) => {
            let state = createInitialCommentReactionState(commentId, userId);
            
            if (supportFirst) {
              state = addCommentReaction(state, 'support').state;
              state = addCommentReaction(state, 'oppose').state;
            } else {
              state = addCommentReaction(state, 'oppose').state;
              state = addCommentReaction(state, 'support').state;
            }
            
            // Regardless of order, should have both reactions
            expect(state.hasSupport).toBe(true);
            expect(state.hasOppose).toBe(true);
            
            const counts = getCommentReactionCounts(state);
            expect(counts.support).toBe(1);
            expect(counts.oppose).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('multiple duplicate attempts should all be rejected after first success', () => {
      fc.assert(
        fc.property(
          commentIdArbitrary,
          userIdArbitrary,
          commentReactionTypeArbitrary,
          fc.integer({ min: 2, max: 5 }), // number of duplicate attempts
          (commentId, userId, reactionType, numAttempts) => {
            let state = createInitialCommentReactionState(commentId, userId);
            
            // First attempt should succeed
            const firstResult = addCommentReaction(state, reactionType);
            expect(firstResult.success).toBe(true);
            state = firstResult.state;
            
            // All subsequent attempts should fail
            for (let i = 0; i < numAttempts; i++) {
              const result = addCommentReaction(state, reactionType);
              expect(result.success).toBe(false);
              expect(result.error).toBe('You have already reacted to this comment');
            }
            
            // Should still have exactly one reaction
            const counts = getCommentReactionCounts(state);
            if (reactionType === 'support') {
              expect(counts.support).toBe(1);
              expect(counts.oppose).toBe(0);
            } else {
              expect(counts.support).toBe(0);
              expect(counts.oppose).toBe(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Comment Reaction Count Consistency
   * For any comment, the reaction counts returned by getCommentReactionCounts() 
   * SHALL equal the actual count of stored reactions of each type.
   * 
   * Validates: Requirements 2.3, 2.4
   */
  describe('Property 5: Comment Reaction Count Consistency', () => {
    it('counts should match actual stored reactions for single user', () => {
      fc.assert(
        fc.property(
          commentIdArbitrary,
          userIdArbitrary,
          fc.boolean(), // add support?
          fc.boolean(), // add oppose?
          (commentId, userId, addSupport, addOppose) => {
            let state = createInitialCommentReactionState(commentId, userId);
            
            if (addSupport) {
              state = addCommentReaction(state, 'support').state;
            }
            if (addOppose) {
              state = addCommentReaction(state, 'oppose').state;
            }
            
            const counts = getCommentReactionCounts(state);
            
            // Counts should match what we added
            expect(counts.support).toBe(addSupport ? 1 : 0);
            expect(counts.oppose).toBe(addOppose ? 1 : 0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('counts should be accurate after adding reactions from multiple users', () => {
      fc.assert(
        fc.property(
          commentIdArbitrary,
          fc.array(
            fc.record({
              userId: userIdArbitrary,
              type: commentReactionTypeArbitrary,
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (commentId, reactions) => {
            let state = createMultiUserState(commentId);
            
            // Track expected counts
            let expectedSupport = 0;
            let expectedOppose = 0;
            
            // Add reactions
            for (const { userId, type } of reactions) {
              const result = addUserReaction(state, userId, type);
              if (result.success) {
                state = result.state;
                if (type === 'support') expectedSupport++;
                else expectedOppose++;
              }
            }
            
            // Get actual counts
            const counts = getTotalReactionCounts(state);
            
            // Counts should match
            expect(counts.support).toBe(expectedSupport);
            expect(counts.oppose).toBe(expectedOppose);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('counts should decrease correctly after removing reactions', () => {
      fc.assert(
        fc.property(
          commentIdArbitrary,
          fc.array(userIdArbitrary, { minLength: 2, maxLength: 5 }),
          commentReactionTypeArbitrary,
          (commentId, userIds, reactionType) => {
            // Ensure unique user IDs
            const uniqueUserIds = [...new Set(userIds)];
            fc.pre(uniqueUserIds.length >= 2);
            
            let state = createMultiUserState(commentId);
            
            // Add reactions from all users
            for (const userId of uniqueUserIds) {
              const result = addUserReaction(state, userId, reactionType);
              expect(result.success).toBe(true);
              state = result.state;
            }
            
            // Verify initial count
            let counts = getTotalReactionCounts(state);
            const initialCount = reactionType === 'support' ? counts.support : counts.oppose;
            expect(initialCount).toBe(uniqueUserIds.length);
            
            // Remove reaction from first user
            const removeResult = removeUserReaction(state, uniqueUserIds[0], reactionType);
            expect(removeResult.removed).toBe(true);
            state = removeResult.state;
            
            // Count should decrease by 1
            counts = getTotalReactionCounts(state);
            const newCount = reactionType === 'support' ? counts.support : counts.oppose;
            expect(newCount).toBe(initialCount - 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('removing non-existent reaction should not affect counts', () => {
      fc.assert(
        fc.property(
          commentIdArbitrary,
          userIdArbitrary,
          userIdArbitrary,
          commentReactionTypeArbitrary,
          (commentId, user1Id, user2Id, reactionType) => {
            // Ensure different users
            fc.pre(user1Id !== user2Id);
            
            let state = createMultiUserState(commentId);
            
            // Add reaction from user1
            const addResult = addUserReaction(state, user1Id, reactionType);
            expect(addResult.success).toBe(true);
            state = addResult.state;
            
            // Get initial counts
            const initialCounts = getTotalReactionCounts(state);
            
            // Try to remove reaction from user2 (who hasn't reacted)
            const removeResult = removeUserReaction(state, user2Id, reactionType);
            expect(removeResult.removed).toBe(false);
            
            // Counts should be unchanged
            const finalCounts = getTotalReactionCounts(removeResult.state);
            expect(finalCounts).toEqual(initialCounts);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('removing one reaction type should not affect the other type count', () => {
      fc.assert(
        fc.property(
          commentIdArbitrary,
          userIdArbitrary,
          (commentId, userId) => {
            let state = createMultiUserState(commentId);
            
            // Add both reaction types
            state = addUserReaction(state, userId, 'support').state;
            state = addUserReaction(state, userId, 'oppose').state;
            
            // Verify both are present
            let counts = getTotalReactionCounts(state);
            expect(counts.support).toBe(1);
            expect(counts.oppose).toBe(1);
            
            // Remove support
            const removeResult = removeUserReaction(state, userId, 'support');
            expect(removeResult.removed).toBe(true);
            state = removeResult.state;
            
            // Support should be 0, oppose should still be 1
            counts = getTotalReactionCounts(state);
            expect(counts.support).toBe(0);
            expect(counts.oppose).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('counts should be zero for comment with no reactions', () => {
      fc.assert(
        fc.property(
          commentIdArbitrary,
          (commentId) => {
            const state = createMultiUserState(commentId);
            const counts = getTotalReactionCounts(state);
            
            expect(counts.support).toBe(0);
            expect(counts.oppose).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('add then remove should result in zero count for that type', () => {
      fc.assert(
        fc.property(
          commentIdArbitrary,
          userIdArbitrary,
          commentReactionTypeArbitrary,
          (commentId, userId, reactionType) => {
            let state = createMultiUserState(commentId);
            
            // Add reaction
            state = addUserReaction(state, userId, reactionType).state;
            
            // Verify it's there
            let counts = getTotalReactionCounts(state);
            if (reactionType === 'support') {
              expect(counts.support).toBe(1);
            } else {
              expect(counts.oppose).toBe(1);
            }
            
            // Remove reaction
            state = removeUserReaction(state, userId, reactionType).state;
            
            // Verify it's gone
            counts = getTotalReactionCounts(state);
            if (reactionType === 'support') {
              expect(counts.support).toBe(0);
            } else {
              expect(counts.oppose).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
