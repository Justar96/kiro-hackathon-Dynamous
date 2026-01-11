import { useState, useEffect } from 'react';

// Default breakpoint matches Tailwind's sm breakpoint
const DEFAULT_MOBILE_BREAKPOINT = 640;

/**
 * Hook to detect if viewport is mobile-sized.
 * 
 * @param breakpoint - Width threshold in pixels (default: 640, Tailwind's sm breakpoint)
 * @returns true if viewport width is less than breakpoint
 * 
 * Requirements: 7.1, 7.2
 */
export function useIsMobile(breakpoint: number = DEFAULT_MOBILE_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    // Set initial value
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}
