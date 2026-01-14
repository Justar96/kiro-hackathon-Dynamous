import { useEffect, useRef, useCallback } from 'react';

/**
 * Storage key prefix for scroll positions
 */
const SCROLL_STORAGE_KEY = 'scroll-positions';

/**
 * Maximum number of scroll positions to store
 */
const MAX_STORED_POSITIONS = 50;

/**
 * Default debounce delay in milliseconds
 */
const DEFAULT_DEBOUNCE_MS = 100;

/**
 * Interface for stored scroll position data
 */
interface ScrollPosition {
  x: number;
  y: number;
  timestamp: number;
}

/**
 * Options for useScrollRestoration hook
 */
export interface UseScrollRestorationOptions {
  /** Unique key for storing scroll position */
  key: string;
  /** Whether scroll restoration is enabled (default: true) */
  enabled?: boolean;
  /** Debounce delay in ms for saving scroll position (default: 100) */
  debounceMs?: number;
}

/**
 * Return type for useScrollRestoration hook
 */
export interface UseScrollRestorationResult {
  /** Ref to attach to the scrollable container */
  scrollRef: React.RefObject<HTMLDivElement>;
  /** Manually save current scroll position */
  savePosition: () => void;
  /** Manually restore saved scroll position */
  restorePosition: () => void;
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
    // Ignore storage errors (e.g., quota exceeded, private browsing)
  }
}

/**
 * Simple debounce function
 */
function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  const debounced = ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  }) as T & { cancel: () => void };
  
  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  
  return debounced;
}

/**
 * Hook for preserving and restoring scroll position.
 * 
 * Saves scroll position to sessionStorage on scroll (debounced).
 * Restores position on component mount.
 * 
 * Requirements: 1.4, 1.5
 * - 1.4: Maintain scroll position when new content loads
 * - 1.5: Restore scroll position when returning to feed
 * 
 * @param options - Configuration options
 * @returns Object with scrollRef, savePosition, and restorePosition
 */
export function useScrollRestoration(
  options: UseScrollRestorationOptions
): UseScrollRestorationResult {
  const { key, enabled = true, debounceMs = DEFAULT_DEBOUNCE_MS } = options;
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasRestoredRef = useRef(false);
  
  /**
   * Save current scroll position to sessionStorage
   */
  const savePosition = useCallback(() => {
    if (!enabled) return;
    
    const positions = getStoredPositions();
    positions[key] = {
      x: window.scrollX,
      y: window.scrollY,
      timestamp: Date.now(),
    };
    savePositions(positions);
  }, [key, enabled]);
  
  /**
   * Restore saved scroll position
   */
  const restorePosition = useCallback(() => {
    if (!enabled) return;
    
    const positions = getStoredPositions();
    const position = positions[key];
    
    if (position) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        window.scrollTo(position.x, position.y);
      });
    }
  }, [key, enabled]);
  
  // Create debounced save function
  const debouncedSaveRef = useRef<ReturnType<typeof debounce> | null>(null);
  
  useEffect(() => {
    if (!enabled) return;
    
    // Create debounced save function
    debouncedSaveRef.current = debounce(savePosition, debounceMs);
    
    return () => {
      debouncedSaveRef.current?.cancel();
    };
  }, [savePosition, debounceMs, enabled]);
  
  // Save scroll position on scroll (debounced)
  useEffect(() => {
    if (!enabled) return;
    
    const handleScroll = () => {
      debouncedSaveRef.current?.();
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      // Save final position on cleanup
      savePosition();
    };
  }, [enabled, savePosition]);
  
  // Restore scroll position on mount
  useEffect(() => {
    if (!enabled || hasRestoredRef.current) return;
    
    // Small delay to ensure content is rendered
    const timeoutId = setTimeout(() => {
      restorePosition();
      hasRestoredRef.current = true;
    }, 0);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [enabled, restorePosition]);
  
  // Reset restoration flag when key changes
  useEffect(() => {
    hasRestoredRef.current = false;
  }, [key]);
  
  return {
    scrollRef,
    savePosition,
    restorePosition,
  };
}

export default useScrollRestoration;
