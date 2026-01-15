import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../api';

interface UsernameCheckResult {
  available: boolean;
  reason: string | null;
}

interface UseUsernameCheckReturn {
  isChecking: boolean;
  result: UsernameCheckResult | null;
  checkUsername: (username: string) => void;
  reset: () => void;
}

// Add username check to query keys
const usernameCheckKey = (username: string) => [...queryKeys.users.current(), 'check', username] as const;

/**
 * Validate username format on client side
 */
function validateUsernameFormat(username: string): UsernameCheckResult | null {
  if (!username || username.length < 3) {
    return null; // Too short, no result
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return {
      available: false,
      reason: 'Username can only contain letters, numbers, and underscores',
    };
  }
  return null; // Valid format, need to check server
}

/**
 * Hook for checking username availability with debouncing
 * Uses TanStack Query for caching, deduplication, and automatic retry
 *
 * Requirements: 2.3 - Check username uniqueness on blur or debounced input
 *
 * @param debounceMs - Debounce delay in milliseconds (default: 300ms)
 * @returns Object with checking state, result, and check function
 */
export function useUsernameCheck(debounceMs = 300): UseUsernameCheckReturn {
  const [username, setUsername] = useState('');
  const [debouncedUsername, setDebouncedUsername] = useState('');
  const [clientValidationResult, setClientValidationResult] = useState<UsernameCheckResult | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce username changes
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Client-side validation first
    const validationResult = validateUsernameFormat(username);
    if (validationResult) {
      setClientValidationResult(validationResult);
      setDebouncedUsername(''); // Don't query server
      return;
    }

    setClientValidationResult(null);

    // Valid format - debounce server check
    if (username.length >= 3) {
      timeoutRef.current = setTimeout(() => {
        setDebouncedUsername(username);
      }, debounceMs);
    } else {
      setDebouncedUsername('');
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [username, debounceMs]);

  // Query for username availability
  const { data, isFetching, isError } = useQuery({
    queryKey: usernameCheckKey(debouncedUsername),
    queryFn: async ({ signal }): Promise<UsernameCheckResult> => {
      const response = await fetch(
        `/api/users/check-username?username=${encodeURIComponent(debouncedUsername)}`,
        { signal }
      );

      if (!response.ok) {
        throw new Error('Failed to check username');
      }

      return response.json();
    },
    enabled: debouncedUsername.length >= 3,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const checkUsername = useCallback((newUsername: string) => {
    setUsername(newUsername);
  }, []);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setUsername('');
    setDebouncedUsername('');
    setClientValidationResult(null);
  }, []);

  // Determine final result
  const result = clientValidationResult ?? (isError ? null : data ?? null);
  const isChecking = isFetching || (username.length >= 3 && username !== debouncedUsername && !clientValidationResult);

  return {
    isChecking,
    result,
    checkUsername,
    reset,
  };
}

export default useUsernameCheck;
