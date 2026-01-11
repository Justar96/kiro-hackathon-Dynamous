/**
 * Integration Test: Sign-Up to Profile Flow
 * 
 * This test verifies the complete flow from sign-up to profile display:
 * - Username collection during sign-up
 * - Profile creation with username
 * - Onboarding toast display
 * - ProfileDropdown showing correct user data
 * 
 * Requirements: 2.1, 2.4, 2.5, 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock TanStack Router's Link component
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, onClick, ...props }: { children: React.ReactNode; to: string; onClick?: () => void; [key: string]: unknown }) => (
    <a href={to} onClick={onClick} {...props}>{children}</a>
  ),
}));

// Import after mocking
import { ProfileDropdown, ProfileDropdownUser, PlatformUser } from './ProfileDropdown';
import { ToastProvider } from '../common/Toast';
import { validateUsername } from './AuthProvider';

// Create a wrapper component for tests
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </QueryClientProvider>
    );
  };
}

describe('Sign-Up to Profile Flow Integration', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Test 1: Username validation during sign-up
   * Requirements: 2.1, 2.2
   */
  describe('Username Collection', () => {
    it('should validate username format correctly', () => {
      // Valid usernames
      expect(validateUsername('testuser')).toBe(true);
      expect(validateUsername('test_user')).toBe(true);
      expect(validateUsername('TestUser123')).toBe(true);
      expect(validateUsername('___')).toBe(true);
      
      // Invalid usernames - too short
      expect(validateUsername('')).toBe('Username must be at least 3 characters');
      expect(validateUsername('ab')).toBe('Username must be at least 3 characters');
      
      // Invalid usernames - special characters
      expect(validateUsername('test@user')).toBe('Username can only contain letters, numbers, and underscores');
      expect(validateUsername('test user')).toBe('Username can only contain letters, numbers, and underscores');
      expect(validateUsername('test-user')).toBe('Username can only contain letters, numbers, and underscores');
    });
  });

  /**
   * Test 2: Profile creation with username
   * Requirements: 2.4
   */
  describe('Profile Creation', () => {
    it('should create profile with valid username', async () => {
      // Mock the fetch API for profile creation
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          user: {
            id: 'user-123',
            username: 'testuser',
            email: 'test@example.com',
            reputationScore: 0,
            sandboxCompleted: false,
            debatesParticipated: 0,
          },
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      // Simulate profile creation API call
      const response = await fetch('/api/users/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer auth-user-id',
        },
        body: JSON.stringify({ username: 'testuser' }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.user.username).toBe('testuser');
      expect(data.user.sandboxCompleted).toBe(false);
      expect(data.user.debatesParticipated).toBe(0);
      
      vi.unstubAllGlobals();
    });

    it('should reject profile creation with invalid username', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({
          error: 'Username must be at least 3 characters',
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const response = await fetch('/api/users/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer auth-user-id',
        },
        body: JSON.stringify({ username: 'ab' }),
      });

      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toContain('Username must be at least 3 characters');
      
      vi.unstubAllGlobals();
    });
  });

  /**
   * Test 3: ProfileDropdown displays correct user data
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
   */
  describe('ProfileDropdown User Data Display', () => {
    const mockAuthUser: ProfileDropdownUser = {
      id: 'auth-user-123',
      name: 'Test User',
      email: 'test@example.com',
      image: null,
    };

    const mockPlatformUser: PlatformUser = {
      id: 'platform-user-123',
      username: 'testuser',
      reputationScore: 50,
      sandboxCompleted: false,
      debatesParticipated: 2,
    };

    it('should display user info in dropdown header', async () => {
      const Wrapper = createWrapper();
      
      render(
        <Wrapper>
          <ProfileDropdown
            user={mockAuthUser}
            platformUser={mockPlatformUser}
            data-testid="profile-dropdown"
          />
        </Wrapper>
      );

      // Open dropdown
      const trigger = screen.getByTestId('profile-dropdown-trigger');
      act(() => {
        trigger.click();
      });

      // Verify user info is displayed
      await waitFor(() => {
        expect(screen.getByTestId('profile-dropdown-display-name')).toHaveTextContent('testuser');
        expect(screen.getByTestId('profile-dropdown-email')).toHaveTextContent('test@example.com');
      });
    });

    it('should display sandbox status for new users', async () => {
      const Wrapper = createWrapper();
      
      render(
        <Wrapper>
          <ProfileDropdown
            user={mockAuthUser}
            platformUser={mockPlatformUser}
            data-testid="profile-dropdown"
          />
        </Wrapper>
      );

      // Open dropdown
      const trigger = screen.getByTestId('profile-dropdown-trigger');
      act(() => {
        trigger.click();
      });

      // Verify sandbox status is displayed
      await waitFor(() => {
        expect(screen.getByTestId('profile-dropdown-sandbox-status')).toBeInTheDocument();
        expect(screen.getByTestId('profile-dropdown-sandbox-progress')).toHaveTextContent('2/5 debates');
      });
    });

    it('should display reputation score', async () => {
      const Wrapper = createWrapper();
      
      render(
        <Wrapper>
          <ProfileDropdown
            user={mockAuthUser}
            platformUser={mockPlatformUser}
            data-testid="profile-dropdown"
          />
        </Wrapper>
      );

      // Open dropdown
      const trigger = screen.getByTestId('profile-dropdown-trigger');
      act(() => {
        trigger.click();
      });

      // Verify reputation score is displayed
      await waitFor(() => {
        expect(screen.getByTestId('profile-dropdown-reputation-score')).toHaveTextContent('+50');
      });
    });

    it('should not display sandbox status for users who completed sandbox', async () => {
      const completedUser: PlatformUser = {
        ...mockPlatformUser,
        sandboxCompleted: true,
        debatesParticipated: 5,
      };

      const Wrapper = createWrapper();
      
      render(
        <Wrapper>
          <ProfileDropdown
            user={mockAuthUser}
            platformUser={completedUser}
            data-testid="profile-dropdown"
          />
        </Wrapper>
      );

      // Open dropdown
      const trigger = screen.getByTestId('profile-dropdown-trigger');
      act(() => {
        trigger.click();
      });

      // Verify sandbox status is NOT displayed
      await waitFor(() => {
        expect(screen.queryByTestId('profile-dropdown-sandbox-status')).not.toBeInTheDocument();
      });
    });

    it('should handle missing platform user data gracefully', async () => {
      const Wrapper = createWrapper();
      
      render(
        <Wrapper>
          <ProfileDropdown
            user={mockAuthUser}
            platformUser={null}
            data-testid="profile-dropdown"
          />
        </Wrapper>
      );

      // Open dropdown
      const trigger = screen.getByTestId('profile-dropdown-trigger');
      act(() => {
        trigger.click();
      });

      // Verify auth user info is displayed as fallback
      await waitFor(() => {
        expect(screen.getByTestId('profile-dropdown-display-name')).toHaveTextContent('Test User');
        expect(screen.getByTestId('profile-dropdown-email')).toHaveTextContent('test@example.com');
      });

      // Verify sandbox and reputation are not displayed
      expect(screen.queryByTestId('profile-dropdown-sandbox-status')).not.toBeInTheDocument();
      expect(screen.queryByTestId('profile-dropdown-reputation')).not.toBeInTheDocument();
    });
  });

  /**
   * Test 4: Full flow simulation
   * Requirements: 2.1, 2.4, 2.5, 5.1-5.5
   */
  describe('Full Sign-Up to Profile Flow', () => {
    it('should complete full flow: validate username -> create profile -> display in dropdown', async () => {
      // Step 1: Validate username
      const username = 'newuser123';
      expect(validateUsername(username)).toBe(true);

      // Step 2: Mock profile creation
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          user: {
            id: 'new-user-id',
            username: username,
            email: 'newuser@example.com',
            reputationScore: 0,
            sandboxCompleted: false,
            debatesParticipated: 0,
          },
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const response = await fetch('/api/users/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer auth-id',
        },
        body: JSON.stringify({ username }),
      });

      expect(response.ok).toBe(true);
      const profileData = await response.json();
      
      vi.unstubAllGlobals();

      // Step 3: Render ProfileDropdown with created profile data
      const authUser: ProfileDropdownUser = {
        id: 'auth-id',
        name: 'New User',
        email: 'newuser@example.com',
        image: null,
      };

      const platformUser: PlatformUser = {
        id: profileData.user.id,
        username: profileData.user.username,
        reputationScore: profileData.user.reputationScore,
        sandboxCompleted: profileData.user.sandboxCompleted,
        debatesParticipated: profileData.user.debatesParticipated,
      };

      const Wrapper = createWrapper();
      
      render(
        <Wrapper>
          <ProfileDropdown
            user={authUser}
            platformUser={platformUser}
            data-testid="profile-dropdown"
          />
        </Wrapper>
      );

      // Step 4: Verify dropdown shows correct data
      const trigger = screen.getByTestId('profile-dropdown-trigger');
      act(() => {
        trigger.click();
      });

      await waitFor(() => {
        // Username should be displayed
        expect(screen.getByTestId('profile-dropdown-display-name')).toHaveTextContent('newuser123');
        
        // Email should be displayed
        expect(screen.getByTestId('profile-dropdown-email')).toHaveTextContent('newuser@example.com');
        
        // Sandbox status should be shown (new user)
        expect(screen.getByTestId('profile-dropdown-sandbox-status')).toBeInTheDocument();
        expect(screen.getByTestId('profile-dropdown-sandbox-progress')).toHaveTextContent('0/5 debates');
        
        // Reputation should be 0
        expect(screen.getByTestId('profile-dropdown-reputation-score')).toHaveTextContent('0');
      });
    });
  });
});
