import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from './useSession';
import { queryKeys } from '../api';

interface CreateProfileResult {
  success: boolean;
  error?: string;
}

interface CreateProfileResponse {
  user: {
    id: string;
    username: string;
  };
}

/**
 * Hook to handle sign-up success and create platform user profile
 * Uses TanStack Query mutation for consistency with other mutations
 *
 * Requirements: 2.4 - Create user profile with provided username on sign-up success
 *
 * @returns Object with createProfile function and mutation state
 */
export function useSignUpCallback() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (username: string): Promise<CreateProfileResponse> => {
      if (!user) {
        throw new Error('Not authenticated');
      }

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
        throw new Error(data.error || 'Failed to create profile');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate current user query to fetch the new profile
      queryClient.invalidateQueries({ queryKey: queryKeys.users.current() });
    },
  });

  /**
   * Create platform user profile with the provided username
   * Should be called after successful sign-up
   *
   * @param username - The username from the sign-up form
   * @returns Result object with success status and optional error
   */
  const createProfile = async (username: string): Promise<CreateProfileResult> => {
    // Prevent duplicate calls
    if (mutation.isPending) {
      return { success: false, error: 'Profile creation in progress' };
    }

    try {
      await mutation.mutateAsync(username);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create profile';
      return { success: false, error: message };
    }
  };

  return {
    createProfile,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

export default useSignUpCallback;
