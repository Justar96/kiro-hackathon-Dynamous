import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from './Toast';
import { useSession } from '../lib/useSession';

// Storage key to track if onboarding has been shown
const ONBOARDING_SHOWN_KEY = 'debate-platform-onboarding-shown';

// Reading time for the onboarding message (in milliseconds)
// Approximately 15 seconds for the full message
const ONBOARDING_DURATION = 15000;

interface OnboardingToastProps {
  username: string;
  onDismiss?: () => void;
}

/**
 * OnboardingToast - Welcome message component shown after successful sign-up
 * Requirements: 2.5, 2.6, 2.7
 * - Display welcome message after sign-up
 * - Explain sandbox mode (0.5× vote weight)
 * - Explain 5 debates to unlock full weight
 * - Auto-dismiss after reading time
 */
export function OnboardingToast({ username, onDismiss }: OnboardingToastProps) {
  const { showToast, dismissToast } = useToast();
  const toastIdRef = useRef<string | null>(null);
  const shownRef = useRef(false);

  useEffect(() => {
    // Only show once
    if (shownRef.current) return;
    shownRef.current = true;

    // Show the onboarding toast
    const message = `Welcome to Persuasion, ${username}! 🎉\n\nYou're starting in sandbox mode with 0.5× vote weight. Participate in 5 debates to unlock full voting power and build your reputation.`;

    toastIdRef.current = showToast({
      type: 'info',
      message,
      duration: ONBOARDING_DURATION,
    });

    // Mark onboarding as shown
    try {
      localStorage.setItem(ONBOARDING_SHOWN_KEY, 'true');
    } catch {
      // Ignore storage errors
    }

    return () => {
      if (toastIdRef.current) {
        dismissToast(toastIdRef.current);
      }
      onDismiss?.();
    };
  }, [username, showToast, dismissToast, onDismiss]);

  // This component doesn't render anything - it just triggers the toast
  return null;
}

/**
 * Hook to show onboarding toast for new users
 * Requirements: 2.5, 2.6, 2.7
 * 
 * @returns Object with showOnboarding function and hasShownOnboarding state
 */
export function useOnboardingToast() {
  const { showToast } = useToast();
  const [hasShownOnboarding, setHasShownOnboarding] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_SHOWN_KEY) === 'true';
    } catch {
      return false;
    }
  });

  /**
   * Show the onboarding welcome toast
   * Requirements: 2.5, 2.6, 2.7
   * 
   * @param username - The user's username to personalize the message
   */
  const showOnboarding = useCallback((username: string) => {
    // Don't show if already shown
    if (hasShownOnboarding) return;

    const message = `Welcome to Persuasion, ${username}! 🎉\n\nYou're starting in sandbox mode with 0.5× vote weight. Participate in 5 debates to unlock full voting power and build your reputation.`;

    showToast({
      type: 'info',
      message,
      duration: ONBOARDING_DURATION,
    });

    // Mark as shown
    setHasShownOnboarding(true);
    try {
      localStorage.setItem(ONBOARDING_SHOWN_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
  }, [hasShownOnboarding, showToast]);

  /**
   * Reset onboarding state (useful for testing)
   */
  const resetOnboarding = useCallback(() => {
    setHasShownOnboarding(false);
    try {
      localStorage.removeItem(ONBOARDING_SHOWN_KEY);
    } catch {
      // Ignore storage errors
    }
  }, []);

  return {
    showOnboarding,
    hasShownOnboarding,
    resetOnboarding,
  };
}

/**
 * Hook to automatically show onboarding for new sign-ups
 * Detects when a user signs up and shows the welcome toast
 */
export function useAutoOnboarding() {
  const { user, isLoading } = useSession();
  const { showOnboarding, hasShownOnboarding } = useOnboardingToast();
  const previousUserRef = useRef<string | null>(null);
  const wasLoadingRef = useRef(true);

  useEffect(() => {
    // Skip during initial loading
    if (isLoading) {
      wasLoadingRef.current = true;
      return;
    }

    const currentUserId = user?.id || null;
    const previousUserId = previousUserRef.current;
    const wasLoading = wasLoadingRef.current;

    // Detect new sign-up: user was not authenticated, now is authenticated
    // and onboarding hasn't been shown yet
    if (!wasLoading && !previousUserId && currentUserId && !hasShownOnboarding) {
      // This is a new sign-up - show onboarding
      const username = user?.name || 'there';
      showOnboarding(username);
    }

    // Update refs
    previousUserRef.current = currentUserId;
    wasLoadingRef.current = false;
  }, [user, isLoading, hasShownOnboarding, showOnboarding]);
}

export default OnboardingToast;
