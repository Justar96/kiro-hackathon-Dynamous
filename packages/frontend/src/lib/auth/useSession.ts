import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient, QueryClient } from '@tanstack/react-query';
import { authClient } from '../../auth';
import { queryKeys } from '../api';

interface User {
  id: string;
  email: string;
  name: string;
  image?: string | null;
}

interface Session {
  id: string;
  userId: string;
  expiresAt: Date | string;
}

interface SessionState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isExpired: boolean;
}

// Session storage key for persistence check
const SESSION_STORAGE_KEY = 'debate-platform-session-active';

/**
 * Check if session is expired based on expiresAt timestamp
 */
function isSessionExpired(session: Session | null): boolean {
  if (!session?.expiresAt) return false;
  const expiresAt = session.expiresAt instanceof Date 
    ? session.expiresAt.getTime() 
    : new Date(session.expiresAt).getTime();
  return Date.now() > expiresAt;
}

/**
 * Clear all user-specific cached data from TanStack Query
 * Requirements: 2.4 - Clear all user-specific cached data on sign out
 */
function clearUserCache(queryClient: QueryClient) {
  // Clear user-specific queries using query key factory
  queryClient.removeQueries({ queryKey: queryKeys.users.current() });
  queryClient.removeQueries({ predicate: (query) => {
    const key = query.queryKey;
    // Clear stance queries (user-specific)
    if (Array.isArray(key) && key[0] === 'stances') return true;
    // Clear any queries that might contain user-specific data
    if (Array.isArray(key) && key[0] === 'arguments' && key.includes('reactions')) return true;
    return false;
  }});

  // Invalidate debates to refetch without user context
  queryClient.invalidateQueries({ queryKey: queryKeys.debates.all });
}

/**
 * Custom hook to get the current session from Neon Auth
 * Uses authClient.getSession() and subscribes to auth state changes
 * 
 * Requirements: 2.5 - Session persistence across page refreshes
 * - Persists session state indicator in sessionStorage
 * - Handles session expiry gracefully
 * - Polls for session changes to detect expiry
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    user: null,
    session: null,
    isLoading: true,
    isExpired: false,
  });
  
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchSession() {
      try {
        const result = await authClient.getSession();
        const rawUser = result.data?.user;
        const rawSession = result.data?.session;
        
        // Map to our interface types
        const user: User | null = rawUser ? {
          id: rawUser.id,
          email: rawUser.email,
          name: rawUser.name,
          image: rawUser.image,
        } : null;
        
        const session: Session | null = rawSession ? {
          id: rawSession.id,
          userId: rawSession.userId,
          expiresAt: rawSession.expiresAt,
        } : null;
        
        if (mounted) {
          // Check if session is expired
          const expired = isSessionExpired(session);
          
          // Update session storage indicator for persistence tracking
          if (user && session && !expired) {
            sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
          } else {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
          }
          
          setState({
            user: expired ? null : user,
            session: expired ? null : session,
            isLoading: false,
            isExpired: expired,
          });
          
          // Track user ID for sign-out detection
          previousUserIdRef.current = user?.id || null;
        }
      } catch (error) {
        if (mounted) {
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
          setState({ user: null, session: null, isLoading: false, isExpired: false });
          previousUserIdRef.current = null;
        }
      }
    }

    fetchSession();

    // Poll for session changes (check every 30 seconds)
    // This helps detect session expiry and external sign-outs
    const interval = setInterval(fetchSession, 30000);

    // Also check on visibility change (when user returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchSession();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return state;
}

/**
 * Get the current user from session
 */
export function useUser() {
  const { user, isLoading, isExpired } = useSession();
  return { user, isLoading, isExpired };
}

/**
 * Hook for signing out and clearing all cached data
 * 
 * Requirements: 2.4 - Clear all user-specific cached data on sign out
 * - Clears TanStack Query cache
 * - Clears session storage
 * - Redirects to home page
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  
  const signOut = useCallback(async () => {
    try {
      // Sign out via Neon Auth
      await authClient.signOut();
      
      // Clear session storage indicator
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      
      // Clear all user-specific cached data
      clearUserCache(queryClient);
      
      // Redirect to home page
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out failed:', error);
      // Still try to clear local state even if sign out fails
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      queryClient.clear();
      window.location.href = '/';
    }
  }, [queryClient]);
  
  return { signOut };
}

/**
 * Hook that watches for sign-out events and clears the cache automatically
 * This is useful when using Neon Auth's UserButton which handles sign-out internally
 *
 * Requirements: 2.4 - Clear all user-specific cached data on sign out
 *
 * @param sessionState - The session state from useSession (required - share from parent to avoid duplicate fetches)
 * @param onSignOut - Optional callback to run when sign-out is detected
 */
export function useSessionWatcher(
  sessionState: { user: { id: string } | null; isLoading: boolean },
  onSignOut?: () => void
) {
  const queryClient = useQueryClient();
  const { user, isLoading } = sessionState;
  const previousUserIdRef = useRef<string | null>(null);
  const wasLoadingRef = useRef(true);

  useEffect(() => {
    // Skip during initial loading
    if (isLoading) {
      wasLoadingRef.current = true;
      return;
    }

    const currentUserId = user?.id || null;
    const previousUserId = previousUserIdRef.current;
    const wasLoading = wasLoadingRef.current;

    // Detect sign-out: user was authenticated, now is not (and not during initial load)
    if (!wasLoading && previousUserId && !currentUserId) {
      // User signed out - clear cache
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      clearUserCache(queryClient);

      // Call optional callback
      onSignOut?.();
    }

    // Update refs
    previousUserIdRef.current = currentUserId;
    wasLoadingRef.current = false;
  }, [user, isLoading, queryClient, onSignOut]);
}

/**
 * Check if there was an active session before page load
 * Useful for showing loading states during session restoration
 */
export function hadActiveSession(): boolean {
  return sessionStorage.getItem(SESSION_STORAGE_KEY) === 'true';
}
