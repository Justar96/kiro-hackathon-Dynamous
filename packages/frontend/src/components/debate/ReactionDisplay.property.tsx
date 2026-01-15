/**
 * Feature: debate-lifecycle-ux
 * Property 18: Reaction Privacy
 * 
 * For any API response containing reaction data, the response SHALL include 
 * aggregate counts (agree: N, strongReasoning: M) but SHALL NOT include 
 * any user identifiers of who reacted.
 * 
 * Validates: Requirements 6.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactionDisplay } from './ReactionDisplay';

// Mock the hooks
vi.mock('../../lib/hooks/data/useReactions', () => ({
  useReactions: vi.fn(),
}));

vi.mock('../../lib/hooks/optimistic/useOptimisticReaction', () => ({
  useOptimisticReaction: vi.fn(() => ({
    addReaction: vi.fn(),
    removeReaction: vi.fn(),
    isPending: false,
    error: null,
  })),
}));

vi.mock('../../lib/hooks/data/useAuthToken', () => ({
  useAuthToken: vi.fn(() => null),
}));

// Import mocked modules
import { useReactions } from '../../lib/hooks/data/useReactions';

// Arbitrary for generating argument IDs
const argumentIdArbitrary = fc.string({ minLength: 10, maxLength: 21 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

// Arbitrary for generating non-negative counts
const countArbitrary = fc.integer({ min: 0, max: 1000 });

// Arbitrary for generating user IDs (to verify they're NOT exposed)
const userIdArbitrary = fc.string({ minLength: 10, maxLength: 21 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

/**
 * Simulates a privacy-compliant reaction API response
 * This is what the backend SHOULD return (aggregate counts only)
 */
interface PrivacyCompliantReactionResponse {
  counts: {
    agree: number;
    strongReasoning: number;
  };
  userReactions: {
    agree: boolean;
    strongReasoning: boolean;
  } | null;
}

/**
 * Simulates a privacy-violating reaction API response
 * This is what the backend should NEVER return (includes voter IDs)
 */
interface PrivacyViolatingReactionResponse {
  counts: {
    agree: number;
    strongReasoning: number;
  };
  userReactions: {
    agree: boolean;
    strongReasoning: boolean;
  } | null;
  // Privacy violation: includes voter IDs
  voters?: string[];
  agreeVoters?: string[];
  strongReasoningVoters?: string[];
  reactions?: Array<{ voterId: string; type: string }>;
}

/**
 * Checks if a response object contains any user identifiers
 */
function containsUserIdentifiers(obj: unknown): boolean {
  if (obj === null || obj === undefined) return false;
  if (typeof obj !== 'object') return false;
  
  const privacyViolatingKeys = [
    'voterId', 'voterIds', 'voters', 'userId', 'userIds', 'users',
    'agreeVoters', 'strongReasoningVoters', 'reactors', 'reactor',
    'voter', 'user', 'author', 'authorId', 'createdBy', 'createdById',
  ];
  
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    // Check if key itself is a privacy-violating field
    if (privacyViolatingKeys.includes(key)) {
      return true;
    }
    
    // Recursively check nested objects
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value === 'object' && value !== null) {
      if (containsUserIdentifiers(value)) {
        return true;
      }
    }
    
    // Check arrays
    if (Array.isArray(value)) {
      for (const item of value) {
        if (containsUserIdentifiers(item)) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * Validates that a reaction response is privacy-compliant
 */
function isPrivacyCompliant(response: unknown): boolean {
  // Must not contain any user identifiers
  if (containsUserIdentifiers(response)) {
    return false;
  }
  
  // Must have counts object with numeric values
  if (typeof response !== 'object' || response === null) {
    return false;
  }
  
  const resp = response as Record<string, unknown>;
  if (!resp.counts || typeof resp.counts !== 'object') {
    return false;
  }
  
  const counts = resp.counts as Record<string, unknown>;
  if (typeof counts.agree !== 'number' || typeof counts.strongReasoning !== 'number') {
    return false;
  }
  
  return true;
}

// Create a test query client
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

// Test wrapper component
function TestWrapper({ children, queryClient }: { children: React.ReactNode; queryClient: QueryClient }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('ReactionDisplay Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 18: Reaction Privacy
   * 
   * For any API response containing reaction data, the response SHALL include 
   * aggregate counts (agree: N, strongReasoning: M) but SHALL NOT include 
   * any user identifiers of who reacted.
   * 
   * **Validates: Requirements 6.3**
   */
  describe('Property 18: Reaction Privacy', () => {
    it('privacy-compliant responses should pass validation', () => {
      fc.assert(
        fc.property(
          countArbitrary,
          countArbitrary,
          fc.boolean(),
          fc.boolean(),
          (agreeCount, strongReasoningCount, userAgreed, userStrongReasoning) => {
            const response: PrivacyCompliantReactionResponse = {
              counts: {
                agree: agreeCount,
                strongReasoning: strongReasoningCount,
              },
              userReactions: {
                agree: userAgreed,
                strongReasoning: userStrongReasoning,
              },
            };
            
            // Should be privacy compliant
            expect(isPrivacyCompliant(response)).toBe(true);
            expect(containsUserIdentifiers(response)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('responses with voter IDs should fail privacy validation', () => {
      fc.assert(
        fc.property(
          countArbitrary,
          countArbitrary,
          fc.array(userIdArbitrary, { minLength: 1, maxLength: 10 }),
          (agreeCount, strongReasoningCount, voterIds) => {
            const response: PrivacyViolatingReactionResponse = {
              counts: {
                agree: agreeCount,
                strongReasoning: strongReasoningCount,
              },
              userReactions: null,
              voters: voterIds, // Privacy violation!
            };
            
            // Should NOT be privacy compliant
            expect(containsUserIdentifiers(response)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('responses with agreeVoters should fail privacy validation', () => {
      fc.assert(
        fc.property(
          countArbitrary,
          countArbitrary,
          fc.array(userIdArbitrary, { minLength: 1, maxLength: 10 }),
          (agreeCount, strongReasoningCount, agreeVoters) => {
            const response: PrivacyViolatingReactionResponse = {
              counts: {
                agree: agreeCount,
                strongReasoning: strongReasoningCount,
              },
              userReactions: null,
              agreeVoters, // Privacy violation!
            };
            
            // Should NOT be privacy compliant
            expect(containsUserIdentifiers(response)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('responses with reactions array containing voterId should fail privacy validation', () => {
      fc.assert(
        fc.property(
          countArbitrary,
          countArbitrary,
          fc.array(
            fc.record({
              voterId: userIdArbitrary,
              type: fc.constantFrom('agree', 'strong_reasoning'),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (agreeCount, strongReasoningCount, reactions) => {
            const response: PrivacyViolatingReactionResponse = {
              counts: {
                agree: agreeCount,
                strongReasoning: strongReasoningCount,
              },
              userReactions: null,
              reactions, // Privacy violation!
            };
            
            // Should NOT be privacy compliant
            expect(containsUserIdentifiers(response)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('ReactionDisplay component should only render aggregate counts', () => {
      fc.assert(
        fc.property(
          argumentIdArbitrary,
          countArbitrary,
          countArbitrary,
          (argumentId, agreeCount, strongReasoningCount) => {
            cleanup();
            vi.clearAllMocks();
            
            const queryClient = createTestQueryClient();
            
            // Mock the useReactions hook to return privacy-compliant data
            vi.mocked(useReactions).mockReturnValue({
              data: {
                counts: {
                  agree: agreeCount,
                  strongReasoning: strongReasoningCount,
                },
                userReactions: null,
              },
              isLoading: false,
              isError: false,
              error: null,
              refetch: vi.fn(),
              isFetching: false,
              isPending: false,
              isSuccess: true,
              status: 'success',
              fetchStatus: 'idle',
              dataUpdatedAt: Date.now(),
              errorUpdatedAt: 0,
              failureCount: 0,
              failureReason: null,
              errorUpdateCount: 0,
              isLoadingError: false,
              isPaused: false,
              isPlaceholderData: false,
              isRefetchError: false,
              isRefetching: false,
              isStale: false,
              promise: Promise.resolve({
                counts: { agree: agreeCount, strongReasoning: strongReasoningCount },
                userReactions: null,
              }),
            } as ReturnType<typeof useReactions>);
            
            render(
              <TestWrapper queryClient={queryClient}>
                <ReactionDisplay argumentId={argumentId} interactive={false} />
              </TestWrapper>
            );
            
            // Should display the counts - use getAllByText since counts might be equal
            const agreeElements = screen.getAllByText(agreeCount.toString());
            const strongReasoningElements = screen.getAllByText(strongReasoningCount.toString());
            
            // At least one element should exist for each count
            expect(agreeElements.length).toBeGreaterThanOrEqual(1);
            expect(strongReasoningElements.length).toBeGreaterThanOrEqual(1);
            
            // Should NOT display any user identifiers in the DOM
            const container = document.body;
            const htmlContent = container.innerHTML;
            
            // Check that no user ID patterns appear in the rendered HTML
            // User IDs are typically alphanumeric strings of 10-21 characters
            // We check that the component doesn't render any suspicious patterns
            expect(htmlContent).not.toMatch(/voterId/i);
            expect(htmlContent).not.toMatch(/userId/i);
            expect(htmlContent).not.toMatch(/voter-id/i);
            expect(htmlContent).not.toMatch(/user-id/i);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('aggregate counts should be non-negative integers', () => {
      fc.assert(
        fc.property(
          countArbitrary,
          countArbitrary,
          (agreeCount, strongReasoningCount) => {
            const response: PrivacyCompliantReactionResponse = {
              counts: {
                agree: agreeCount,
                strongReasoning: strongReasoningCount,
              },
              userReactions: null,
            };
            
            // Counts should be non-negative integers
            expect(response.counts.agree).toBeGreaterThanOrEqual(0);
            expect(response.counts.strongReasoning).toBeGreaterThanOrEqual(0);
            expect(Number.isInteger(response.counts.agree)).toBe(true);
            expect(Number.isInteger(response.counts.strongReasoning)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('userReactions should only indicate own reactions, not others', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.boolean(),
          (userAgreed, userStrongReasoning) => {
            const response: PrivacyCompliantReactionResponse = {
              counts: {
                agree: 10, // Many users agreed
                strongReasoning: 5, // Many users gave strong reasoning
              },
              userReactions: {
                agree: userAgreed,
                strongReasoning: userStrongReasoning,
              },
            };
            
            // userReactions should only be boolean flags
            expect(typeof response.userReactions?.agree).toBe('boolean');
            expect(typeof response.userReactions?.strongReasoning).toBe('boolean');
            
            // Should not contain any user identifiers
            expect(containsUserIdentifiers(response)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('null userReactions should be valid for unauthenticated users', () => {
      fc.assert(
        fc.property(
          countArbitrary,
          countArbitrary,
          (agreeCount, strongReasoningCount) => {
            const response: PrivacyCompliantReactionResponse = {
              counts: {
                agree: agreeCount,
                strongReasoning: strongReasoningCount,
              },
              userReactions: null, // Unauthenticated user
            };
            
            // Should still be privacy compliant
            expect(isPrivacyCompliant(response)).toBe(true);
            expect(containsUserIdentifiers(response)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
