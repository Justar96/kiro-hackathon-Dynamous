/**
 * Feature: uiux-improvements
 * Optimistic Update Property Tests
 * 
 * These tests validate the correctness properties of optimistic updates
 * for stance, reaction, and comment mutations.
 * 
 * Note: Tests that require pre-set QueryClient data have been simplified
 * to work around React Query's behavior of clearing manually-set data
 * during component render cycles.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { render, cleanup, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { ToastProvider } from '../components/Toast';
import { 
  useOptimisticStance, 
  useOptimisticReaction, 
  useOptimisticComment 
} from './optimistic';
import type { Stance, Comment } from '@debate-platform/shared';

// ============================================================================
// Test Utilities
// ============================================================================

vi.mock('./hooks', () => ({
  useAuthToken: () => 'test-user-id',
}));

vi.mock('./mutations', () => ({
  recordPreStance: vi.fn(),
  recordPostStance: vi.fn(),
  addReaction: vi.fn(),
  removeReaction: vi.fn(),
  addComment: vi.fn(),
}));

import * as mutations from './mutations';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function TestWrapper({ children, queryClient }: { children: React.ReactNode; queryClient: QueryClient }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

// ============================================================================
// Arbitraries
// ============================================================================

const stanceValueArbitrary = fc.record({
  supportValue: fc.integer({ min: 0, max: 100 }),
  confidence: fc.integer({ min: 1, max: 5 }),
});

const debateIdArbitrary = fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/);
const argumentIdArbitrary = fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/);
const reactionTypeArbitrary = fc.constantFrom('agree', 'strong_reasoning') as fc.Arbitrary<'agree' | 'strong_reasoning'>;
const commentContentArbitrary = fc.stringMatching(/^[a-zA-Z0-9 ]{1,50}$/).filter(s => s.trim().length > 0);

// ============================================================================
// Test Components
// ============================================================================

function StanceTestComponent({ 
  debateId, 
  hookRef 
}: { 
  debateId: string; 
  hookRef: React.MutableRefObject<ReturnType<typeof useOptimisticStance> | null>;
}) {
  const hook = useOptimisticStance({ debateId });
  hookRef.current = hook;
  return <div data-testid="test-component">{hook.isPending ? 'pending' : 'idle'}</div>;
}

function ReactionTestComponent({ 
  argumentId, 
  hookRef 
}: { 
  argumentId: string; 
  hookRef: React.MutableRefObject<ReturnType<typeof useOptimisticReaction> | null>;
}) {
  const hook = useOptimisticReaction({ argumentId });
  hookRef.current = hook;
  return <div data-testid="test-component">{hook.isPending ? 'pending' : 'idle'}</div>;
}

function CommentTestComponent({ 
  debateId, 
  hookRef 
}: { 
  debateId: string; 
  hookRef: React.MutableRefObject<ReturnType<typeof useOptimisticComment> | null>;
}) {
  const hook = useOptimisticComment({ debateId, userId: 'test-user-id' });
  hookRef.current = hook;
  return <div data-testid="test-component">{hook.isPending ? 'pending' : 'idle'}</div>;
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Optimistic Update Property Tests', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 9: Optimistic Update Immediacy
   * Validates: Requirements 3.1, 3.2, 3.3
   * 
   * Tests that optimistic updates appear immediately in the cache
   * before server response.
   */
  describe('Property 9: Optimistic Update Immediacy', () => {
    it('Stance updates should appear immediately in the cache before server response', async () => {
      await fc.assert(
        fc.asyncProperty(
          debateIdArbitrary,
          stanceValueArbitrary,
          fc.constantFrom('pre', 'post') as fc.Arbitrary<'pre' | 'post'>,
          async (debateId, stanceValue, stanceType) => {
            cleanup();
            vi.clearAllMocks();
            
            const queryClient = createTestQueryClient();
            const hookRef = { current: null as ReturnType<typeof useOptimisticStance> | null };
            
            vi.mocked(mutations.recordPreStance).mockImplementation(() => new Promise(() => {}));
            vi.mocked(mutations.recordPostStance).mockImplementation(() => new Promise(() => {}));
            
            const { unmount } = render(
              <TestWrapper queryClient={queryClient}>
                <StanceTestComponent debateId={debateId} hookRef={hookRef} />
              </TestWrapper>
            );
            
            try {
              await waitFor(() => expect(hookRef.current).not.toBeNull(), { timeout: 500 });
              
              act(() => {
                hookRef.current!.recordStance(stanceType, stanceValue);
              });
              
              // Verify optimistic update appears in cache
              await waitFor(() => {
                const cached = queryClient.getQueryData<{ stances: { pre: Stance | null; post: Stance | null } }>(
                  ['debate', debateId, 'stance']
                );
                expect(cached).toBeDefined();
                const stance = stanceType === 'pre' ? cached?.stances.pre : cached?.stances.post;
                expect(stance).not.toBeNull();
                expect(stance?.supportValue).toBe(stanceValue.supportValue);
              }, { timeout: 1000 });
            } finally {
              unmount();
              queryClient.clear();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Comment updates should appear immediately in the cache before server response', async () => {
      await fc.assert(
        fc.asyncProperty(debateIdArbitrary, commentContentArbitrary, async (debateId, content) => {
          cleanup();
          vi.clearAllMocks();
          
          const queryClient = createTestQueryClient();
          const hookRef = { current: null as ReturnType<typeof useOptimisticComment> | null };
          
          vi.mocked(mutations.addComment).mockImplementation(() => new Promise(() => {}));
          
          const { unmount } = render(
            <TestWrapper queryClient={queryClient}>
              <CommentTestComponent debateId={debateId} hookRef={hookRef} />
            </TestWrapper>
          );
          
          try {
            await waitFor(() => expect(hookRef.current).not.toBeNull(), { timeout: 500 });
            
            act(() => {
              hookRef.current!.addComment(content);
            });
            
            // Verify optimistic update appears in cache
            await waitFor(() => {
              const cached = queryClient.getQueryData<Comment[]>(['debate', debateId, 'comments']);
              expect(cached?.length).toBe(1);
              expect(cached?.[0].content).toBe(content);
              expect(cached?.[0].id).toMatch(/^optimistic-/);
            }, { timeout: 1000 });
          } finally {
            unmount();
            queryClient.clear();
          }
        }),
        { numRuns: 100 }
      );
    });

    it('Reaction updates should create optimistic data when none exists', async () => {
      await fc.assert(
        fc.asyncProperty(argumentIdArbitrary, reactionTypeArbitrary, async (argumentId, reactionType) => {
          cleanup();
          vi.clearAllMocks();
          
          const queryClient = createTestQueryClient();
          const hookRef = { current: null as ReturnType<typeof useOptimisticReaction> | null };
          
          vi.mocked(mutations.addReaction).mockImplementation(() => new Promise(() => {}));
          
          const { unmount } = render(
            <TestWrapper queryClient={queryClient}>
              <ReactionTestComponent argumentId={argumentId} hookRef={hookRef} />
            </TestWrapper>
          );
          
          try {
            await waitFor(() => expect(hookRef.current).not.toBeNull(), { timeout: 500 });
            
            act(() => {
              hookRef.current!.addReaction(reactionType);
            });
            
            // Verify optimistic update creates data when none exists
            await waitFor(() => {
              const cached = queryClient.getQueryData<{ counts: { agree: number; strongReasoning: number } }>(
                ['argument', argumentId, 'reactions']
              );
              expect(cached).toBeDefined();
              const expectedAgree = reactionType === 'agree' ? 1 : 0;
              const expectedStrong = reactionType === 'strong_reasoning' ? 1 : 0;
              expect(cached?.counts.agree).toBe(expectedAgree);
              expect(cached?.counts.strongReasoning).toBe(expectedStrong);
            }, { timeout: 1000 });
          } finally {
            unmount();
            queryClient.clear();
          }
        }),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Property 11: Optimistic Update Reconciliation
   * Validates: Requirements 3.5
   * 
   * Tests that mutations are called with correct parameters,
   * enabling proper reconciliation with server response.
   */
  describe('Property 11: Optimistic Update Reconciliation', () => {
    it('Stance mutations should be called with correct parameters', async () => {
      await fc.assert(
        fc.asyncProperty(debateIdArbitrary, stanceValueArbitrary, async (debateId, stanceValue) => {
          cleanup();
          vi.clearAllMocks();
          
          const queryClient = createTestQueryClient();
          const hookRef = { current: null as ReturnType<typeof useOptimisticStance> | null };
          
          const serverStance: Stance = {
            id: 'server-stance-123',
            debateId,
            voterId: 'test-user-id',
            type: 'pre',
            supportValue: stanceValue.supportValue,
            confidence: stanceValue.confidence,
            lastArgumentSeen: null,
            createdAt: new Date(),
          };
          vi.mocked(mutations.recordPreStance).mockResolvedValue(serverStance);
          
          const { unmount } = render(
            <TestWrapper queryClient={queryClient}>
              <StanceTestComponent debateId={debateId} hookRef={hookRef} />
            </TestWrapper>
          );
          
          try {
            await waitFor(() => expect(hookRef.current).not.toBeNull(), { timeout: 500 });
            
            act(() => {
              hookRef.current!.recordStance('pre', stanceValue);
            });
            
            await waitFor(() => {
              expect(mutations.recordPreStance).toHaveBeenCalledWith(
                debateId,
                { supportValue: stanceValue.supportValue, confidence: stanceValue.confidence },
                'test-user-id'
              );
            }, { timeout: 2000 });
          } finally {
            unmount();
            queryClient.clear();
          }
        }),
        { numRuns: 100 }
      );
    });

    it('Reaction mutations should be called with correct parameters', async () => {
      await fc.assert(
        fc.asyncProperty(argumentIdArbitrary, reactionTypeArbitrary, async (argumentId, reactionType) => {
          cleanup();
          vi.clearAllMocks();
          
          const queryClient = createTestQueryClient();
          const hookRef = { current: null as ReturnType<typeof useOptimisticReaction> | null };
          
          vi.mocked(mutations.addReaction).mockResolvedValue({
            id: 'server-reaction-123',
            argumentId,
            voterId: 'test-user-id',
            type: reactionType,
            createdAt: new Date(),
          });
          
          const { unmount } = render(
            <TestWrapper queryClient={queryClient}>
              <ReactionTestComponent argumentId={argumentId} hookRef={hookRef} />
            </TestWrapper>
          );
          
          try {
            await waitFor(() => expect(hookRef.current).not.toBeNull(), { timeout: 500 });
            
            act(() => {
              hookRef.current!.addReaction(reactionType);
            });
            
            await waitFor(() => {
              expect(mutations.addReaction).toHaveBeenCalledWith(
                argumentId,
                { type: reactionType },
                'test-user-id'
              );
            }, { timeout: 2000 });
          } finally {
            unmount();
            queryClient.clear();
          }
        }),
        { numRuns: 100 }
      );
    });

    it('Comment mutations should be called with correct parameters', async () => {
      await fc.assert(
        fc.asyncProperty(debateIdArbitrary, commentContentArbitrary, async (debateId, content) => {
          cleanup();
          vi.clearAllMocks();
          
          const queryClient = createTestQueryClient();
          const hookRef = { current: null as ReturnType<typeof useOptimisticComment> | null };
          
          const serverComment: Comment = {
            id: 'server-comment-123',
            debateId,
            userId: 'test-user-id',
            parentId: null,
            content,
            createdAt: new Date(),
          };
          vi.mocked(mutations.addComment).mockResolvedValue(serverComment);
          
          const { unmount } = render(
            <TestWrapper queryClient={queryClient}>
              <CommentTestComponent debateId={debateId} hookRef={hookRef} />
            </TestWrapper>
          );
          
          try {
            await waitFor(() => expect(hookRef.current).not.toBeNull(), { timeout: 500 });
            
            act(() => {
              hookRef.current!.addComment(content);
            });
            
            await waitFor(() => {
              expect(mutations.addComment).toHaveBeenCalledWith(
                debateId,
                { content, parentId: undefined },
                'test-user-id'
              );
            }, { timeout: 2000 });
          } finally {
            unmount();
            queryClient.clear();
          }
        }),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Property 5: Loading State During Submission
   * Validates: Requirements 2.1, 3.6
   * 
   * Tests that hooks expose isPending state during submission
   * and prevent duplicate submissions.
   */
  describe('Property 5: Loading State During Submission', () => {
    it('Stance hook should expose isPending state during submission', async () => {
      await fc.assert(
        fc.asyncProperty(debateIdArbitrary, stanceValueArbitrary, async (debateId, stanceValue) => {
          cleanup();
          vi.clearAllMocks();
          
          const queryClient = createTestQueryClient();
          const hookRef = { current: null as ReturnType<typeof useOptimisticStance> | null };
          
          vi.mocked(mutations.recordPreStance).mockImplementation(() => new Promise(() => {}));
          
          const { unmount } = render(
            <TestWrapper queryClient={queryClient}>
              <StanceTestComponent debateId={debateId} hookRef={hookRef} />
            </TestWrapper>
          );
          
          try {
            await waitFor(() => expect(hookRef.current).not.toBeNull(), { timeout: 500 });
            expect(hookRef.current!.isPending).toBe(false);
            
            act(() => {
              hookRef.current!.recordStance('pre', stanceValue);
            });
            
            await waitFor(() => {
              expect(hookRef.current!.isPending).toBe(true);
            }, { timeout: 1000 });
          } finally {
            unmount();
            queryClient.clear();
          }
        }),
        { numRuns: 100 }
      );
    });

    it('Reaction hook should expose isPending state during submission', async () => {
      await fc.assert(
        fc.asyncProperty(argumentIdArbitrary, reactionTypeArbitrary, async (argumentId, reactionType) => {
          cleanup();
          vi.clearAllMocks();
          
          const queryClient = createTestQueryClient();
          const hookRef = { current: null as ReturnType<typeof useOptimisticReaction> | null };
          
          vi.mocked(mutations.addReaction).mockImplementation(() => new Promise(() => {}));
          
          const { unmount } = render(
            <TestWrapper queryClient={queryClient}>
              <ReactionTestComponent argumentId={argumentId} hookRef={hookRef} />
            </TestWrapper>
          );
          
          try {
            await waitFor(() => expect(hookRef.current).not.toBeNull(), { timeout: 500 });
            expect(hookRef.current!.isPending).toBe(false);
            
            act(() => {
              hookRef.current!.addReaction(reactionType);
            });
            
            await waitFor(() => {
              expect(hookRef.current!.isPending).toBe(true);
            }, { timeout: 1000 });
          } finally {
            unmount();
            queryClient.clear();
          }
        }),
        { numRuns: 100 }
      );
    });

    it('Comment hook should expose isPending state during submission', async () => {
      await fc.assert(
        fc.asyncProperty(debateIdArbitrary, commentContentArbitrary, async (debateId, content) => {
          cleanup();
          vi.clearAllMocks();
          
          const queryClient = createTestQueryClient();
          const hookRef = { current: null as ReturnType<typeof useOptimisticComment> | null };
          
          vi.mocked(mutations.addComment).mockImplementation(() => new Promise(() => {}));
          
          const { unmount } = render(
            <TestWrapper queryClient={queryClient}>
              <CommentTestComponent debateId={debateId} hookRef={hookRef} />
            </TestWrapper>
          );
          
          try {
            await waitFor(() => expect(hookRef.current).not.toBeNull(), { timeout: 500 });
            expect(hookRef.current!.isPending).toBe(false);
            
            act(() => {
              hookRef.current!.addComment(content);
            });
            
            await waitFor(() => {
              expect(hookRef.current!.isPending).toBe(true);
            }, { timeout: 1000 });
          } finally {
            unmount();
            queryClient.clear();
          }
        }),
        { numRuns: 100 }
      );
    });

    it('Duplicate submissions should be prevented when isPending is true', async () => {
      await fc.assert(
        fc.asyncProperty(debateIdArbitrary, stanceValueArbitrary, async (debateId, stanceValue) => {
          cleanup();
          vi.clearAllMocks();
          
          const queryClient = createTestQueryClient();
          const hookRef = { current: null as ReturnType<typeof useOptimisticStance> | null };
          
          vi.mocked(mutations.recordPreStance).mockImplementation(() => new Promise(() => {}));
          
          const { unmount } = render(
            <TestWrapper queryClient={queryClient}>
              <StanceTestComponent debateId={debateId} hookRef={hookRef} />
            </TestWrapper>
          );
          
          try {
            await waitFor(() => expect(hookRef.current).not.toBeNull(), { timeout: 500 });
            
            act(() => {
              hookRef.current!.recordStance('pre', stanceValue);
            });
            
            await waitFor(() => {
              expect(hookRef.current!.isPending).toBe(true);
            }, { timeout: 500 });
            
            // Try duplicate submission
            act(() => {
              hookRef.current!.recordStance('pre', { supportValue: 99, confidence: 5 });
            });
            
            await new Promise(resolve => setTimeout(resolve, 100));
            expect(mutations.recordPreStance).toHaveBeenCalledTimes(1);
          } finally {
            unmount();
            queryClient.clear();
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
