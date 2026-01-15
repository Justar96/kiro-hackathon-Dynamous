import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Feature: uiux-improvements
 * Property 7: Session Persistence Across Refresh
 * 
 * For any authenticated session, refreshing the page SHALL preserve the 
 * authentication state (user remains logged in).
 * 
 * Validates: Requirements 2.5
 */

// Session storage key used by useSession
const SESSION_STORAGE_KEY = 'thesis-session-active';

// Mock sessionStorage
const mockStorage: Record<string, string> = {};
const mockSessionStorage = {
  getItem: vi.fn((key: string) => mockStorage[key] || null),
  setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
};

// Mock user data generator
const userArbitrary = fc.record({
  id: fc.uuid(),
  email: fc.emailAddress(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  image: fc.option(fc.webUrl(), { nil: null }),
});

// Mock session data generator - ensure expiry is always in the future
const sessionArbitrary = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  // Generate dates at least 1 hour in the future to avoid edge cases
  expiresAt: fc.date({ min: new Date(Date.now() + 3600000), max: new Date(Date.now() + 86400000 * 30) }),
});

// Mock expired session generator
const expiredSessionArbitrary = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  expiresAt: fc.date({ min: new Date(Date.now() - 86400000 * 30), max: new Date(Date.now() - 1000) }), // Past date
});

// Mock authClient
const mockGetSession = vi.fn();
const mockSignOut = vi.fn();

vi.mock('../auth', () => ({
  authClient: {
    getSession: () => mockGetSession(),
    signOut: () => mockSignOut(),
  },
}));

// Import after mocking
import { useSession, useSignOut, hadActiveSession } from './useSession';

// Wrapper with QueryClient for useSignOut
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe('useSession Property Tests', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockSessionStorage.clear();
    mockGetSession.mockReset();
    mockSignOut.mockReset();
    
    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  /**
   * Property 7: Session Persistence Across Refresh
   * Validates: Requirements 2.5
   */
  describe('Property 7: Session Persistence Across Refresh', () => {
    it('for any valid user and session, session state should be restored after fetch', async () => {
      await fc.assert(
        fc.asyncProperty(userArbitrary, sessionArbitrary, async (user, session) => {
          cleanup();
          mockSessionStorage.clear();
          
          // Mock authClient to return the user and session
          mockGetSession.mockResolvedValue({
            data: { user, session },
          });
          
          const { result } = renderHook(() => useSession());
          
          // Initially loading
          expect(result.current.isLoading).toBe(true);
          
          // Wait for session to be fetched
          await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
          });
          
          // Verify user data is restored
          expect(result.current.user).not.toBeNull();
          expect(result.current.user?.id).toBe(user.id);
          expect(result.current.user?.email).toBe(user.email);
          expect(result.current.user?.name).toBe(user.name);
          
          // Verify session data is restored
          expect(result.current.session).not.toBeNull();
          expect(result.current.session?.id).toBe(session.id);
          expect(result.current.session?.userId).toBe(session.userId);
          
          // Verify session storage indicator is set
          expect(mockSessionStorage.setItem).toHaveBeenCalledWith(SESSION_STORAGE_KEY, 'true');
        }),
        { numRuns: 100 }
      );
    });

    it('for any expired session, user should be null and isExpired should be true', async () => {
      await fc.assert(
        fc.asyncProperty(userArbitrary, expiredSessionArbitrary, async (user, session) => {
          cleanup();
          mockSessionStorage.clear();
          
          // Mock authClient to return expired session
          mockGetSession.mockResolvedValue({
            data: { user, session },
          });
          
          const { result } = renderHook(() => useSession());
          
          // Wait for session to be fetched
          await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
          });
          
          // Verify user is null due to expiry
          expect(result.current.user).toBeNull();
          expect(result.current.session).toBeNull();
          expect(result.current.isExpired).toBe(true);
          
          // Verify session storage indicator is removed
          expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(SESSION_STORAGE_KEY);
        }),
        { numRuns: 100 }
      );
    });

    it('when no session exists, user should be null and isLoading should become false', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          cleanup();
          mockSessionStorage.clear();
          
          // Mock authClient to return no session
          mockGetSession.mockResolvedValue({
            data: { user: null, session: null },
          });
          
          const { result } = renderHook(() => useSession());
          
          // Wait for session to be fetched
          await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
          });
          
          // Verify no user
          expect(result.current.user).toBeNull();
          expect(result.current.session).toBeNull();
          expect(result.current.isExpired).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('hadActiveSession should return true when session storage indicator is set', () => {
      fc.assert(
        fc.property(fc.boolean(), (hasSession) => {
          mockSessionStorage.clear();
          
          if (hasSession) {
            mockStorage[SESSION_STORAGE_KEY] = 'true';
          }
          
          const result = hadActiveSession();
          expect(result).toBe(hasSession);
        }),
        { numRuns: 100 }
      );
    });

    it('session fetch error should result in null user and session', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), async (errorMessage) => {
          cleanup();
          mockSessionStorage.clear();
          
          // Mock authClient to throw error
          mockGetSession.mockRejectedValue(new Error(errorMessage));
          
          const { result } = renderHook(() => useSession());
          
          // Wait for session fetch to complete
          await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
          });
          
          // Verify error handling
          expect(result.current.user).toBeNull();
          expect(result.current.session).toBeNull();
          expect(result.current.isExpired).toBe(false);
          
          // Verify session storage is cleared on error
          expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(SESSION_STORAGE_KEY);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('useSignOut cache clearing', () => {
    it('signOut should clear session storage and call authClient.signOut', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async () => {
          cleanup();
          mockSessionStorage.clear();
          mockStorage[SESSION_STORAGE_KEY] = 'true';
          
          // Mock successful sign out
          mockSignOut.mockResolvedValue({});
          
          // Mock window.location.href
          const hrefSetter = vi.fn();
          Object.defineProperty(window, 'location', {
            value: { href: '' },
            writable: true,
            configurable: true,
          });
          Object.defineProperty(window.location, 'href', {
            set: hrefSetter,
            get: () => '',
            configurable: true,
          });
          
          const wrapper = createWrapper();
          const { result } = renderHook(() => useSignOut(), { wrapper });
          
          // Call signOut
          await act(async () => {
            await result.current.signOut();
          });
          
          // Verify authClient.signOut was called
          expect(mockSignOut).toHaveBeenCalled();
          
          // Verify session storage was cleared
          expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(SESSION_STORAGE_KEY);
          
          // Verify redirect to home was attempted
          expect(hrefSetter).toHaveBeenCalledWith('/');
        }),
        { numRuns: 100 }
      );
    });

    it('signOut should still clear local state even if authClient.signOut fails', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), async (errorMessage) => {
          cleanup();
          mockSessionStorage.clear();
          mockStorage[SESSION_STORAGE_KEY] = 'true';
          
          // Mock failed sign out
          mockSignOut.mockRejectedValue(new Error(errorMessage));
          
          // Mock window.location.href
          const hrefSetter = vi.fn();
          Object.defineProperty(window, 'location', {
            value: { href: '' },
            writable: true,
            configurable: true,
          });
          Object.defineProperty(window.location, 'href', {
            set: hrefSetter,
            get: () => '',
            configurable: true,
          });
          
          // Suppress console.error for this test
          const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
          
          const wrapper = createWrapper();
          const { result } = renderHook(() => useSignOut(), { wrapper });
          
          // Call signOut
          await act(async () => {
            await result.current.signOut();
          });
          
          // Verify session storage was still cleared
          expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(SESSION_STORAGE_KEY);
          
          // Verify redirect still happens
          expect(hrefSetter).toHaveBeenCalledWith('/');
          
          // Restore
          consoleSpy.mockRestore();
        }),
        { numRuns: 100 }
      );
    });
  });
});
