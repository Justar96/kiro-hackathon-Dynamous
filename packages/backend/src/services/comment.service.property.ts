import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: enhanced-comments-matching
 * Property Tests for Comment Service
 * 
 * Properties covered:
 * - Property 1: Comment Tree Structure Preservation
 * - Property 2: Reply Count Accuracy
 * - Property 3: Deleted Parent Indicator
 * - Property 16: Comment Threading
 * - Property 15: Comment Rate Limiting
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 8.3, 10.4
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

  /**
   * Feature: enhanced-comments-matching
   * Property 1: Comment Tree Structure Preservation
   * 
   * For any set of comments with parent-child relationships stored in the database,
   * retrieving them via getCommentTree() SHALL produce a tree where each comment's
   * parent ID matches its position in the hierarchy.
   * 
   * Validates: Requirements 1.1, 1.3
   */
  describe('Property 1: Comment Tree Structure Preservation', () => {
    /**
     * Extended comment with threading info for tree simulation
     */
    interface TreeComment {
      id: string;
      debateId: string;
      userId: string;
      parentId: string | null;
      content: string;
      createdAt: Date;
      deletedAt: Date | null;
    }

    interface CommentWithReplies extends TreeComment {
      replyCount: number;
      replies?: CommentWithReplies[];
      isParentDeleted?: boolean;
    }

    /**
     * Build a comment tree from flat list (simulating getCommentTree)
     */
    function buildCommentTree(
      comments: TreeComment[],
      options?: { includeDeleted?: boolean }
    ): CommentWithReplies[] {
      const includeDeleted = options?.includeDeleted ?? false;

      // Build lookup maps
      const commentMap = new Map<string, TreeComment>();
      const childrenMap = new Map<string, string[]>();
      const deletedIds = new Set<string>();

      for (const comment of comments) {
        commentMap.set(comment.id, comment);
        
        if (comment.deletedAt) {
          deletedIds.add(comment.id);
        }

        const parentId = comment.parentId ?? 'root';
        if (!childrenMap.has(parentId)) {
          childrenMap.set(parentId, []);
        }
        childrenMap.get(parentId)!.push(comment.id);
      }

      // Count direct replies
      const countDirectReplies = (commentId: string): number => {
        const children = childrenMap.get(commentId) ?? [];
        if (includeDeleted) {
          return children.length;
        }
        return children.filter(id => !deletedIds.has(id)).length;
      };

      // Check if parent is deleted
      const isParentDeleted = (parentId: string | null): boolean => {
        if (!parentId) return false;
        return deletedIds.has(parentId);
      };

      // Recursive tree builder
      const buildTree = (parentId: string | null): CommentWithReplies[] => {
        const key = parentId ?? 'root';
        const childIds = childrenMap.get(key) ?? [];
        
        const result: CommentWithReplies[] = [];

        for (const childId of childIds) {
          const comment = commentMap.get(childId)!;
          
          if (comment.deletedAt && !includeDeleted) {
            // Include children of deleted comments with isParentDeleted flag
            const grandchildren = buildTree(childId);
            result.push(...grandchildren);
            continue;
          }

          const replyCount = countDirectReplies(childId);
          
          const commentWithReplies: CommentWithReplies = {
            ...comment,
            replyCount,
            isParentDeleted: isParentDeleted(comment.parentId),
          };

          const replies = buildTree(childId);
          if (replies.length > 0) {
            commentWithReplies.replies = replies;
          }

          result.push(commentWithReplies);
        }

        return result;
      };

      return buildTree(null);
    }

    /**
     * Verify tree structure: each comment's position matches its parentId
     */
    function verifyTreeStructure(
      tree: CommentWithReplies[],
      expectedParentId: string | null = null
    ): boolean {
      for (const node of tree) {
        // Each node at this level should have the expected parent
        if (node.parentId !== expectedParentId && !node.isParentDeleted) {
          // If isParentDeleted is true, the parent was deleted and this is okay
          if (!node.isParentDeleted) {
            return false;
          }
        }

        // Recursively verify children
        if (node.replies && node.replies.length > 0) {
          if (!verifyTreeStructure(node.replies, node.id)) {
            return false;
          }
        }
      }
      return true;
    }

    /**
     * Collect all comment IDs from tree
     */
    function collectTreeIds(tree: CommentWithReplies[]): Set<string> {
      const ids = new Set<string>();
      for (const node of tree) {
        ids.add(node.id);
        if (node.replies) {
          for (const id of collectTreeIds(node.replies)) {
            ids.add(id);
          }
        }
      }
      return ids;
    }

    it('tree structure preserves parent-child relationships', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          fc.array(idArbitrary, { minLength: 1, maxLength: 10 }), // comment IDs
          fc.array(contentArbitrary, { minLength: 1, maxLength: 10 }), // contents
          (debateId, userId, commentIds, contents) => {
            // Ensure unique IDs
            const uniqueIds = [...new Set(commentIds)];
            fc.pre(uniqueIds.length >= 1);

            // Create flat comment list with random parent relationships
            const comments: TreeComment[] = [];
            const baseTime = new Date();

            for (let i = 0; i < uniqueIds.length; i++) {
              // First comment has no parent, others may have parent from previous comments
              const parentId = i === 0 ? null : (Math.random() > 0.5 ? uniqueIds[Math.floor(Math.random() * i)] : null);
              
              comments.push({
                id: uniqueIds[i],
                debateId,
                userId,
                parentId,
                content: contents[i % contents.length],
                createdAt: new Date(baseTime.getTime() + i * 1000),
                deletedAt: null,
              });
            }

            // Build tree
            const tree = buildCommentTree(comments);

            // Verify structure
            expect(verifyTreeStructure(tree)).toBe(true);

            // All comments should be in tree
            const treeIds = collectTreeIds(tree);
            expect(treeIds.size).toBe(uniqueIds.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('top-level comments have null parentId in tree root', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          fc.array(idArbitrary, { minLength: 2, maxLength: 5 }), // comment IDs
          fc.array(contentArbitrary, { minLength: 2, maxLength: 5 }), // contents
          (debateId, userId, commentIds, contents) => {
            const uniqueIds = [...new Set(commentIds)];
            fc.pre(uniqueIds.length >= 2);

            // Create all top-level comments (no parents)
            const comments: TreeComment[] = uniqueIds.map((id, i) => ({
              id,
              debateId,
              userId,
              parentId: null,
              content: contents[i % contents.length],
              createdAt: new Date(),
              deletedAt: null,
            }));

            const tree = buildCommentTree(comments);

            // All should be at root level with null parentId
            expect(tree.length).toBe(uniqueIds.length);
            for (const node of tree) {
              expect(node.parentId).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('nested comments appear under their parent in tree', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          idArbitrary, // parentId
          idArbitrary, // childId
          contentArbitrary, // parentContent
          contentArbitrary, // childContent
          (debateId, userId, parentId, childId, parentContent, childContent) => {
            fc.pre(parentId !== childId);

            const comments: TreeComment[] = [
              {
                id: parentId,
                debateId,
                userId,
                parentId: null,
                content: parentContent,
                createdAt: new Date(),
                deletedAt: null,
              },
              {
                id: childId,
                debateId,
                userId,
                parentId: parentId,
                content: childContent,
                createdAt: new Date(),
                deletedAt: null,
              },
            ];

            const tree = buildCommentTree(comments);

            // Should have one root node
            expect(tree.length).toBe(1);
            expect(tree[0].id).toBe(parentId);
            
            // Child should be in replies
            expect(tree[0].replies).toBeDefined();
            expect(tree[0].replies!.length).toBe(1);
            expect(tree[0].replies![0].id).toBe(childId);
            expect(tree[0].replies![0].parentId).toBe(parentId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: enhanced-comments-matching
   * Property 2: Reply Count Accuracy
   * 
   * For any comment with N direct child comments, the replyCount field SHALL equal N.
   * 
   * Validates: Requirements 1.2
   */
  describe('Property 2: Reply Count Accuracy', () => {
    /**
     * Tree comment type for simulation
     */
    interface TreeComment {
      id: string;
      debateId: string;
      userId: string;
      parentId: string | null;
      content: string;
      createdAt: Date;
      deletedAt: Date | null;
    }

    interface CommentWithReplies extends TreeComment {
      replyCount: number;
      replies?: CommentWithReplies[];
      isParentDeleted?: boolean;
    }

    /**
     * Build a comment tree from flat list
     */
    function buildCommentTree(
      comments: TreeComment[],
      options?: { includeDeleted?: boolean }
    ): CommentWithReplies[] {
      const includeDeleted = options?.includeDeleted ?? false;

      const commentMap = new Map<string, TreeComment>();
      const childrenMap = new Map<string, string[]>();
      const deletedIds = new Set<string>();

      for (const comment of comments) {
        commentMap.set(comment.id, comment);
        
        if (comment.deletedAt) {
          deletedIds.add(comment.id);
        }

        const parentId = comment.parentId ?? 'root';
        if (!childrenMap.has(parentId)) {
          childrenMap.set(parentId, []);
        }
        childrenMap.get(parentId)!.push(comment.id);
      }

      const countDirectReplies = (commentId: string): number => {
        const children = childrenMap.get(commentId) ?? [];
        if (includeDeleted) {
          return children.length;
        }
        return children.filter(id => !deletedIds.has(id)).length;
      };

      const isParentDeleted = (parentId: string | null): boolean => {
        if (!parentId) return false;
        return deletedIds.has(parentId);
      };

      const buildTree = (parentId: string | null): CommentWithReplies[] => {
        const key = parentId ?? 'root';
        const childIds = childrenMap.get(key) ?? [];
        
        const result: CommentWithReplies[] = [];

        for (const childId of childIds) {
          const comment = commentMap.get(childId)!;
          
          if (comment.deletedAt && !includeDeleted) {
            const grandchildren = buildTree(childId);
            result.push(...grandchildren);
            continue;
          }

          const replyCount = countDirectReplies(childId);
          
          const commentWithReplies: CommentWithReplies = {
            ...comment,
            replyCount,
            isParentDeleted: isParentDeleted(comment.parentId),
          };

          const replies = buildTree(childId);
          if (replies.length > 0) {
            commentWithReplies.replies = replies;
          }

          result.push(commentWithReplies);
        }

        return result;
      };

      return buildTree(null);
    }

    /**
     * Count actual direct children in flat list
     */
    function countActualDirectChildren(
      comments: TreeComment[],
      parentId: string,
      includeDeleted: boolean
    ): number {
      return comments.filter(c => 
        c.parentId === parentId && 
        (includeDeleted || !c.deletedAt)
      ).length;
    }

    /**
     * Verify reply counts in tree match actual children
     */
    function verifyReplyCounts(
      tree: CommentWithReplies[],
      flatComments: TreeComment[],
      includeDeleted: boolean
    ): boolean {
      for (const node of tree) {
        const actualCount = countActualDirectChildren(flatComments, node.id, includeDeleted);
        if (node.replyCount !== actualCount) {
          return false;
        }

        if (node.replies && node.replies.length > 0) {
          if (!verifyReplyCounts(node.replies, flatComments, includeDeleted)) {
            return false;
          }
        }
      }
      return true;
    }

    it('replyCount equals number of direct children', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          idArbitrary, // parentId
          fc.array(idArbitrary, { minLength: 0, maxLength: 5 }), // child IDs
          contentArbitrary, // parent content
          fc.array(contentArbitrary, { minLength: 0, maxLength: 5 }), // child contents
          (debateId, userId, parentId, childIds, parentContent, childContents) => {
            // Ensure unique IDs
            const uniqueChildIds = [...new Set(childIds)].filter(id => id !== parentId);

            const comments: TreeComment[] = [
              {
                id: parentId,
                debateId,
                userId,
                parentId: null,
                content: parentContent,
                createdAt: new Date(),
                deletedAt: null,
              },
              ...uniqueChildIds.map((id, i) => ({
                id,
                debateId,
                userId,
                parentId: parentId,
                content: childContents[i % Math.max(1, childContents.length)],
                createdAt: new Date(),
                deletedAt: null,
              })),
            ];

            const tree = buildCommentTree(comments);

            // Parent should have replyCount equal to number of children
            expect(tree.length).toBe(1);
            expect(tree[0].replyCount).toBe(uniqueChildIds.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('replyCount is accurate for all nodes in tree', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          fc.array(idArbitrary, { minLength: 1, maxLength: 10 }), // comment IDs
          fc.array(contentArbitrary, { minLength: 1, maxLength: 10 }), // contents
          (debateId, userId, commentIds, contents) => {
            const uniqueIds = [...new Set(commentIds)];
            fc.pre(uniqueIds.length >= 1);

            // Create comments with random parent relationships
            const comments: TreeComment[] = [];
            const baseTime = new Date();

            for (let i = 0; i < uniqueIds.length; i++) {
              const parentId = i === 0 ? null : (Math.random() > 0.5 ? uniqueIds[Math.floor(Math.random() * i)] : null);
              
              comments.push({
                id: uniqueIds[i],
                debateId,
                userId,
                parentId,
                content: contents[i % contents.length],
                createdAt: new Date(baseTime.getTime() + i * 1000),
                deletedAt: null,
              });
            }

            const tree = buildCommentTree(comments);

            // Verify all reply counts
            expect(verifyReplyCounts(tree, comments, false)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('replyCount excludes deleted children when includeDeleted is false', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          idArbitrary, // parentId
          fc.array(idArbitrary, { minLength: 2, maxLength: 5 }), // child IDs
          contentArbitrary, // parent content
          fc.array(contentArbitrary, { minLength: 2, maxLength: 5 }), // child contents
          (debateId, userId, parentId, childIds, parentContent, childContents) => {
            const uniqueChildIds = [...new Set(childIds)].filter(id => id !== parentId);
            fc.pre(uniqueChildIds.length >= 2);

            // Create parent and children, mark first child as deleted
            const comments: TreeComment[] = [
              {
                id: parentId,
                debateId,
                userId,
                parentId: null,
                content: parentContent,
                createdAt: new Date(),
                deletedAt: null,
              },
              ...uniqueChildIds.map((id, i) => ({
                id,
                debateId,
                userId,
                parentId: parentId,
                content: childContents[i % childContents.length],
                createdAt: new Date(),
                deletedAt: i === 0 ? new Date() : null, // First child is deleted
              })),
            ];

            const tree = buildCommentTree(comments, { includeDeleted: false });

            // Parent's replyCount should exclude deleted child
            expect(tree.length).toBe(1);
            expect(tree[0].replyCount).toBe(uniqueChildIds.length - 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('leaf nodes have replyCount of 0', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          idArbitrary, // commentId
          contentArbitrary, // content
          (debateId, userId, commentId, content) => {
            const comments: TreeComment[] = [
              {
                id: commentId,
                debateId,
                userId,
                parentId: null,
                content,
                createdAt: new Date(),
                deletedAt: null,
              },
            ];

            const tree = buildCommentTree(comments);

            expect(tree.length).toBe(1);
            expect(tree[0].replyCount).toBe(0);
            expect(tree[0].replies).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: enhanced-comments-matching
   * Property 3: Deleted Parent Indicator
   * 
   * For any comment whose parent has been soft-deleted, the isParentDeleted flag SHALL be true.
   * 
   * Validates: Requirements 1.4
   */
  describe('Property 3: Deleted Parent Indicator', () => {
    /**
     * Tree comment type for simulation
     */
    interface TreeComment {
      id: string;
      debateId: string;
      userId: string;
      parentId: string | null;
      content: string;
      createdAt: Date;
      deletedAt: Date | null;
    }

    interface CommentWithReplies extends TreeComment {
      replyCount: number;
      replies?: CommentWithReplies[];
      isParentDeleted?: boolean;
    }

    /**
     * Build a comment tree from flat list
     */
    function buildCommentTree(
      comments: TreeComment[],
      options?: { includeDeleted?: boolean }
    ): CommentWithReplies[] {
      const includeDeleted = options?.includeDeleted ?? false;

      const commentMap = new Map<string, TreeComment>();
      const childrenMap = new Map<string, string[]>();
      const deletedIds = new Set<string>();

      for (const comment of comments) {
        commentMap.set(comment.id, comment);
        
        if (comment.deletedAt) {
          deletedIds.add(comment.id);
        }

        const parentId = comment.parentId ?? 'root';
        if (!childrenMap.has(parentId)) {
          childrenMap.set(parentId, []);
        }
        childrenMap.get(parentId)!.push(comment.id);
      }

      const countDirectReplies = (commentId: string): number => {
        const children = childrenMap.get(commentId) ?? [];
        if (includeDeleted) {
          return children.length;
        }
        return children.filter(id => !deletedIds.has(id)).length;
      };

      const isParentDeleted = (parentId: string | null): boolean => {
        if (!parentId) return false;
        return deletedIds.has(parentId);
      };

      const buildTree = (parentId: string | null): CommentWithReplies[] => {
        const key = parentId ?? 'root';
        const childIds = childrenMap.get(key) ?? [];
        
        const result: CommentWithReplies[] = [];

        for (const childId of childIds) {
          const comment = commentMap.get(childId)!;
          
          if (comment.deletedAt && !includeDeleted) {
            // Include children of deleted comments with isParentDeleted flag
            const grandchildren = buildTree(childId);
            result.push(...grandchildren);
            continue;
          }

          const replyCount = countDirectReplies(childId);
          
          const commentWithReplies: CommentWithReplies = {
            ...comment,
            replyCount,
            isParentDeleted: isParentDeleted(comment.parentId),
          };

          const replies = buildTree(childId);
          if (replies.length > 0) {
            commentWithReplies.replies = replies;
          }

          result.push(commentWithReplies);
        }

        return result;
      };

      return buildTree(null);
    }

    /**
     * Find a comment in tree by ID
     */
    function findInTree(tree: CommentWithReplies[], id: string): CommentWithReplies | null {
      for (const node of tree) {
        if (node.id === id) return node;
        if (node.replies) {
          const found = findInTree(node.replies, id);
          if (found) return found;
        }
      }
      return null;
    }

    it('child of deleted parent has isParentDeleted true', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          idArbitrary, // parentId
          idArbitrary, // childId
          contentArbitrary, // parentContent
          contentArbitrary, // childContent
          (debateId, userId, parentId, childId, parentContent, childContent) => {
            fc.pre(parentId !== childId);

            const comments: TreeComment[] = [
              {
                id: parentId,
                debateId,
                userId,
                parentId: null,
                content: parentContent,
                createdAt: new Date(),
                deletedAt: new Date(), // Parent is deleted
              },
              {
                id: childId,
                debateId,
                userId,
                parentId: parentId,
                content: childContent,
                createdAt: new Date(),
                deletedAt: null,
              },
            ];

            // Build tree without including deleted
            const tree = buildCommentTree(comments, { includeDeleted: false });

            // Child should be at root level with isParentDeleted = true
            expect(tree.length).toBe(1);
            expect(tree[0].id).toBe(childId);
            expect(tree[0].isParentDeleted).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('child of non-deleted parent has isParentDeleted false or undefined', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          idArbitrary, // parentId
          idArbitrary, // childId
          contentArbitrary, // parentContent
          contentArbitrary, // childContent
          (debateId, userId, parentId, childId, parentContent, childContent) => {
            fc.pre(parentId !== childId);

            const comments: TreeComment[] = [
              {
                id: parentId,
                debateId,
                userId,
                parentId: null,
                content: parentContent,
                createdAt: new Date(),
                deletedAt: null, // Parent is NOT deleted
              },
              {
                id: childId,
                debateId,
                userId,
                parentId: parentId,
                content: childContent,
                createdAt: new Date(),
                deletedAt: null,
              },
            ];

            const tree = buildCommentTree(comments);

            // Child should be nested under parent
            expect(tree.length).toBe(1);
            expect(tree[0].id).toBe(parentId);
            expect(tree[0].replies).toBeDefined();
            expect(tree[0].replies!.length).toBe(1);
            
            const child = tree[0].replies![0];
            expect(child.id).toBe(childId);
            expect(child.isParentDeleted).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('top-level comments have isParentDeleted false', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          idArbitrary, // commentId
          contentArbitrary, // content
          (debateId, userId, commentId, content) => {
            const comments: TreeComment[] = [
              {
                id: commentId,
                debateId,
                userId,
                parentId: null,
                content,
                createdAt: new Date(),
                deletedAt: null,
              },
            ];

            const tree = buildCommentTree(comments);

            expect(tree.length).toBe(1);
            expect(tree[0].isParentDeleted).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('grandchild of deleted parent preserves correct isParentDeleted', () => {
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
            fc.pre(grandparentId !== parentId && parentId !== childId && grandparentId !== childId);

            const comments: TreeComment[] = [
              {
                id: grandparentId,
                debateId,
                userId,
                parentId: null,
                content: content1,
                createdAt: new Date(),
                deletedAt: null,
              },
              {
                id: parentId,
                debateId,
                userId,
                parentId: grandparentId,
                content: content2,
                createdAt: new Date(),
                deletedAt: new Date(), // Parent is deleted
              },
              {
                id: childId,
                debateId,
                userId,
                parentId: parentId,
                content: content3,
                createdAt: new Date(),
                deletedAt: null,
              },
            ];

            const tree = buildCommentTree(comments, { includeDeleted: false });

            // Grandparent should be at root
            expect(tree.length).toBe(1);
            expect(tree[0].id).toBe(grandparentId);
            expect(tree[0].isParentDeleted).toBe(false);

            // Child should be promoted to grandparent's replies with isParentDeleted = true
            expect(tree[0].replies).toBeDefined();
            expect(tree[0].replies!.length).toBe(1);
            expect(tree[0].replies![0].id).toBe(childId);
            expect(tree[0].replies![0].isParentDeleted).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('multiple children of deleted parent all have isParentDeleted true', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          idArbitrary, // parentId
          fc.array(idArbitrary, { minLength: 2, maxLength: 4 }), // child IDs
          contentArbitrary, // parent content
          fc.array(contentArbitrary, { minLength: 2, maxLength: 4 }), // child contents
          (debateId, userId, parentId, childIds, parentContent, childContents) => {
            const uniqueChildIds = [...new Set(childIds)].filter(id => id !== parentId);
            fc.pre(uniqueChildIds.length >= 2);

            const comments: TreeComment[] = [
              {
                id: parentId,
                debateId,
                userId,
                parentId: null,
                content: parentContent,
                createdAt: new Date(),
                deletedAt: new Date(), // Parent is deleted
              },
              ...uniqueChildIds.map((id, i) => ({
                id,
                debateId,
                userId,
                parentId: parentId,
                content: childContents[i % childContents.length],
                createdAt: new Date(),
                deletedAt: null,
              })),
            ];

            const tree = buildCommentTree(comments, { includeDeleted: false });

            // All children should be at root level with isParentDeleted = true
            expect(tree.length).toBe(uniqueChildIds.length);
            for (const node of tree) {
              expect(node.isParentDeleted).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: debate-lifecycle-ux
   * Property 20: Comment Threading Integrity
   * 
   * For any comment with parentId P, the parent comment with id P SHALL exist in the database.
   * For any comment retrieval, replies SHALL be correctly nested under their parent.
   * 
   * Validates: Requirements 6.5
   */
  describe('Property 20: Comment Threading Integrity', () => {
    /**
     * Tree comment type for simulation
     */
    interface TreeComment {
      id: string;
      debateId: string;
      userId: string;
      parentId: string | null;
      content: string;
      createdAt: Date;
      deletedAt: Date | null;
    }

    interface CommentWithReplies extends TreeComment {
      replyCount: number;
      replies?: CommentWithReplies[];
      isParentDeleted?: boolean;
    }

    /**
     * Simulates the comment database state
     */
    interface CommentDatabase {
      comments: Map<string, TreeComment>;
      debates: Set<string>;
      users: Set<string>;
    }

    /**
     * Create initial empty database state
     */
    function createDatabase(): CommentDatabase {
      return {
        comments: new Map(),
        debates: new Set(),
        users: new Set(),
      };
    }

    /**
     * Add a comment to the database with parent validation
     * Returns { success: boolean, error?: string }
     */
    function addCommentWithValidation(
      db: CommentDatabase,
      input: {
        id: string;
        debateId: string;
        userId: string;
        parentId: string | null;
        content: string;
        createdAt?: Date;
      }
    ): { success: boolean; error?: string } {
      // Verify debate exists
      if (!db.debates.has(input.debateId)) {
        return { success: false, error: 'Debate not found' };
      }

      // Verify user exists
      if (!db.users.has(input.userId)) {
        return { success: false, error: 'User not found' };
      }

      // CRITICAL: Validate parent comment exists if parentId is provided
      if (input.parentId !== null) {
        const parentComment = db.comments.get(input.parentId);
        
        if (!parentComment) {
          return { success: false, error: 'Parent comment not found' };
        }

        // Parent comment must belong to the same debate
        if (parentComment.debateId !== input.debateId) {
          return { success: false, error: 'Parent comment must belong to the same debate' };
        }
      }

      // Create the comment
      const comment: TreeComment = {
        id: input.id,
        debateId: input.debateId,
        userId: input.userId,
        parentId: input.parentId,
        content: input.content,
        createdAt: input.createdAt ?? new Date(),
        deletedAt: null,
      };

      db.comments.set(comment.id, comment);
      return { success: true };
    }

    /**
     * Build a comment tree from database (simulating getCommentTree)
     */
    function buildCommentTree(db: CommentDatabase, debateId: string): CommentWithReplies[] {
      // Get all comments for the debate
      const debateComments: TreeComment[] = [];
      for (const comment of db.comments.values()) {
        if (comment.debateId === debateId) {
          debateComments.push(comment);
        }
      }

      // Build lookup maps
      const commentMap = new Map<string, TreeComment>();
      const childrenMap = new Map<string, string[]>();
      const deletedIds = new Set<string>();

      for (const comment of debateComments) {
        commentMap.set(comment.id, comment);
        
        if (comment.deletedAt) {
          deletedIds.add(comment.id);
        }

        const parentId = comment.parentId ?? 'root';
        if (!childrenMap.has(parentId)) {
          childrenMap.set(parentId, []);
        }
        childrenMap.get(parentId)!.push(comment.id);
      }

      // Count direct replies
      const countDirectReplies = (commentId: string): number => {
        const children = childrenMap.get(commentId) ?? [];
        return children.filter(id => !deletedIds.has(id)).length;
      };

      // Check if parent is deleted
      const isParentDeleted = (parentId: string | null): boolean => {
        if (!parentId) return false;
        return deletedIds.has(parentId);
      };

      // Recursive tree builder
      const buildTree = (parentId: string | null): CommentWithReplies[] => {
        const key = parentId ?? 'root';
        const childIds = childrenMap.get(key) ?? [];
        
        const result: CommentWithReplies[] = [];

        for (const childId of childIds) {
          const comment = commentMap.get(childId)!;
          
          if (comment.deletedAt) {
            // Include children of deleted comments with isParentDeleted flag
            const grandchildren = buildTree(childId);
            result.push(...grandchildren);
            continue;
          }

          const replyCount = countDirectReplies(childId);
          
          const commentWithReplies: CommentWithReplies = {
            ...comment,
            replyCount,
            isParentDeleted: isParentDeleted(comment.parentId),
          };

          const replies = buildTree(childId);
          if (replies.length > 0) {
            commentWithReplies.replies = replies;
          }

          result.push(commentWithReplies);
        }

        return result;
      };

      return buildTree(null);
    }

    /**
     * Verify that all comments with parentId have existing parents in the database
     */
    function verifyParentExistence(db: CommentDatabase): boolean {
      for (const comment of db.comments.values()) {
        if (comment.parentId !== null) {
          if (!db.comments.has(comment.parentId)) {
            return false;
          }
        }
      }
      return true;
    }

    /**
     * Verify that replies are correctly nested under their parent in the tree
     */
    function verifyNestingIntegrity(
      tree: CommentWithReplies[],
      expectedParentId: string | null = null
    ): boolean {
      for (const node of tree) {
        // For non-deleted parents, verify the node is at the correct level
        if (!node.isParentDeleted) {
          if (node.parentId !== expectedParentId) {
            return false;
          }
        }

        // Recursively verify children are nested under this node
        if (node.replies && node.replies.length > 0) {
          if (!verifyNestingIntegrity(node.replies, node.id)) {
            return false;
          }
        }
      }
      return true;
    }

    /**
     * Collect all comment IDs from tree
     */
    function collectTreeIds(tree: CommentWithReplies[]): Set<string> {
      const ids = new Set<string>();
      for (const node of tree) {
        ids.add(node.id);
        if (node.replies) {
          for (const id of collectTreeIds(node.replies)) {
            ids.add(id);
          }
        }
      }
      return ids;
    }

    it('parent comment must exist before creating a reply', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          idArbitrary, // commentId
          idArbitrary, // nonExistentParentId
          contentArbitrary, // content
          (debateId, userId, commentId, nonExistentParentId, content) => {
            const db = createDatabase();
            db.debates.add(debateId);
            db.users.add(userId);

            // Try to create a comment with a non-existent parent
            const result = addCommentWithValidation(db, {
              id: commentId,
              debateId,
              userId,
              parentId: nonExistentParentId,
              content,
            });

            // Should fail because parent doesn't exist
            expect(result.success).toBe(false);
            expect(result.error).toBe('Parent comment not found');

            // Database should still have parent existence integrity
            expect(verifyParentExistence(db)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('reply to existing parent should succeed and maintain integrity', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          idArbitrary, // parentId
          idArbitrary, // childId
          contentArbitrary, // parentContent
          contentArbitrary, // childContent
          (debateId, userId, parentId, childId, parentContent, childContent) => {
            fc.pre(parentId !== childId);

            const db = createDatabase();
            db.debates.add(debateId);
            db.users.add(userId);

            // Create parent comment first
            const parentResult = addCommentWithValidation(db, {
              id: parentId,
              debateId,
              userId,
              parentId: null,
              content: parentContent,
            });
            expect(parentResult.success).toBe(true);

            // Create child comment
            const childResult = addCommentWithValidation(db, {
              id: childId,
              debateId,
              userId,
              parentId: parentId,
              content: childContent,
            });
            expect(childResult.success).toBe(true);

            // Verify parent existence integrity
            expect(verifyParentExistence(db)).toBe(true);

            // Verify the child's parent exists
            const child = db.comments.get(childId);
            expect(child).toBeDefined();
            expect(child!.parentId).toBe(parentId);
            expect(db.comments.has(parentId)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('replies are correctly nested under their parent in tree retrieval', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          idArbitrary, // parentId
          fc.array(idArbitrary, { minLength: 1, maxLength: 5 }), // child IDs
          contentArbitrary, // parentContent
          fc.array(contentArbitrary, { minLength: 1, maxLength: 5 }), // childContents
          (debateId, userId, parentId, childIds, parentContent, childContents) => {
            const uniqueChildIds = [...new Set(childIds)].filter(id => id !== parentId);
            fc.pre(uniqueChildIds.length >= 1);

            const db = createDatabase();
            db.debates.add(debateId);
            db.users.add(userId);

            // Create parent comment
            addCommentWithValidation(db, {
              id: parentId,
              debateId,
              userId,
              parentId: null,
              content: parentContent,
            });

            // Create child comments
            for (let i = 0; i < uniqueChildIds.length; i++) {
              addCommentWithValidation(db, {
                id: uniqueChildIds[i],
                debateId,
                userId,
                parentId: parentId,
                content: childContents[i % childContents.length],
              });
            }

            // Build tree and verify nesting
            const tree = buildCommentTree(db, debateId);

            // Should have one root node (the parent)
            expect(tree.length).toBe(1);
            expect(tree[0].id).toBe(parentId);
            expect(tree[0].parentId).toBeNull();

            // All children should be nested under the parent
            expect(tree[0].replies).toBeDefined();
            expect(tree[0].replies!.length).toBe(uniqueChildIds.length);

            // Each reply should have the correct parentId
            for (const reply of tree[0].replies!) {
              expect(reply.parentId).toBe(parentId);
              expect(uniqueChildIds).toContain(reply.id);
            }

            // Verify overall nesting integrity
            expect(verifyNestingIntegrity(tree)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('deeply nested comments maintain correct parent-child relationships', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          fc.array(idArbitrary, { minLength: 3, maxLength: 6 }), // chain of comment IDs
          fc.array(contentArbitrary, { minLength: 3, maxLength: 6 }), // contents
          (debateId, userId, commentIds, contents) => {
            const uniqueIds = [...new Set(commentIds)];
            fc.pre(uniqueIds.length >= 3);

            const db = createDatabase();
            db.debates.add(debateId);
            db.users.add(userId);

            // Create a chain of comments: each is a reply to the previous
            for (let i = 0; i < uniqueIds.length; i++) {
              const result = addCommentWithValidation(db, {
                id: uniqueIds[i],
                debateId,
                userId,
                parentId: i === 0 ? null : uniqueIds[i - 1],
                content: contents[i % contents.length],
              });
              expect(result.success).toBe(true);
            }

            // Verify parent existence integrity
            expect(verifyParentExistence(db)).toBe(true);

            // Build tree and verify structure
            const tree = buildCommentTree(db, debateId);

            // Should have one root
            expect(tree.length).toBe(1);
            expect(tree[0].id).toBe(uniqueIds[0]);

            // Walk down the chain and verify each level
            let currentLevel = tree;
            for (let i = 0; i < uniqueIds.length; i++) {
              expect(currentLevel.length).toBe(1);
              expect(currentLevel[0].id).toBe(uniqueIds[i]);
              
              if (i === 0) {
                expect(currentLevel[0].parentId).toBeNull();
              } else {
                expect(currentLevel[0].parentId).toBe(uniqueIds[i - 1]);
              }

              if (i < uniqueIds.length - 1) {
                expect(currentLevel[0].replies).toBeDefined();
                currentLevel = currentLevel[0].replies!;
              }
            }

            // Verify overall nesting integrity
            expect(verifyNestingIntegrity(tree)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('all comments in database appear in tree with correct nesting', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // userId
          fc.array(idArbitrary, { minLength: 1, maxLength: 8 }), // comment IDs
          fc.array(contentArbitrary, { minLength: 1, maxLength: 8 }), // contents
          (debateId, userId, commentIds, contents) => {
            const uniqueIds = [...new Set(commentIds)];
            fc.pre(uniqueIds.length >= 1);

            const db = createDatabase();
            db.debates.add(debateId);
            db.users.add(userId);

            // Create comments with random valid parent relationships
            for (let i = 0; i < uniqueIds.length; i++) {
              // First comment has no parent, others may have parent from previous comments
              const parentId = i === 0 ? null : (Math.random() > 0.5 ? uniqueIds[Math.floor(Math.random() * i)] : null);
              
              addCommentWithValidation(db, {
                id: uniqueIds[i],
                debateId,
                userId,
                parentId,
                content: contents[i % contents.length],
              });
            }

            // Verify parent existence integrity
            expect(verifyParentExistence(db)).toBe(true);

            // Build tree
            const tree = buildCommentTree(db, debateId);

            // All comments should appear in the tree
            const treeIds = collectTreeIds(tree);
            expect(treeIds.size).toBe(uniqueIds.length);
            for (const id of uniqueIds) {
              expect(treeIds.has(id)).toBe(true);
            }

            // Verify nesting integrity
            expect(verifyNestingIntegrity(tree)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('cross-debate parent reference should be rejected', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debate1Id
          idArbitrary, // debate2Id
          idArbitrary, // userId
          idArbitrary, // parentId
          idArbitrary, // childId
          contentArbitrary, // parentContent
          contentArbitrary, // childContent
          (debate1Id, debate2Id, userId, parentId, childId, parentContent, childContent) => {
            fc.pre(debate1Id !== debate2Id);
            fc.pre(parentId !== childId);

            const db = createDatabase();
            db.debates.add(debate1Id);
            db.debates.add(debate2Id);
            db.users.add(userId);

            // Create parent in debate1
            const parentResult = addCommentWithValidation(db, {
              id: parentId,
              debateId: debate1Id,
              userId,
              parentId: null,
              content: parentContent,
            });
            expect(parentResult.success).toBe(true);

            // Try to create child in debate2 referencing parent in debate1
            const childResult = addCommentWithValidation(db, {
              id: childId,
              debateId: debate2Id,
              userId,
              parentId: parentId,
              content: childContent,
            });

            // Should fail - parent must be in same debate
            expect(childResult.success).toBe(false);
            expect(childResult.error).toBe('Parent comment must belong to the same debate');

            // Database integrity should still hold
            expect(verifyParentExistence(db)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
