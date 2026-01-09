import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: debate-platform
 * Property Tests for Comment Service
 * 
 * Properties covered:
 * - Property 16: Comment Threading
 * - Property 15: Comment Rate Limiting
 * 
 * Validates: Requirements 8.3, 10.4
 */

// Arbitrary for generating IDs (nanoid-like)
const idArbitrary = fc.string({ minLength: 10, maxLength: 21 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

// Arbitrary for generating comment content
const contentArbitrary = fc.string({ minLength: 1, maxLength: 500 });

// Rate limiting constants (matching shared types)
const COMMENT_RATE_LIMIT = 3;
const COMMENT_RATE_WINDOW_MINUTES = 10;

/**
 * Simulates a comment in the system
 */
interface SimulatedComment {
  id: string;
  debateId: string;
  userId: string;
  parentId: string | null;
  content: string;
  createdAt: Date;
}

/**
 * Simulates the comment state for a debate
 */
interface CommentState {
  comments: Map<string, SimulatedComment>;
  debates: Set<string>;
  users: Set<string>;
}

/**
 * Create initial empty state
 */
function createInitialState(): CommentState {
  return {
    comments: new Map(),
    debates: new Set(),
    users: new Set(),
  };
}

/**
 * Add a debate to the state
 */
function addDebate(state: CommentState, debateId: string): CommentState {
  const newState = { ...state, debates: new Set(state.debates) };
  newState.debates.add(debateId);
  return newState;
}

/**
 * Add a user to the state
 */
function addUser(state: CommentState, userId: string): CommentState {
  const newState = { ...state, users: new Set(state.users) };
  newState.users.add(userId);
  return newState;
}

/**
 * Add a comment to the state
 * Returns { success: boolean, state: CommentState, comment?: SimulatedComment, error?: string }
 */
function addComment(
  state: CommentState,
  input: {
    id: string;
    debateId: string;
    userId: string;
    parentId: string | null;
    content: string;
    createdAt?: Date;
  }
): { success: boolean; state: CommentState; comment?: SimulatedComment; error?: string } {
  // Verify debate exists
  if (!state.debates.has(input.debateId)) {
    return { success: false, state, error: 'Debate not found' };
  }

  // Verify user exists
  if (!state.users.has(input.userId)) {
    return { success: false, state, error: 'User not found' };
  }

  // Validate parent comment if provided (Property 16: Comment Threading)
  if (input.parentId !== null) {
    const parentComment = state.comments.get(input.parentId);
    
    if (!parentComment) {
      return { success: false, state, error: 'Parent comment not found' };
    }

    // Parent comment must belong to the same debate
    if (parentComment.debateId !== input.debateId) {
      return { success: false, state, error: 'Parent comment must belong to the same debate' };
    }
  }

  // Create the comment
  const comment: SimulatedComment = {
    id: input.id,
    debateId: input.debateId,
    userId: input.userId,
    parentId: input.parentId,
    content: input.content,
    createdAt: input.createdAt ?? new Date(),
  };

  const newComments = new Map(state.comments);
  newComments.set(comment.id, comment);

  return {
    success: true,
    state: { ...state, comments: newComments },
    comment,
  };
}

/**
 * Get a comment by ID
 */
function getComment(state: CommentState, commentId: string): SimulatedComment | null {
  return state.comments.get(commentId) ?? null;
}

/**
 * Check if a parent comment exists and belongs to the same debate
 */
function isValidParent(state: CommentState, parentId: string, debateId: string): boolean {
  const parent = state.comments.get(parentId);
  return parent !== undefined && parent.debateId === debateId;
}

describe('CommentService Property Tests', () => {
  /**
   * Property 16: Comment Threading
   * For any comment with a parentId, the parent comment SHALL exist and belong to the same debate.
   * 
   * Validates: Requirements 8.3
   */
  describe('Property 16: Comment Threading', () => {
    it('comment with valid parent in same debate should succeed', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          idArbitrary, // parentCommentId
          idArbitrary, // childCommentId
          contentArbitrary, // parentContent
          contentArbitrary, // childContent
          (debateId, userId, parentCommentId, childCommentId, parentContent, childContent) => {
            // Skip if IDs collide
            fc.pre(parentCommentId !== childCommentId);

            // Setup state with debate and user
            let state = createInitialState();
            state = addDebate(state, debateId);
            state = addUser(state, userId);

            // Add parent comment (no parent)
            const parentResult = addComment(state, {
              id: parentCommentId,
              debateId,
              userId,
              parentId: null,
              content: parentContent,
            });
            expect(parentResult.success).toBe(true);
            state = parentResult.state;

            // Add child comment with valid parent
            const childResult = addComment(state, {
              id: childCommentId,
              debateId,
              userId,
              parentId: parentCommentId,
              content: childContent,
            });

            // Should succeed
            expect(childResult.success).toBe(true);
            expect(childResult.comment?.parentId).toBe(parentCommentId);

            // Parent should exist and be in same debate
            const parent = getComment(childResult.state, parentCommentId);
            expect(parent).not.toBeNull();
            expect(parent?.debateId).toBe(debateId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('comment with non-existent parent should fail', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          idArbitrary, // commentId
          idArbitrary, // nonExistentParentId
          contentArbitrary, // content
          (debateId, userId, commentId, nonExistentParentId, content) => {
            // Setup state with debate and user but no parent comment
            let state = createInitialState();
            state = addDebate(state, debateId);
            state = addUser(state, userId);

            // Try to add comment with non-existent parent
            const result = addComment(state, {
              id: commentId,
              debateId,
              userId,
              parentId: nonExistentParentId,
              content,
            });

            // Should fail
            expect(result.success).toBe(false);
            expect(result.error).toBe('Parent comment not found');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('comment with parent from different debate should fail', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debate1Id
          idArbitrary, // debate2Id
          idArbitrary, // userId
          idArbitrary, // parentCommentId
          idArbitrary, // childCommentId
          contentArbitrary, // parentContent
          contentArbitrary, // childContent
          (debate1Id, debate2Id, userId, parentCommentId, childCommentId, parentContent, childContent) => {
            // Skip if debates are the same or IDs collide
            fc.pre(debate1Id !== debate2Id);
            fc.pre(parentCommentId !== childCommentId);

            // Setup state with two debates and user
            let state = createInitialState();
            state = addDebate(state, debate1Id);
            state = addDebate(state, debate2Id);
            state = addUser(state, userId);

            // Add parent comment in debate1
            const parentResult = addComment(state, {
              id: parentCommentId,
              debateId: debate1Id,
              userId,
              parentId: null,
              content: parentContent,
            });
            expect(parentResult.success).toBe(true);
            state = parentResult.state;

            // Try to add child comment in debate2 with parent from debate1
            const childResult = addComment(state, {
              id: childCommentId,
              debateId: debate2Id,
              userId,
              parentId: parentCommentId,
              content: childContent,
            });

            // Should fail
            expect(childResult.success).toBe(false);
            expect(childResult.error).toBe('Parent comment must belong to the same debate');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('top-level comment (no parent) should always succeed with valid debate and user', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          idArbitrary, // commentId
          contentArbitrary, // content
          (debateId, userId, commentId, content) => {
            // Setup state with debate and user
            let state = createInitialState();
            state = addDebate(state, debateId);
            state = addUser(state, userId);

            // Add top-level comment (no parent)
            const result = addComment(state, {
              id: commentId,
              debateId,
              userId,
              parentId: null,
              content,
            });

            // Should succeed
            expect(result.success).toBe(true);
            expect(result.comment?.parentId).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('nested threading should work (grandchild comments)', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          idArbitrary, // grandparentId
          idArbitrary, // parentId
          idArbitrary, // childId
          contentArbitrary, // content1
          contentArbitrary, // content2
          contentArbitrary, // content3
          (debateId, userId, grandparentId, parentId, childId, content1, content2, content3) => {
            // Skip if IDs collide
            fc.pre(grandparentId !== parentId && parentId !== childId && grandparentId !== childId);

            // Setup state
            let state = createInitialState();
            state = addDebate(state, debateId);
            state = addUser(state, userId);

            // Add grandparent (top-level)
            const grandparentResult = addComment(state, {
              id: grandparentId,
              debateId,
              userId,
              parentId: null,
              content: content1,
            });
            expect(grandparentResult.success).toBe(true);
            state = grandparentResult.state;

            // Add parent (child of grandparent)
            const parentResult = addComment(state, {
              id: parentId,
              debateId,
              userId,
              parentId: grandparentId,
              content: content2,
            });
            expect(parentResult.success).toBe(true);
            state = parentResult.state;

            // Add child (grandchild of grandparent)
            const childResult = addComment(state, {
              id: childId,
              debateId,
              userId,
              parentId: parentId,
              content: content3,
            });
            expect(childResult.success).toBe(true);

            // Verify the chain
            const grandparent = getComment(childResult.state, grandparentId);
            const parent = getComment(childResult.state, parentId);
            const child = getComment(childResult.state, childId);

            expect(grandparent?.parentId).toBeNull();
            expect(parent?.parentId).toBe(grandparentId);
            expect(child?.parentId).toBe(parentId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isValidParent should correctly validate parent-debate relationship', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debate1Id
          idArbitrary, // debate2Id
          idArbitrary, // userId
          idArbitrary, // commentId
          contentArbitrary, // content
          (debate1Id, debate2Id, userId, commentId, content) => {
            // Skip if debates are the same
            fc.pre(debate1Id !== debate2Id);

            // Setup state
            let state = createInitialState();
            state = addDebate(state, debate1Id);
            state = addDebate(state, debate2Id);
            state = addUser(state, userId);

            // Add comment in debate1
            const result = addComment(state, {
              id: commentId,
              debateId: debate1Id,
              userId,
              parentId: null,
              content,
            });
            expect(result.success).toBe(true);
            state = result.state;

            // isValidParent should return true for same debate
            expect(isValidParent(state, commentId, debate1Id)).toBe(true);

            // isValidParent should return false for different debate
            expect(isValidParent(state, commentId, debate2Id)).toBe(false);

            // isValidParent should return false for non-existent comment
            expect(isValidParent(state, 'nonexistent', debate1Id)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 15: Comment Rate Limiting
   * For any user in a debate, attempting to post more than 3 comments within a 10-minute window SHALL be rejected.
   * 
   * Validates: Requirements 10.4
   */
  describe('Property 15: Comment Rate Limiting', () => {
    /**
     * Rate limiting state simulation
     */
    interface RateLimitState {
      comments: Map<string, SimulatedComment>;
      debates: Set<string>;
      users: Set<string>;
    }

    /**
     * Check if user is rate limited for a debate
     * Returns true if user has >= COMMENT_RATE_LIMIT comments in the window
     */
    function isRateLimited(
      state: RateLimitState,
      userId: string,
      debateId: string,
      currentTime: Date
    ): boolean {
      const windowStart = new Date(currentTime.getTime() - COMMENT_RATE_WINDOW_MINUTES * 60 * 1000);
      
      let count = 0;
      for (const comment of state.comments.values()) {
        if (
          comment.userId === userId &&
          comment.debateId === debateId &&
          comment.createdAt >= windowStart
        ) {
          count++;
        }
      }
      
      return count >= COMMENT_RATE_LIMIT;
    }

    /**
     * Get count of comments in window
     */
    function getCommentCountInWindow(
      state: RateLimitState,
      userId: string,
      debateId: string,
      currentTime: Date
    ): number {
      const windowStart = new Date(currentTime.getTime() - COMMENT_RATE_WINDOW_MINUTES * 60 * 1000);
      
      let count = 0;
      for (const comment of state.comments.values()) {
        if (
          comment.userId === userId &&
          comment.debateId === debateId &&
          comment.createdAt >= windowStart
        ) {
          count++;
        }
      }
      
      return count;
    }

    /**
     * Add comment with rate limiting check
     */
    function addCommentWithRateLimit(
      state: RateLimitState,
      input: {
        id: string;
        debateId: string;
        userId: string;
        content: string;
        createdAt: Date;
      }
    ): { success: boolean; state: RateLimitState; error?: string } {
      // Check rate limiting first
      if (isRateLimited(state, input.userId, input.debateId, input.createdAt)) {
        return {
          success: false,
          state,
          error: `Maximum ${COMMENT_RATE_LIMIT} comments per ${COMMENT_RATE_WINDOW_MINUTES} minutes`,
        };
      }

      // Verify debate exists
      if (!state.debates.has(input.debateId)) {
        return { success: false, state, error: 'Debate not found' };
      }

      // Verify user exists
      if (!state.users.has(input.userId)) {
        return { success: false, state, error: 'User not found' };
      }

      // Create the comment
      const comment: SimulatedComment = {
        id: input.id,
        debateId: input.debateId,
        userId: input.userId,
        parentId: null,
        content: input.content,
        createdAt: input.createdAt,
      };

      const newComments = new Map(state.comments);
      newComments.set(comment.id, comment);

      return {
        success: true,
        state: { ...state, comments: newComments },
      };
    }

    it('first 3 comments within window should succeed', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          fc.array(idArbitrary, { minLength: 3, maxLength: 3 }), // 3 comment IDs
          fc.array(contentArbitrary, { minLength: 3, maxLength: 3 }), // 3 contents
          (debateId, userId, commentIds, contents) => {
            // Skip if any IDs collide
            const uniqueIds = new Set(commentIds);
            fc.pre(uniqueIds.size === 3);

            // Setup state
            let state: RateLimitState = {
              comments: new Map(),
              debates: new Set([debateId]),
              users: new Set([userId]),
            };

            const baseTime = new Date();

            // Add 3 comments - all should succeed
            for (let i = 0; i < 3; i++) {
              const result = addCommentWithRateLimit(state, {
                id: commentIds[i],
                debateId,
                userId,
                content: contents[i],
                createdAt: new Date(baseTime.getTime() + i * 1000), // 1 second apart
              });

              expect(result.success).toBe(true);
              state = result.state;
            }

            // Should have exactly 3 comments
            expect(state.comments.size).toBe(3);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('4th comment within window should be rejected', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          fc.array(idArbitrary, { minLength: 4, maxLength: 4 }), // 4 comment IDs
          fc.array(contentArbitrary, { minLength: 4, maxLength: 4 }), // 4 contents
          (debateId, userId, commentIds, contents) => {
            // Skip if any IDs collide
            const uniqueIds = new Set(commentIds);
            fc.pre(uniqueIds.size === 4);

            // Setup state
            let state: RateLimitState = {
              comments: new Map(),
              debates: new Set([debateId]),
              users: new Set([userId]),
            };

            const baseTime = new Date();

            // Add first 3 comments - all should succeed
            for (let i = 0; i < 3; i++) {
              const result = addCommentWithRateLimit(state, {
                id: commentIds[i],
                debateId,
                userId,
                content: contents[i],
                createdAt: new Date(baseTime.getTime() + i * 1000),
              });
              expect(result.success).toBe(true);
              state = result.state;
            }

            // 4th comment should be rejected
            const fourthResult = addCommentWithRateLimit(state, {
              id: commentIds[3],
              debateId,
              userId,
              content: contents[3],
              createdAt: new Date(baseTime.getTime() + 3000),
            });

            expect(fourthResult.success).toBe(false);
            expect(fourthResult.error).toBe(`Maximum ${COMMENT_RATE_LIMIT} comments per ${COMMENT_RATE_WINDOW_MINUTES} minutes`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('comment after window expires should succeed', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          fc.array(idArbitrary, { minLength: 4, maxLength: 4 }), // 4 comment IDs
          fc.array(contentArbitrary, { minLength: 4, maxLength: 4 }), // 4 contents
          (debateId, userId, commentIds, contents) => {
            // Skip if any IDs collide
            const uniqueIds = new Set(commentIds);
            fc.pre(uniqueIds.size === 4);

            // Setup state
            let state: RateLimitState = {
              comments: new Map(),
              debates: new Set([debateId]),
              users: new Set([userId]),
            };

            const baseTime = new Date();

            // Add first 3 comments
            for (let i = 0; i < 3; i++) {
              const result = addCommentWithRateLimit(state, {
                id: commentIds[i],
                debateId,
                userId,
                content: contents[i],
                createdAt: new Date(baseTime.getTime() + i * 1000),
              });
              expect(result.success).toBe(true);
              state = result.state;
            }

            // 4th comment after window expires (11 minutes later) should succeed
            const afterWindowTime = new Date(baseTime.getTime() + 11 * 60 * 1000);
            const fourthResult = addCommentWithRateLimit(state, {
              id: commentIds[3],
              debateId,
              userId,
              content: contents[3],
              createdAt: afterWindowTime,
            });

            expect(fourthResult.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rate limiting should be independent per debate', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debate1Id
          idArbitrary, // debate2Id
          idArbitrary, // userId
          fc.array(idArbitrary, { minLength: 4, maxLength: 4 }), // 4 comment IDs
          fc.array(contentArbitrary, { minLength: 4, maxLength: 4 }), // 4 contents
          (debate1Id, debate2Id, userId, commentIds, contents) => {
            // Skip if debates are the same or IDs collide
            fc.pre(debate1Id !== debate2Id);
            const uniqueIds = new Set(commentIds);
            fc.pre(uniqueIds.size === 4);

            // Setup state with two debates
            let state: RateLimitState = {
              comments: new Map(),
              debates: new Set([debate1Id, debate2Id]),
              users: new Set([userId]),
            };

            const baseTime = new Date();

            // Add 3 comments to debate1
            for (let i = 0; i < 3; i++) {
              const result = addCommentWithRateLimit(state, {
                id: commentIds[i],
                debateId: debate1Id,
                userId,
                content: contents[i],
                createdAt: new Date(baseTime.getTime() + i * 1000),
              });
              expect(result.success).toBe(true);
              state = result.state;
            }

            // User should be rate limited in debate1
            expect(isRateLimited(state, userId, debate1Id, baseTime)).toBe(true);

            // But NOT rate limited in debate2
            expect(isRateLimited(state, userId, debate2Id, baseTime)).toBe(false);

            // 4th comment to debate2 should succeed
            const debate2Result = addCommentWithRateLimit(state, {
              id: commentIds[3],
              debateId: debate2Id,
              userId,
              content: contents[3],
              createdAt: new Date(baseTime.getTime() + 3000),
            });

            expect(debate2Result.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rate limiting should be independent per user', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // user1Id
          idArbitrary, // user2Id
          fc.array(idArbitrary, { minLength: 4, maxLength: 4 }), // 4 comment IDs
          fc.array(contentArbitrary, { minLength: 4, maxLength: 4 }), // 4 contents
          (debateId, user1Id, user2Id, commentIds, contents) => {
            // Skip if users are the same or IDs collide
            fc.pre(user1Id !== user2Id);
            const uniqueIds = new Set(commentIds);
            fc.pre(uniqueIds.size === 4);

            // Setup state with two users
            let state: RateLimitState = {
              comments: new Map(),
              debates: new Set([debateId]),
              users: new Set([user1Id, user2Id]),
            };

            const baseTime = new Date();

            // Add 3 comments from user1
            for (let i = 0; i < 3; i++) {
              const result = addCommentWithRateLimit(state, {
                id: commentIds[i],
                debateId,
                userId: user1Id,
                content: contents[i],
                createdAt: new Date(baseTime.getTime() + i * 1000),
              });
              expect(result.success).toBe(true);
              state = result.state;
            }

            // User1 should be rate limited
            expect(isRateLimited(state, user1Id, debateId, baseTime)).toBe(true);

            // But user2 should NOT be rate limited
            expect(isRateLimited(state, user2Id, debateId, baseTime)).toBe(false);

            // Comment from user2 should succeed
            const user2Result = addCommentWithRateLimit(state, {
              id: commentIds[3],
              debateId,
              userId: user2Id,
              content: contents[3],
              createdAt: new Date(baseTime.getTime() + 3000),
            });

            expect(user2Result.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('comment count in window should be accurate', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          fc.integer({ min: 0, max: 5 }), // number of comments to add
          fc.array(idArbitrary, { minLength: 5, maxLength: 5 }), // comment IDs
          fc.array(contentArbitrary, { minLength: 5, maxLength: 5 }), // contents
          (debateId, userId, numComments, commentIds, contents) => {
            // Skip if IDs collide
            const uniqueIds = new Set(commentIds);
            fc.pre(uniqueIds.size === 5);

            // Setup state
            let state: RateLimitState = {
              comments: new Map(),
              debates: new Set([debateId]),
              users: new Set([userId]),
            };

            const baseTime = new Date();

            // Add comments (up to rate limit)
            const commentsToAdd = Math.min(numComments, COMMENT_RATE_LIMIT);
            for (let i = 0; i < commentsToAdd; i++) {
              const result = addCommentWithRateLimit(state, {
                id: commentIds[i],
                debateId,
                userId,
                content: contents[i],
                createdAt: new Date(baseTime.getTime() + i * 1000),
              });
              expect(result.success).toBe(true);
              state = result.state;
            }

            // Count should match
            const count = getCommentCountInWindow(state, userId, debateId, baseTime);
            expect(count).toBe(commentsToAdd);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('exactly at rate limit should trigger rate limiting', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          fc.array(idArbitrary, { minLength: 3, maxLength: 3 }), // 3 comment IDs
          fc.array(contentArbitrary, { minLength: 3, maxLength: 3 }), // 3 contents
          (debateId, userId, commentIds, contents) => {
            // Skip if IDs collide
            const uniqueIds = new Set(commentIds);
            fc.pre(uniqueIds.size === 3);

            // Setup state
            let state: RateLimitState = {
              comments: new Map(),
              debates: new Set([debateId]),
              users: new Set([userId]),
            };

            const baseTime = new Date();

            // Add exactly COMMENT_RATE_LIMIT (3) comments
            for (let i = 0; i < COMMENT_RATE_LIMIT; i++) {
              const result = addCommentWithRateLimit(state, {
                id: commentIds[i],
                debateId,
                userId,
                content: contents[i],
                createdAt: new Date(baseTime.getTime() + i * 1000),
              });
              expect(result.success).toBe(true);
              state = result.state;
            }

            // Should now be rate limited (count >= COMMENT_RATE_LIMIT)
            expect(isRateLimited(state, userId, debateId, baseTime)).toBe(true);
            expect(getCommentCountInWindow(state, userId, debateId, baseTime)).toBe(COMMENT_RATE_LIMIT);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
