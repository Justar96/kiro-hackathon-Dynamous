/**
 * Unsaved Changes Hook
 * 
 * Hook for warning users before navigation when there are unsaved changes.
 * Shows a confirmation dialog when the user tries to navigate away.
 * 
 * Requirements: 10.4
 */

import { useEffect, useCallback, useRef } from 'react';
import { useBlocker } from '@tanstack/react-router';

/**
 * Options for unsaved changes warning
 */
export interface UseUnsavedChangesOptions {
  /**
   * Custom message to show in the confirmation dialog
   */
  message?: string;
  
  /**
   * Whether to also warn on browser refresh/close (default: true)
   */
  warnOnUnload?: boolean;
}

/**
 * Default options for unsaved changes warning
 */
const DEFAULT_OPTIONS: Required<UseUnsavedChangesOptions> = {
  message: 'You have unsaved changes. Are you sure you want to leave?',
  warnOnUnload: true,
};

/**
 * Hook for warning users before navigation when there are unsaved changes.
 * Shows a confirmation dialog when the user tries to navigate away.
 * 
 * @param hasChanges - Whether there are unsaved changes
 * @param options - Configuration options for the warning behavior
 */
export function useUnsavedChanges(
  hasChanges: boolean,
  options: UseUnsavedChangesOptions = {}
) {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const hasChangesRef = useRef(hasChanges);
  
  // Keep ref in sync with prop
  useEffect(() => {
    hasChangesRef.current = hasChanges;
  }, [hasChanges]);
  
  // Use TanStack Router's blocker for in-app navigation
  useBlocker({
    shouldBlockFn: () => hasChanges,
    withResolver: true,
  });
  
  // Handle browser refresh/close
  useEffect(() => {
    if (!mergedOptions.warnOnUnload) {
      return;
    }
    
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasChangesRef.current) {
        event.preventDefault();
        // Modern browsers ignore custom messages, but we set it anyway
        event.returnValue = mergedOptions.message;
        return mergedOptions.message;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [mergedOptions.warnOnUnload, mergedOptions.message]);
}

/**
 * Hook that provides more control over the unsaved changes warning.
 * Returns functions to manually trigger and handle the warning.
 * 
 * @param hasChanges - Whether there are unsaved changes
 * @param options - Configuration options for the warning behavior
 * @returns Object with control functions
 */
export function useUnsavedChangesControl(
  hasChanges: boolean,
  options: UseUnsavedChangesOptions = {}
) {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const hasChangesRef = useRef(hasChanges);
  
  // Keep ref in sync with prop
  useEffect(() => {
    hasChangesRef.current = hasChanges;
  }, [hasChanges]);
  
  /**
   * Check if navigation should be blocked and show confirmation if needed
   * @returns true if navigation should proceed, false if blocked
   */
  const confirmNavigation = useCallback((): boolean => {
    if (!hasChangesRef.current) {
      return true;
    }
    
    return window.confirm(mergedOptions.message);
  }, [mergedOptions.message]);
  
  /**
   * Force navigation without confirmation
   */
  const forceNavigate = useCallback(() => {
    hasChangesRef.current = false;
  }, []);
  
  // Handle browser refresh/close
  useEffect(() => {
    if (!mergedOptions.warnOnUnload) {
      return;
    }
    
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasChangesRef.current) {
        event.preventDefault();
        event.returnValue = mergedOptions.message;
        return mergedOptions.message;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [mergedOptions.warnOnUnload, mergedOptions.message]);
  
  return {
    hasChanges,
    confirmNavigation,
    forceNavigate,
    message: mergedOptions.message,
  };
}
