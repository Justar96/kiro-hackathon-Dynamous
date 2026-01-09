import { useState, useEffect } from 'react';
import { authClient } from '../auth';

interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
}

interface Session {
  id: string;
  userId: string;
  expiresAt: string;
}

interface SessionState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
}

/**
 * Custom hook to get the current session from Neon Auth
 * Uses authClient.getSession() and subscribes to auth state changes
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    user: null,
    session: null,
    isLoading: true,
  });

  useEffect(() => {
    let mounted = true;

    async function fetchSession() {
      try {
        const result = await authClient.getSession();
        if (mounted) {
          setState({
            user: result.data?.user || null,
            session: result.data?.session || null,
            isLoading: false,
          });
        }
      } catch (error) {
        if (mounted) {
          setState({ user: null, session: null, isLoading: false });
        }
      }
    }

    fetchSession();

    // Poll for session changes (simple approach)
    const interval = setInterval(fetchSession, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return state;
}

/**
 * Get the current user from session
 */
export function useUser() {
  const { user, isLoading } = useSession();
  return { user, isLoading };
}
