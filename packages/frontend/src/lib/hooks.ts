import { useQuery, useMutation, useQueryClient, useQueries, useInfiniteQuery } from '@tanstack/react-query';
import { useSession } from './useSession';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  queryKeys,
  debatesQueryOptions,
  debateQueryOptions,
  debateDetailQueryOptions,
  debateFullQueryOptions,
  marketQueryOptions,
  userStanceQueryOptions,
  commentsQueryOptions,
  commentsInfiniteQueryOptions,
  reactionsQueryOptions,
  currentUserQueryOptions,
  userQueryOptions,
  userStatsQueryOptions,
  healthCheckQueryOptions,
  steelmanStatusQueryOptions,
  pendingSteelmansQueryOptions,
} from './queries';
import {
  createDebate,
  joinDebate,
  submitArgument,
  recordPreStance,
  recordPostStance,
  recordQuickStance,
  addReaction,
  removeReaction,
  addComment,
  attributeImpact,
  markMindChanged,
  submitSteelman,
  reviewSteelman,
  deleteSteelman,
} from './mutations';
import { mutationKeys } from './cacheStrategies';

// ============================================================================
// Auth Hook
// ============================================================================

/**
 * Get the current user's auth token for API calls
 */
export function useAuthToken(): string | undefined {
  const { user } = useSession();
  // Neon Auth user ID is used as the token for our simplified auth
  return user?.id;
}

// ============================================================================
// Scroll-Based After Unlock Hook
// ============================================================================

/**
 * Hook to track when the user has scrolled past Round 2 section.
 * Uses IntersectionObserver to detect when Round 2 exits the viewport.
 * 
 * Requirements: 10.6, 11.3
 * 
 * @param round2ElementId - The ID of the Round 2 section element (default: 'round-2')
 * @returns Object with afterUnlocked state and ref to attach to Round 2 element
 */
export function useAfterStanceUnlock(round2ElementId: string = 'round-2') {
  const [afterUnlocked, setAfterUnlocked] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const hasUnlockedRef = useRef(false);

  useEffect(() => {
    // Once unlocked, stay unlocked (don't re-lock on scroll up)
    if (hasUnlockedRef.current) return;

    const observerCallback: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        // Unlock when Round 2 section exits the viewport (scrolled past)
        // We check if the element is NOT intersecting AND the top is above viewport
        if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
          setAfterUnlocked(true);
          hasUnlockedRef.current = true;
          // Disconnect observer once unlocked
          observerRef.current?.disconnect();
        }
      });
    };

    observerRef.current = new IntersectionObserver(observerCallback, {
      root: null,
      // Trigger when element is about to leave the top of viewport
      rootMargin: '0px 0px -80% 0px',
      threshold: 0,
    });

    // Find and observe the Round 2 element
    const round2Element = document.getElementById(round2ElementId);
    if (round2Element) {
      observerRef.current.observe(round2Element);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [round2ElementId]);

  // Reset function for when user navigates to a new debate
  const reset = useCallback(() => {
    setAfterUnlocked(false);
    hasUnlockedRef.current = false;
  }, []);

  return { afterUnlocked, reset };
}

/**
 * Hook to track reading progress based on scroll position.
 * Returns a percentage (0-100) of how far the user has scrolled through the content.
 * 
 * Requirements: 10.7
 * 
 * @param contentElementId - The ID of the main content container
 * @returns Reading progress as a percentage (0-100)
 */
export function useReadingProgress(contentElementId?: string) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const contentElement = contentElementId 
        ? document.getElementById(contentElementId)
        : document.documentElement;
      
      if (!contentElement) return;

      const scrollTop = window.scrollY;
      const scrollHeight = contentElement.scrollHeight - window.innerHeight;
      
      if (scrollHeight <= 0) {
        setProgress(100);
        return;
      }

      const currentProgress = Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100));
      setProgress(currentProgress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [contentElementId]);

  return progress;
}

// ============================================================================
// Debate Hooks
// ============================================================================

/**
 * Fetch all debates
 */
export function useDebates() {
  return useQuery(debatesQueryOptions);
}

/**
 * Fetch a single debate by ID
 */
export function useDebate(debateId: string) {
  return useQuery(debateQueryOptions(debateId));
}

/**
 * Fetch debate details with rounds and arguments
 */
export function useDebateDetail(debateId: string) {
  return useQuery(debateDetailQueryOptions(debateId));
}

/**
 * Fetch debate with ALL related data (debate, rounds, debaters, market) in one request.
 * Use this for the debate detail page to minimize API calls.
 */
export function useDebateFull(debateId: string) {
  const token = useAuthToken();
  return useQuery(debateFullQueryOptions(debateId, token));
}

/**
 * Create a new debate
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useCreateDebate() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: mutationKeys.debates.create(),
    mutationFn: (input: { resolution: string; creatorSide?: 'support' | 'oppose' }) => {
      if (!token) throw new Error('Authentication required');
      return createDebate(input, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.all });
    },
  });
}

/**
 * Join a debate as oppose debater
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useJoinDebate() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: ['mutations', 'debates', 'join'] as const,
    mutationFn: (debateId: string) => {
      if (!token) throw new Error('Authentication required');
      return joinDebate(debateId, token);
    },
    onSuccess: (_, debateId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.detail(debateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.all });
    },
  });
}

/**
 * Submit an argument in a debate
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useSubmitArgument() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: ['mutations', 'arguments', 'submit'] as const,
    mutationFn: ({ debateId, content }: { debateId: string; content: string }) => {
      if (!token) throw new Error('Authentication required');
      return submitArgument(debateId, { content }, token);
    },
    onSuccess: (_, { debateId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.detail(debateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.full(debateId) });
    },
  });
}

// ============================================================================
// Market Hooks
// ============================================================================

/**
 * Fetch market data for a debate
 */
export function useMarket(debateId: string) {
  const token = useAuthToken();
  return useQuery(marketQueryOptions(debateId, token));
}

// ============================================================================
// Stance Hooks
// ============================================================================

/**
 * Fetch user's stances for a debate
 */
export function useUserStance(debateId: string) {
  const token = useAuthToken();
  return useQuery(userStanceQueryOptions(debateId, token));
}

/**
 * Record pre-read stance
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useRecordPreStance() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: ['mutations', 'stances', 'pre'] as const,
    mutationFn: ({
      debateId,
      supportValue,
      confidence
    }: {
      debateId: string;
      supportValue: number;
      confidence: number;
    }) => {
      if (!token) throw new Error('Authentication required');
      return recordPreStance(debateId, { supportValue, confidence }, token);
    },
    onSuccess: (_, { debateId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stances.byDebate(debateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.market.byDebate(debateId) });
    },
  });
}

/**
 * Record post-read stance
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useRecordPostStance() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: ['mutations', 'stances', 'post'] as const,
    mutationFn: ({
      debateId,
      supportValue,
      confidence,
      lastArgumentSeen,
    }: {
      debateId: string;
      supportValue: number;
      confidence: number;
      lastArgumentSeen?: string | null;
    }) => {
      if (!token) throw new Error('Authentication required');
      return recordPostStance(debateId, { supportValue, confidence, lastArgumentSeen }, token);
    },
    onSuccess: (_, { debateId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stances.byDebate(debateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.market.byDebate(debateId) });
    },
  });
}

/**
 * Quick stance from index page - simplified support/oppose binary choice.
 * This is a reusable hook replacing inline mutation in index.tsx.
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useQuickStance() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: mutationKeys.stances.quick(''),
    mutationFn: ({
      debateId,
      side,
    }: {
      debateId: string;
      side: 'support' | 'oppose';
    }) => {
      if (!token) throw new Error('Authentication required');
      return recordQuickStance(debateId, { side }, token);
    },
    onSuccess: (_, { debateId }) => {
      // Invalidate relevant queries to refresh stance and market data
      queryClient.invalidateQueries({ queryKey: queryKeys.stances.byDebate(debateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.market.byDebate(debateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.all });
    },
  });
}

// ============================================================================
// Comment Hooks
// ============================================================================

/**
 * Fetch comments for a debate
 */
export function useComments(debateId: string) {
  return useQuery(commentsQueryOptions(debateId));
}

/**
 * Fetch paginated comments for a debate with infinite loading.
 * TanStack Query v5 Best Practice: Use useInfiniteQuery for paginated data.
 * 
 * Provides:
 * - data.pages: Array of comment pages
 * - fetchNextPage: Load more comments
 * - hasNextPage: Whether more pages exist
 * - isFetchingNextPage: Loading state for next page
 * 
 * @param debateId - The debate ID to fetch comments for
 * @param pageSize - Number of comments per page (default: 20)
 */
export function useInfiniteComments(debateId: string, pageSize: number = 20) {
  return useInfiniteQuery(commentsInfiniteQueryOptions(debateId, pageSize));
}

/**
 * Add a comment to a debate
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useAddComment() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: ['mutations', 'comments', 'add'] as const,
    mutationFn: ({
      debateId,
      content,
      parentId
    }: {
      debateId: string;
      content: string;
      parentId?: string | null;
    }) => {
      if (!token) throw new Error('Authentication required');
      return addComment(debateId, { content, parentId }, token);
    },
    onSuccess: (_, { debateId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.byDebate(debateId) });
    },
  });
}

// ============================================================================
// Reaction Hooks
// ============================================================================

/**
 * Fetch reactions for an argument
 */
export function useReactions(argumentId: string) {
  const token = useAuthToken();
  return useQuery(reactionsQueryOptions(argumentId, token));
}

/**
 * Batch fetch reactions for multiple arguments using useQueries with combine.
 * TanStack Query v5 Best Practice: Use combine to merge results from parallel queries.
 * 
 * This is useful when displaying a list of arguments (e.g., in a debate round)
 * where each argument needs its reaction counts.
 * 
 * @param argumentIds - Array of argument IDs to fetch reactions for
 * @returns Combined result with reactions keyed by argument ID
 */
export function useBatchReactions(argumentIds: string[]) {
  const token = useAuthToken();

  return useQueries({
    queries: argumentIds.map((argumentId) => ({
      ...reactionsQueryOptions(argumentId, token),
      // Ensure disabled for empty IDs
      enabled: !!argumentId,
    })),
    combine: (results) => {
      // Create a map of argumentId -> reactions data
      const reactionsMap: Record<string, {
        counts: { agree: number; strongReasoning: number };
        userReactions: { agree: boolean; strongReasoning: boolean } | null;
      }> = {};

      // Track overall loading/error state
      let isPending = false;
      let isError = false;
      const errors: Error[] = [];

      results.forEach((result, index) => {
        const argumentId = argumentIds[index];
        
        if (result.isPending) {
          isPending = true;
        }
        
        if (result.isError) {
          isError = true;
          errors.push(result.error as Error);
        }
        
        if (result.data) {
          reactionsMap[argumentId] = result.data;
        }
      });

      return {
        data: reactionsMap,
        isPending,
        isError,
        errors,
        // Helper to get reactions for a specific argument
        getReactions: (argumentId: string) => reactionsMap[argumentId] ?? null,
      };
    },
  });
}

/**
 * Add a reaction to an argument
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useAddReaction() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: ['mutations', 'reactions', 'add'] as const,
    mutationFn: ({
      argumentId,
      type
    }: {
      argumentId: string;
      type: 'agree' | 'strong_reasoning';
    }) => {
      if (!token) throw new Error('Authentication required');
      return addReaction(argumentId, { type }, token);
    },
    onSuccess: (_, { argumentId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.arguments.reactions(argumentId) });
    },
  });
}

/**
 * Remove a reaction from an argument
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useRemoveReaction() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: ['mutations', 'reactions', 'remove'] as const,
    mutationFn: ({
      argumentId,
      type
    }: {
      argumentId: string;
      type: 'agree' | 'strong_reasoning';
    }) => {
      if (!token) throw new Error('Authentication required');
      return removeReaction(argumentId, type, token);
    },
    onSuccess: (_, { argumentId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.arguments.reactions(argumentId) });
    },
  });
}

// ============================================================================
// Impact Attribution Hooks
// ============================================================================

/**
 * Attribute mind-change impact to a specific argument.
 * This is the "This changed my mind" interaction.
 * Requirements: 13.1
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useAttributeImpact() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: ['mutations', 'impact', 'attribute'] as const,
    mutationFn: ({
      debateId,
      argumentId
    }: {
      debateId: string;
      argumentId: string;
    }) => {
      if (!token) throw new Error('Authentication required');
      return attributeImpact(debateId, { argumentId }, token);
    },
    onSuccess: (_, { debateId }) => {
      // Invalidate stance to update lastArgumentSeen
      queryClient.invalidateQueries({ queryKey: queryKeys.stances.byDebate(debateId) });
      // Invalidate market to update impact scores
      queryClient.invalidateQueries({ queryKey: queryKeys.market.byDebate(debateId) });
      // Invalidate debate detail to refresh argument impact scores
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.detail(debateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.full(debateId) });
    },
  });
}

/**
 * Mark that a specific argument changed your mind.
 * Per original vision: "This changed my mind" button for explicit impact attribution.
 * Updates impact score and creates spike if significant.
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useMindChanged() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: ['mutations', 'arguments', 'mindChanged'] as const,
    mutationFn: (argumentId: string) => {
      if (!token) throw new Error('Authentication required');
      return markMindChanged(argumentId, token);
    },
    onSuccess: () => {
      // Invalidate all relevant queries to refresh impact scores
      queryClient.invalidateQueries({ queryKey: ['debates'] });
      queryClient.invalidateQueries({ queryKey: ['market'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

// ============================================================================
// User Hooks
// ============================================================================

/**
 * Fetch current authenticated user with stats
 */
export function useCurrentUser() {
  const token = useAuthToken();
  return useQuery(currentUserQueryOptions(token));
}

/**
 * Fetch user by ID
 */
export function useUserProfile(userId: string) {
  return useQuery(userQueryOptions(userId));
}

/**
 * Fetch user statistics
 */
export function useUserStats(userId: string) {
  return useQuery(userStatsQueryOptions(userId));
}

// ============================================================================
// Health Check Hook
// ============================================================================

/**
 * Check API health
 */
export function useHealthCheck() {
  return useQuery(healthCheckQueryOptions);
}

// ============================================================================
// Steelman Gate Hooks
// ============================================================================

/**
 * Check steelman gate status for a round.
 * Returns whether user can submit argument and steelman status.
 */
export function useSteelmanStatus(debateId: string, roundNumber: number) {
  const token = useAuthToken();
  return useQuery(steelmanStatusQueryOptions(debateId, roundNumber, token));
}

/**
 * Get pending steelmans that need review.
 */
export function usePendingSteelmans(debateId: string) {
  const token = useAuthToken();
  return useQuery(pendingSteelmansQueryOptions(debateId, token));
}

/**
 * Submit a steelman of opponent's argument.
 */
export function useSubmitSteelman() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationFn: ({ debateId, roundNumber, targetArgumentId, content }: {
      debateId: string;
      roundNumber: 1 | 2 | 3;
      targetArgumentId: string;
      content: string;
    }) => {
      if (!token) throw new Error('Authentication required');
      return submitSteelman(debateId, { roundNumber, targetArgumentId, content }, token);
    },
    onSuccess: (_, { debateId, roundNumber }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.steelman.status(debateId, roundNumber) });
      queryClient.invalidateQueries({ queryKey: queryKeys.steelman.pending(debateId) });
    },
  });
}

/**
 * Review (approve/reject) a steelman.
 */
export function useReviewSteelman() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationFn: ({ steelmanId, approved, rejectionReason }: {
      steelmanId: string;
      approved: boolean;
      rejectionReason?: string;
    }) => {
      if (!token) throw new Error('Authentication required');
      return reviewSteelman(steelmanId, { approved, rejectionReason }, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['steelman'] });
    },
  });
}

/**
 * Delete a rejected steelman to resubmit.
 */
export function useDeleteSteelman() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationFn: (steelmanId: string) => {
      if (!token) throw new Error('Authentication required');
      return deleteSteelman(steelmanId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['steelman'] });
    },
  });
}
