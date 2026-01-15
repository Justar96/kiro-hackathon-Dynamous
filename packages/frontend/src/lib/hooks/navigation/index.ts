/**
 * Navigation Hooks Index
 * 
 * Hooks for navigation, URL state, scroll handling, and prefetching.
 */

// Deep link navigation
export { useDeepLink, useAutoDeepLink } from './useDeepLink';
export type { UseDeepLinkOptions } from './useDeepLink';

// Scroll restoration
export { useScrollRestoration } from './useScrollRestoration';
export type { UseScrollRestorationOptions, UseScrollRestorationResult } from './useScrollRestoration';

// Modal URL sync
export { useModalUrlSync, useModalUrlState } from './useModalUrlSync';
export type { UseModalUrlSyncOptions } from './useModalUrlSync';

// Prefetch
export { usePrefetch, usePrefetchDebate, useDebateLinkPrefetch } from './usePrefetch';
export type { UsePrefetchOptions } from './usePrefetch';
