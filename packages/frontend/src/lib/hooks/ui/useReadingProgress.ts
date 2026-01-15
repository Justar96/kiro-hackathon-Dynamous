/**
 * Reading Progress Hook
 * 
 * Hook to track reading progress based on scroll position.
 * Returns a percentage (0-100) of how far the user has scrolled through the content.
 * 
 * Requirements: 10.7
 */

import { useState, useEffect } from 'react';

/**
 * Hook to track reading progress based on scroll position.
 * Returns a percentage (0-100) of how far the user has scrolled through the content.
 * 
 * @param contentElementId - The ID of the main content container
 * @returns Reading progress as a percentage (0-100)
 */
export function useReadingProgress(contentElementId?: string) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const contentElement = contentElementId 
        ? document.getElementById(contentElementId)
        : document.documentElement;
      
      if (!contentElement) return;

      const scrollTop = window.scrollY;
      const scrollHeight = contentElement.scrollHeight - window.innerHeight;
      
      if (scrollHeight <= 0) {
        setProgress(100);
        return;
      }

      const currentProgress = Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100));
      setProgress(currentProgress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [contentElementId]);

  return progress;
}
