/**
 * Auth Token Hook
 * 
 * Provides the current user's auth token for API calls.
 */

import { useSession } from '../../auth';

/**
 * Get the current user's auth token for API calls
 */
export function useAuthToken(): string | undefined {
  const { user } = useSession();
  // Neon Auth user ID is used as the token for our simplified auth
  return user?.id;
}
