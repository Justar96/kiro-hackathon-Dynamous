import { useCallback, useRef } from 'react';
import { useSession } from './useSession';

interface CreateProfileResult {
  success: boolean;
  error?: string;
}

/**
 * Hook to handle sign-up success and create platform user profile
 * Requirements: 2.4 - Create user profile with provided username on sign-up success
 * 
 * @returns Object with createProfile function
 */
export function useSignUpCallback() {
  const { user } = useSession();
  const creatingRef = useRef(false);

  /**
   * Create platform user profile with the provided username
   * Should be called after successful sign-up
   * 
   * @param username - The username from the sign-up form
   * @returns Result object with success status and optional error
   */
  const createProfile = useCallback(async (username: string): Promise<CreateProfileResult> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Prevent duplicate calls
    if (creatingRef.current) {
      return { success: false, error: 'Profile creation in progress' };
    }

    creatingRef.current = true;

    try {
      const response = await fetch('/api/users/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}`,
        },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        const data = await response.json();
        return { success: false, error: data.error || 'Failed to create profile' };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create profile';
      return { success: false, error: message };
    } finally {
      creatingRef.current = false;
    }
  }, [user]);

  return { createProfile };
}

export default useSignUpCallback;
