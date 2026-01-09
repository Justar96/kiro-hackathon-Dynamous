import { useEffect, useRef, useCallback } from 'react';
import { useRouter, useLocation } from '@tanstack/react-router';

/**
 * Storage key prefix for scroll positions
 */
const SCROLL_STORAGE_KEY = 'scroll-positions';

/**
 * Maximum number of scroll positions to store
 */
const MAX_STORED_POSITIONS = 50;

/**
 * Interface for stored scroll position data
 */
interface ScrollPosition {
  x: number;
  y: number;
  timestamp: number;
}

/**
 * Get stored scroll positions from sessionStorage
 */
function getStoredPositions(): Record<string, ScrollPosition> {
  try {
    const stored = sessionStorage.getItem(SCROLL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Save scroll positions to sessionStorage
 */
function savePositions(positions: Record<string, ScrollPosition>): void {
  try {
    // Prune old entries if we have too many
    const entries = Object.entries(positions);
    if (entries.length > MAX_STORED_POSITIONS) {
      // Sort by timestamp and keep only the most recent
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      positions = Object.fromEntries(entries.slice(0, MAX_STORED_POSITIONS));
    }
    sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Hook for preserving and restoring scroll position across navigation.
 * Saves scroll position before navigation and restores on back navigation.
 * 
 * Requirements: 10.1
 * 
 * @param key - Optional unique key for the scroll position. Defaults to current pathname.
 * @returns Object with scrollRef, restoreScroll function, and saveScroll function
 */
export function useScrollRestoration(key?: string) {
  const location = useLocation();
  const router = useRouter();
  const scrollRef = useRef<HTMLElement | null>(null);
  const isRestoringRef = useRef(false);
  
  // Use provided key or default to pathname
  const scrollKey = key || location.pathname;
  
  /**
   * Save current scroll position
   */
  const saveScroll = useCallback(() => {
    const positions = getStoredPositions();
    positions[scrollKey] = {
      x: window.scrollX,
      y: window.scrollY,
      timestamp: Date.now(),
    };
    savePositions(positions);
  }, [scrollKey]);
  
  /**
   * Restore scroll position for current key
   */
  const restoreScroll = useCallback(() => {
    const positions = getStoredPositions();
    const position = positions[scrollKey];
    
    if (position) {
      isRestoringRef.current = true;
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        window.scrollTo(position.x, position.y);
        isRestoringRef.current = false;
      });
    }
  }, [scrollKey]);
  
  /**
   * Clear scroll position for current key
   */
  const clearScroll = useCallback(() => {
    const positions = getStoredPositions();
    delete positions[scrollKey];
    savePositions(positions);
  }, [scrollKey]);
  
  // Save scroll position before navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveScroll();
    };
    
    // Save on page unload
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [saveScroll]);
  
  // Subscribe to router events to save scroll before navigation
  useEffect(() => {
    // Save scroll position when navigating away
    const unsubscribe = router.subscribe('onBeforeNavigate', () => {
      if (!isRestoringRef.current) {
        saveScroll();
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [router, saveScroll]);
  
  // Restore scroll on back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      // Small delay to let the route change complete
      setTimeout(() => {
        restoreScroll();
      }, 0);
    };
    
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [restoreScroll]);
  
  return {
    scrollRef,
    restoreScroll,
    saveScroll,
    clearScroll,
  };
}

/**
 * Hook that automatically manages scroll restoration for a route.
 * Call this at the top of route components to enable scroll restoration.
 * 
 * Requirements: 10.1
 */
export function useAutoScrollRestoration() {
  const location = useLocation();
  const { restoreScroll, saveScroll } = useScrollRestoration();
  const hasRestoredRef = useRef(false);
  const prevPathnameRef = useRef(location.pathname);
  
  // Restore scroll on mount if this is a back navigation
  useEffect(() => {
    // Check if this is a new navigation or back navigation
    const isBackNavigation = window.history.state?.idx !== undefined;
    
    if (isBackNavigation && !hasRestoredRef.current) {
      restoreScroll();
      hasRestoredRef.current = true;
    }
  }, [restoreScroll]);
  
  // Reset restoration flag when pathname changes
  useEffect(() => {
    if (location.pathname !== prevPathnameRef.current) {
      hasRestoredRef.current = false;
      prevPathnameRef.current = location.pathname;
    }
  }, [location.pathname]);
  
  // Save scroll on unmount
  useEffect(() => {
    return () => {
      saveScroll();
    };
  }, [saveScroll]);
}

export default useScrollRestoration;
