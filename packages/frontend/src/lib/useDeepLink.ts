import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from '@tanstack/react-router';

/**
 * Options for deep link navigation
 */
export interface UseDeepLinkOptions {
  /**
   * Offset from top of viewport when scrolling to element (default: 80px for header)
   */
  offset?: number;
  
  /**
   * Scroll behavior (default: 'smooth')
   */
  behavior?: ScrollBehavior;
  
  /**
   * Delay before scrolling to allow DOM to render (default: 100ms)
   */
  delay?: number;
  
  /**
   * Whether to update URL hash when scrolling to sections (default: false)
   */
  updateHashOnScroll?: boolean;
}

/**
 * Default options for deep link navigation
 */
const DEFAULT_OPTIONS: Required<UseDeepLinkOptions> = {
  offset: 80,
  behavior: 'smooth',
  delay: 100,
  updateHashOnScroll: false,
};

/**
 * Hook for handling deep link navigation via URL hash fragments.
 * Parses URL hash on page load and scrolls to the corresponding section.
 * 
 * Requirements: 10.2
 * 
 * @param options - Configuration options for deep link behavior
 * @returns Object with scrollToHash function and current hash
 */
export function useDeepLink(options: UseDeepLinkOptions = {}) {
  const location = useLocation();
  const hasScrolledRef = useRef(false);
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  /**
   * Scroll to an element by its ID
   */
  const scrollToElement = useCallback((elementId: string) => {
    const element = document.getElementById(elementId);
    
    if (element) {
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - mergedOptions.offset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: mergedOptions.behavior,
      });
      
      return true;
    }
    
    return false;
  }, [mergedOptions.offset, mergedOptions.behavior]);
  
  /**
   * Scroll to element specified by hash
   */
  const scrollToHash = useCallback((hash?: string) => {
    const targetHash = hash || location.hash;
    
    if (!targetHash || targetHash === '#') {
      return false;
    }
    
    // Remove the leading '#' from hash
    const elementId = targetHash.startsWith('#') ? targetHash.slice(1) : targetHash;
    
    if (!elementId) {
      return false;
    }
    
    return scrollToElement(elementId);
  }, [location.hash, scrollToElement]);
  
  /**
   * Update URL hash without triggering navigation
   */
  const updateHash = useCallback((hash: string) => {
    const newHash = hash.startsWith('#') ? hash : `#${hash}`;
    
    // Use replaceState to update URL without adding to history
    window.history.replaceState(
      window.history.state,
      '',
      `${location.pathname}${location.search}${newHash}`
    );
  }, [location.pathname, location.search]);
  
  /**
   * Clear the URL hash
   */
  const clearHash = useCallback(() => {
    window.history.replaceState(
      window.history.state,
      '',
      `${location.pathname}${location.search}`
    );
  }, [location.pathname, location.search]);
  
  // Handle initial hash on page load
  useEffect(() => {
    if (hasScrolledRef.current) {
      return;
    }
    
    const hash = location.hash;
    
    if (hash && hash !== '#') {
      // Delay to allow DOM to render
      const timeoutId = setTimeout(() => {
        const success = scrollToHash(hash);
        if (success) {
          hasScrolledRef.current = true;
        }
      }, mergedOptions.delay);
      
      return () => clearTimeout(timeoutId);
    }
  }, [location.hash, scrollToHash, mergedOptions.delay]);
  
  // Reset scroll flag when pathname changes
  useEffect(() => {
    hasScrolledRef.current = false;
  }, [location.pathname]);
  
  // Handle hash changes (e.g., clicking anchor links)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash && hash !== '#') {
        scrollToHash(hash);
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [scrollToHash]);
  
  return {
    scrollToHash,
    scrollToElement,
    updateHash,
    clearHash,
    currentHash: location.hash,
  };
}

/**
 * Hook that automatically handles deep link navigation on mount.
 * Use this in route components to enable deep linking.
 * 
 * Requirements: 10.2
 * 
 * @param options - Configuration options for deep link behavior
 */
export function useAutoDeepLink(options: UseDeepLinkOptions = {}) {
  const { scrollToHash, currentHash } = useDeepLink(options);
  const hasProcessedRef = useRef(false);
  
  useEffect(() => {
    if (hasProcessedRef.current) {
      return;
    }
    
    if (currentHash && currentHash !== '#') {
      // Small delay to ensure DOM is ready
      const timeoutId = setTimeout(() => {
        scrollToHash();
        hasProcessedRef.current = true;
      }, options.delay ?? 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [currentHash, scrollToHash, options.delay]);
}

export default useDeepLink;
