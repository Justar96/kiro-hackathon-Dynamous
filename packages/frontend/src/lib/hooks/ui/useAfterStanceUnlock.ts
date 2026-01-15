/**
 * After Stance Unlock Hook
 * 
 * Hook to track when the user has scrolled past Round 2 section.
 * Uses IntersectionObserver to detect when Round 2 exits the viewport.
 * 
 * Requirements: 10.6, 11.3
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook to track when the user has scrolled past Round 2 section.
 * Uses IntersectionObserver to detect when Round 2 exits the viewport.
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
