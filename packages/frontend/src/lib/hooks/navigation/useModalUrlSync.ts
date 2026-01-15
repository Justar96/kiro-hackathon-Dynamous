/**
 * Modal URL Sync Hook
 * 
 * Hook for syncing modal state with URL.
 * Updates URL when modal opens/closes and parses URL on load to restore modal state.
 * 
 * Requirements: 10.5
 */

import { useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';

/**
 * URL parameter name for modal state
 */
const MODAL_PARAM = 'modal';

/**
 * Options for modal URL sync
 */
export interface UseModalUrlSyncOptions {
  /**
   * The modal identifier to use in the URL (e.g., 'auth', 'settings')
   */
  modalId: string;
  
  /**
   * Optional sub-state to include in the URL (e.g., 'sign-in', 'sign-up')
   */
  subState?: string;
  
  /**
   * Whether to use replaceState instead of pushState (default: true)
   * Using replaceState prevents adding to browser history
   */
  replace?: boolean;
}

/**
 * Hook for syncing modal state with URL.
 * Updates URL when modal opens/closes and parses URL on load to restore modal state.
 * 
 * @param isOpen - Whether the modal is currently open
 * @param onOpenFromUrl - Callback when modal should open from URL state
 * @param onCloseFromUrl - Callback when modal should close from URL state
 * @param options - Configuration options
 */
export function useModalUrlSync(
  isOpen: boolean,
  onOpenFromUrl: (subState?: string) => void,
  onCloseFromUrl: () => void,
  options: UseModalUrlSyncOptions
) {
  const location = useLocation();
  const navigate = useNavigate();
  const { modalId, subState, replace = true } = options;
  const isInitializedRef = useRef(false);
  const lastUrlStateRef = useRef<string | null>(null);
  
  /**
   * Build the modal URL parameter value
   */
  const buildModalValue = useCallback(() => {
    return subState ? `${modalId}-${subState}` : modalId;
  }, [modalId, subState]);
  
  /**
   * Parse modal value from URL
   */
  const parseModalValue = useCallback((value: string | null): { id: string; subState?: string } | null => {
    if (!value) return null;
    
    const parts = value.split('-');
    if (parts.length === 1) {
      return { id: parts[0] };
    }
    return { id: parts[0], subState: parts.slice(1).join('-') };
  }, []);
  
  /**
   * Update URL to reflect modal state
   */
  const updateUrl = useCallback((open: boolean) => {
    const searchParams = new URLSearchParams(location.search);
    
    if (open) {
      const modalValue = buildModalValue();
      searchParams.set(MODAL_PARAM, modalValue);
      lastUrlStateRef.current = modalValue;
    } else {
      searchParams.delete(MODAL_PARAM);
      lastUrlStateRef.current = null;
    }
    
    const newSearch = searchParams.toString();
    const newUrl = newSearch ? `${location.pathname}?${newSearch}` : location.pathname;
    
    // Use navigate with replace option
    navigate({
      to: newUrl,
      replace,
    });
  }, [location.pathname, location.search, buildModalValue, navigate, replace]);
  
  // Parse URL on initial load to restore modal state
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;
    
    const searchParams = new URLSearchParams(location.search);
    const modalValue = searchParams.get(MODAL_PARAM);
    const parsed = parseModalValue(modalValue);
    
    if (parsed && parsed.id === modalId) {
      lastUrlStateRef.current = modalValue;
      onOpenFromUrl(parsed.subState);
    }
  }, [location.search, modalId, parseModalValue, onOpenFromUrl]);
  
  // Update URL when modal state changes
  useEffect(() => {
    // Skip if this is the initial render
    if (!isInitializedRef.current) return;
    
    const currentModalValue = buildModalValue();
    const urlHasModal = lastUrlStateRef.current === currentModalValue;
    
    // Only update URL if state has changed
    if (isOpen && !urlHasModal) {
      updateUrl(true);
    } else if (!isOpen && lastUrlStateRef.current !== null) {
      updateUrl(false);
    }
  }, [isOpen, buildModalValue, updateUrl]);
  
  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const modalValue = searchParams.get(MODAL_PARAM);
      const parsed = parseModalValue(modalValue);
      
      if (parsed && parsed.id === modalId) {
        if (!isOpen) {
          lastUrlStateRef.current = modalValue;
          onOpenFromUrl(parsed.subState);
        }
      } else {
        if (isOpen) {
          lastUrlStateRef.current = null;
          onCloseFromUrl();
        }
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, modalId, parseModalValue, onOpenFromUrl, onCloseFromUrl]);
  
  return {
    updateUrl,
  };
}

/**
 * Simpler hook that just provides URL state reading/writing for modals.
 * Use this when you want more control over when URL updates happen.
 * 
 * @param modalId - The modal identifier to use in the URL
 * @returns Object with functions to read and write modal URL state
 */
export function useModalUrlState(modalId: string) {
  const location = useLocation();
  const navigate = useNavigate();
  
  /**
   * Check if modal should be open based on URL
   */
  const getUrlState = useCallback((): { isOpen: boolean; subState?: string } => {
    const searchParams = new URLSearchParams(location.search);
    const modalValue = searchParams.get(MODAL_PARAM);
    
    if (!modalValue) {
      return { isOpen: false };
    }
    
    const parts = modalValue.split('-');
    if (parts[0] !== modalId) {
      return { isOpen: false };
    }
    
    return {
      isOpen: true,
      subState: parts.length > 1 ? parts.slice(1).join('-') : undefined,
    };
  }, [location.search, modalId]);
  
  /**
   * Update URL to reflect modal state
   */
  const setUrlState = useCallback((isOpen: boolean, subState?: string, replace = true) => {
    const searchParams = new URLSearchParams(location.search);
    
    if (isOpen) {
      const modalValue = subState ? `${modalId}-${subState}` : modalId;
      searchParams.set(MODAL_PARAM, modalValue);
    } else {
      searchParams.delete(MODAL_PARAM);
    }
    
    const newSearch = searchParams.toString();
    const newUrl = newSearch ? `${location.pathname}?${newSearch}` : location.pathname;
    
    navigate({
      to: newUrl,
      replace,
    });
  }, [location.pathname, location.search, modalId, navigate]);
  
  /**
   * Clear modal from URL
   */
  const clearUrlState = useCallback((replace = true) => {
    setUrlState(false, undefined, replace);
  }, [setUrlState]);
  
  return {
    getUrlState,
    setUrlState,
    clearUrlState,
  };
}
