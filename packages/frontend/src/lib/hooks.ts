import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from './useSession';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  debatesQueryOptions,
  debateQueryOptions,
  debateDetailQueryOptions,
  marketQueryOptions,
  userStanceQueryOptions,
  commentsQueryOptions,
  reactionsQueryOptions,
  currentUserQueryOptions,
  userQueryOptions,
  userStatsQueryOptions,
  healthCheckQueryOptions,
} from './queries';
import {
  createDebate,
  joinDebate,
  submitArgument,
  recordPreStance,
  recordPostStance,
  addReaction,
  removeReaction,
  addComment,
  attributeImpact,
} from './mutations';

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
 * Create a new debate
 */
export function useCreateDebate() {
  const queryClient = useQueryClient();
  const token = useAuthToken();
  
  return useMutation({
    mutationFn: (input: { resolution: string; creatorSide?: 'support' | 'oppose' }) => {
      if (!token) throw new Error('Authentication required');
      return createDebate(input, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debates'] });
    },
  });
}

/**
 * Join a debate as oppose debater
 */
export function useJoinDebate() {
  const queryClient = useQueryClient();
  const token = useAuthToken();
  
  return useMutation({
    mutationFn: (debateId: string) => {
      if (!token) throw new Error('Authentication required');
      return joinDebate(debateId, token);
    },
    onSuccess: (_, debateId) => {
      queryClient.invalidateQueries({ queryKey: ['debate', debateId] });
      queryClient.invalidateQueries({ queryKey: ['debates'] });
    },
  });
}

/**
 * Submit an argument in a debate
 */
export function useSubmitArgument() {
  const queryClient = useQueryClient();
  const token = useAuthToken();
  
  return useMutation({
    mutationFn: ({ debateId, content }: { debateId: string; content: string }) => {
      if (!token) throw new Error('Authentication required');
      return submitArgument(debateId, { content }, token);
    },
    onSuccess: (_, { debateId }) => {
      queryClient.invalidateQueries({ queryKey: ['debate', debateId] });
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
 */
export function useRecordPreStance() {
  const queryClient = useQueryClient();
  const token = useAuthToken();
  
  return useMutation({
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
      queryClient.invalidateQueries({ queryKey: ['debate', debateId, 'stance'] });
      queryClient.invalidateQueries({ queryKey: ['debate', debateId, 'market'] });
    },
  });
}

/**
 * Record post-read stance
 */
export function useRecordPostStance() {
  const queryClient = useQueryClient();
  const token = useAuthToken();
  
  return useMutation({
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
      queryClient.invalidateQueries({ queryKey: ['debate', debateId, 'stance'] });
      queryClient.invalidateQueries({ queryKey: ['debate', debateId, 'market'] });
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
 * Add a comment to a debate
 */
export function useAddComment() {
  const queryClient = useQueryClient();
  const token = useAuthToken();
  
  return useMutation({
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
      queryClient.invalidateQueries({ queryKey: ['debate', debateId, 'comments'] });
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
 * Add a reaction to an argument
 */
export function useAddReaction() {
  const queryClient = useQueryClient();
  const token = useAuthToken();
  
  return useMutation({
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
      queryClient.invalidateQueries({ queryKey: ['argument', argumentId, 'reactions'] });
    },
  });
}

/**
 * Remove a reaction from an argument
 */
export function useRemoveReaction() {
  const queryClient = useQueryClient();
  const token = useAuthToken();
  
  return useMutation({
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
      queryClient.invalidateQueries({ queryKey: ['argument', argumentId, 'reactions'] });
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
 */
export function useAttributeImpact() {
  const queryClient = useQueryClient();
  const token = useAuthToken();
  
  return useMutation({
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
      queryClient.invalidateQueries({ queryKey: ['debate', debateId, 'stance'] });
      // Invalidate market to update impact scores
      queryClient.invalidateQueries({ queryKey: ['debate', debateId, 'market'] });
      // Invalidate debate detail to refresh argument impact scores
      queryClient.invalidateQueries({ queryKey: ['debate', debateId, 'detail'] });
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
