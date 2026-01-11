import { useState, useCallback, useRef, useEffect } from 'react';

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

/**
 * Hook for checking username availability with debouncing
 * Requirements: 2.3 - Check username uniqueness on blur or debounced input
 * 
 * @param debounceMs - Debounce delay in milliseconds (default: 300ms)
 * @returns Object with checking state, result, and check function
 */
export function useUsernameCheck(debounceMs = 300): UseUsernameCheckReturn {
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<UsernameCheckResult | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const checkUsername = useCallback((username: string) => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Reset result if username is too short
    if (!username || username.length < 3) {
      setResult(null);
      setIsChecking(false);
      return;
    }

    // Client-side validation first
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setResult({
        available: false,
        reason: 'Username can only contain letters, numbers, and underscores',
      });
      setIsChecking(false);
      return;
    }

    setIsChecking(true);

    // Debounce the API call
    timeoutRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch(
          `/api/users/check-username?username=${encodeURIComponent(username)}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('Failed to check username');
        }

        const data: UsernameCheckResult = await response.json();
        setResult(data);
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        // On error, don't show availability status
        setResult(null);
      } finally {
        setIsChecking(false);
      }
    }, debounceMs);
  }, [debounceMs]);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setResult(null);
    setIsChecking(false);
  }, []);

  return {
    isChecking,
    result,
    checkUsername,
    reset,
  };
}

export default useUsernameCheck;
