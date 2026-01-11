import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ProfileDropdown, ProfileDropdownUser, PlatformUser } from './ProfileDropdown';
import { ToastProvider } from './Toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the useSignOut hook
vi.mock('../lib/useSession', () => ({
  useSignOut: () => ({
    signOut: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock TanStack Router's Link component
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, onClick, ...props }: { children: React.ReactNode; to: string; onClick?: () => void; [key: string]: unknown }) => (
    <a href={to} onClick={onClick} {...props}>{children}</a>
  ),
}));

/**
 * Feature: auth-profile-enhancements, Property 1: Dropdown Toggle Behavior
 * Validates: Requirements 1.1
 * 
 * For any signed-in user, clicking the profile dropdown trigger SHALL toggle
 * the dropdown open state (closed → open, open → closed).
 */

// Arbitrary for generating valid user data
const userArbitrary: fc.Arbitrary<ProfileDropdownUser> = fc.record({
  id: fc.uuid(),
  name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  email: fc.emailAddress(),
  image: fc.option(fc.webUrl(), { nil: null }),
});

// Arbitrary for generating platform user data
const platformUserArbitrary: fc.Arbitrary<PlatformUser> = fc.record({
  id: fc.uuid(),
  username: fc.string({ minLength: 3, maxLength: 30 }),
  reputationScore: fc.integer({ min: -1000, max: 1000 }),
  sandboxCompleted: fc.boolean(),
  debatesParticipated: fc.integer({ min: 0, max: 100 }),
});

// Helper to create test wrapper with providers
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
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

describe('ProfileDropdown Property Tests - Toggle Behavior', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 1: Dropdown Toggle Behavior
   * For any signed-in user, clicking the profile dropdown trigger SHALL toggle
   * the dropdown open state (closed → open, open → closed).
   * Validates: Requirements 1.1
   */
  it('Property 1: Clicking trigger should toggle dropdown from closed to open', () => {
    fc.assert(
      fc.property(userArbitrary, (user) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        
        // Initially dropdown should be closed (no menu visible)
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        
        // Click trigger to open
        fireEvent.click(trigger);
        
        // Dropdown should now be open
        expect(screen.getByRole('menu')).toBeInTheDocument();
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1: Dropdown Toggle Behavior (close)
   * For any signed-in user, clicking the trigger when open SHALL close the dropdown.
   * Validates: Requirements 1.1
   */
  it('Property 1: Clicking trigger should toggle dropdown from open to closed', () => {
    fc.assert(
      fc.property(userArbitrary, (user) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        
        // Open the dropdown first
        fireEvent.click(trigger);
        expect(screen.getByRole('menu')).toBeInTheDocument();
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        
        // Click trigger again to close
        fireEvent.click(trigger);
        
        // Dropdown should now be closed
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1: Dropdown Toggle Behavior (multiple toggles)
   * For any signed-in user, multiple clicks should consistently toggle state.
   * Validates: Requirements 1.1
   */
  it('Property 1: Multiple clicks should consistently toggle dropdown state', () => {
    fc.assert(
      fc.property(
        userArbitrary,
        fc.integer({ min: 1, max: 10 }),
        (user, clickCount) => {
          cleanup();
          
          render(
            <ProfileDropdown
              user={user}
              data-testid="profile-dropdown"
            />,
            { wrapper: createWrapper() }
          );
          
          const trigger = screen.getByTestId('profile-dropdown-trigger');
          
          // Perform multiple clicks
          for (let i = 0; i < clickCount; i++) {
            fireEvent.click(trigger);
          }
          
          // After odd number of clicks, dropdown should be open
          // After even number of clicks, dropdown should be closed
          const shouldBeOpen = clickCount % 2 === 1;
          
          if (shouldBeOpen) {
            expect(screen.getByRole('menu')).toBeInTheDocument();
            expect(trigger).toHaveAttribute('aria-expanded', 'true');
          } else {
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
            expect(trigger).toHaveAttribute('aria-expanded', 'false');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: auth-profile-enhancements, Property 3: Dropdown Close on Outside Click/Escape
 * Validates: Requirements 1.7
 * 
 * For any open dropdown, clicking outside the dropdown OR pressing the Escape key
 * SHALL close the dropdown.
 */
describe('ProfileDropdown Property Tests - Close Behavior', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 3: Dropdown Close on Outside Click
   * For any open dropdown, clicking outside SHALL close the dropdown.
   * Validates: Requirements 1.7
   */
  it('Property 3: Clicking outside should close an open dropdown', () => {
    fc.assert(
      fc.property(userArbitrary, (user) => {
        cleanup();
        
        const Wrapper = createWrapper();
        
        // Render dropdown with an outside element to click
        render(
          <Wrapper>
            <div data-testid="outside-element">Outside</div>
            <ProfileDropdown
              user={user}
              data-testid="profile-dropdown"
            />
          </Wrapper>
        );
        
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        
        // Open the dropdown first
        fireEvent.click(trigger);
        expect(screen.getByRole('menu')).toBeInTheDocument();
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        
        // Click outside the dropdown
        const outsideElement = screen.getByTestId('outside-element');
        fireEvent.mouseDown(outsideElement);
        
        // Dropdown should now be closed
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Dropdown Close on Escape Key
   * For any open dropdown, pressing Escape SHALL close the dropdown.
   * Validates: Requirements 1.7
   */
  it('Property 3: Pressing Escape should close an open dropdown', () => {
    fc.assert(
      fc.property(userArbitrary, (user) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        
        // Open the dropdown first
        fireEvent.click(trigger);
        expect(screen.getByRole('menu')).toBeInTheDocument();
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        
        // Press Escape key
        fireEvent.keyDown(document, { key: 'Escape' });
        
        // Dropdown should now be closed
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Clicking inside dropdown should NOT close it
   * For any open dropdown, clicking inside the dropdown SHALL keep it open.
   * Validates: Requirements 1.7 (inverse case)
   */
  it('Property 3: Clicking inside dropdown should NOT close it', () => {
    fc.assert(
      fc.property(userArbitrary, (user) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        
        // Open the dropdown first
        fireEvent.click(trigger);
        expect(screen.getByRole('menu')).toBeInTheDocument();
        
        // Click inside the dropdown menu
        const menu = screen.getByRole('menu');
        fireEvent.mouseDown(menu);
        
        // Dropdown should still be open
        expect(screen.getByRole('menu')).toBeInTheDocument();
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Other keys should NOT close the dropdown
   * For any open dropdown, pressing keys other than Escape SHALL NOT close it.
   * Validates: Requirements 1.7 (inverse case)
   */
  it('Property 3: Non-Escape keys should NOT close the dropdown', () => {
    // Generate random keys that are not Escape
    const nonEscapeKeyArbitrary = fc.constantFrom(
      'Enter', 'Tab', 'ArrowDown', 'ArrowUp', 'Space', 'a', 'b', '1', '2'
    );

    fc.assert(
      fc.property(userArbitrary, nonEscapeKeyArbitrary, (user, key) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        
        // Open the dropdown first
        fireEvent.click(trigger);
        expect(screen.getByRole('menu')).toBeInTheDocument();
        
        // Press a non-Escape key
        fireEvent.keyDown(document, { key });
        
        // Dropdown should still be open
        expect(screen.getByRole('menu')).toBeInTheDocument();
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Close behavior should work after multiple open/close cycles
   * For any user, the close behavior should work consistently across multiple cycles.
   * Validates: Requirements 1.7
   */
  it('Property 3: Close behavior should work consistently across multiple cycles', () => {
    fc.assert(
      fc.property(
        userArbitrary,
        fc.integer({ min: 1, max: 5 }),
        (user, cycles) => {
          cleanup();
          
          const Wrapper = createWrapper();
          
          render(
            <Wrapper>
              <div data-testid="outside-element">Outside</div>
              <ProfileDropdown
                user={user}
                data-testid="profile-dropdown"
              />
            </Wrapper>
          );
          
          const trigger = screen.getByTestId('profile-dropdown-trigger');
          const outsideElement = screen.getByTestId('outside-element');
          
          for (let i = 0; i < cycles; i++) {
            // Open the dropdown
            fireEvent.click(trigger);
            expect(screen.getByRole('menu')).toBeInTheDocument();
            
            // Close with outside click on even cycles, Escape on odd cycles
            if (i % 2 === 0) {
              fireEvent.mouseDown(outsideElement);
            } else {
              fireEvent.keyDown(document, { key: 'Escape' });
            }
            
            // Verify closed
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
            expect(trigger).toHaveAttribute('aria-expanded', 'false');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: auth-profile-enhancements, Property 2: Dropdown User Info Display
 * Validates: Requirements 1.2, 5.1, 5.2, 5.3
 * 
 * For any user with name, email, and optional avatar, the profile dropdown header
 * SHALL display all three pieces of information (avatar or initial fallback, 
 * display name, and email).
 */
describe('ProfileDropdown Property Tests - User Info Display', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 2: Dropdown User Info Display
   * For any user with name, email, and optional avatar, the profile dropdown header
   * SHALL display all three pieces of information.
   * Validates: Requirements 1.2, 5.1, 5.2, 5.3
   */
  it('Property 2: Dropdown header should display avatar, display name, and email', () => {
    fc.assert(
      fc.property(userArbitrary, (user) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        
        // Open the dropdown
        fireEvent.click(trigger);
        
        // Verify header exists
        const header = screen.getByTestId('profile-dropdown-header');
        expect(header).toBeInTheDocument();
        
        // Verify avatar is displayed (either image or initial fallback)
        const avatar = screen.getByTestId('profile-dropdown-avatar');
        expect(avatar).toBeInTheDocument();
        
        // Verify display name is shown (falls back to 'User' if no name)
        const displayName = screen.getByTestId('profile-dropdown-display-name');
        expect(displayName).toBeInTheDocument();
        const expectedName = user.name || 'User';
        expect(displayName.textContent).toBe(expectedName);
        
        // Verify email is displayed
        const email = screen.getByTestId('profile-dropdown-email');
        expect(email).toBeInTheDocument();
        expect(email.textContent).toBe(user.email);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: User info display with platform user data
   * When platform user data is provided, the dropdown should prefer the platform username.
   * Validates: Requirements 5.2
   */
  it('Property 2: Dropdown should prefer platform username over auth name', () => {
    fc.assert(
      fc.property(userArbitrary, platformUserArbitrary, (user, platformUser) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            platformUser={platformUser}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        
        // Open the dropdown
        fireEvent.click(trigger);
        
        // Verify display name shows platform username
        const displayName = screen.getByTestId('profile-dropdown-display-name');
        expect(displayName).toBeInTheDocument();
        expect(displayName.textContent).toBe(platformUser.username);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Avatar displays image when provided
   * When user has an image URL, the avatar should display the image.
   * Validates: Requirements 5.1
   */
  it('Property 2: Avatar should display image when user has image URL', () => {
    // Generate users that always have an image
    const userWithImageArbitrary = fc.record({
      id: fc.uuid(),
      name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
      email: fc.emailAddress(),
      image: fc.webUrl(), // Always has image
    });

    fc.assert(
      fc.property(userWithImageArbitrary, (user) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        
        // Open the dropdown
        fireEvent.click(trigger);
        
        // Verify avatar is an image element with correct src
        const avatar = screen.getByTestId('profile-dropdown-avatar');
        expect(avatar.tagName.toLowerCase()).toBe('img');
        expect(avatar).toHaveAttribute('src', user.image);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Avatar displays initial when no image
   * When user has no image URL, the avatar should display the initial.
   * Validates: Requirements 5.1
   */
  it('Property 2: Avatar should display initial when user has no image', () => {
    // Generate users that never have an image
    const userWithoutImageArbitrary = fc.record({
      id: fc.uuid(),
      name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
      email: fc.emailAddress(),
      image: fc.constant(null), // Never has image
    });

    fc.assert(
      fc.property(userWithoutImageArbitrary, (user) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        
        // Open the dropdown
        fireEvent.click(trigger);
        
        // Verify avatar is a div (initial fallback) not an img
        const avatar = screen.getByTestId('profile-dropdown-avatar');
        expect(avatar.tagName.toLowerCase()).toBe('div');
        
        // Verify it contains the correct initial (matching UserAvatar's getInitial logic)
        // Name takes priority if it has non-whitespace content, otherwise use email
        const trimmedName = user.name?.trim() || '';
        const trimmedEmail = user.email.trim();
        const expectedInitial = trimmedName.length > 0 
          ? trimmedName[0].toUpperCase() 
          : trimmedEmail.length > 0 
            ? trimmedEmail[0].toUpperCase()
            : '?';
        expect(avatar.textContent).toBe(expectedInitial);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: auth-profile-enhancements, Property 9: Sandbox Status Display
 * Validates: Requirements 5.4
 * 
 * For any user in sandbox mode (sandboxCompleted === false), the profile dropdown
 * SHALL display a sandbox status indicator. For users with sandboxCompleted === true,
 * no sandbox indicator SHALL be shown.
 */
describe('ProfileDropdown Property Tests - Sandbox Status Display', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 9: Sandbox Status Display - Show indicator for sandbox users
   * For any user in sandbox mode, the dropdown SHALL display a sandbox status indicator.
   * Validates: Requirements 5.4
   */
  it('Property 9: Sandbox status indicator should be shown for users in sandbox mode', () => {
    // Generate platform users that are in sandbox mode
    const sandboxUserArbitrary = fc.record({
      id: fc.uuid(),
      username: fc.string({ minLength: 3, maxLength: 30 }),
      reputationScore: fc.integer({ min: -1000, max: 1000 }),
      sandboxCompleted: fc.constant(false), // Always in sandbox
      debatesParticipated: fc.integer({ min: 0, max: 4 }), // Less than 5
    });

    fc.assert(
      fc.property(userArbitrary, sandboxUserArbitrary, (user, platformUser) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            platformUser={platformUser}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        
        // Open the dropdown
        fireEvent.click(trigger);
        
        // Verify sandbox status indicator is shown
        const sandboxStatus = screen.getByTestId('profile-dropdown-sandbox-status');
        expect(sandboxStatus).toBeInTheDocument();
        
        // Verify it contains "Sandbox Mode" text
        expect(sandboxStatus.textContent).toContain('Sandbox Mode');
        
        // Verify debates progress is shown
        const sandboxProgress = screen.getByTestId('profile-dropdown-sandbox-progress');
        expect(sandboxProgress).toBeInTheDocument();
        expect(sandboxProgress.textContent).toBe(`${platformUser.debatesParticipated}/5 debates`);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9: Sandbox Status Display - Hide indicator for completed users
   * For any user with sandboxCompleted === true, no sandbox indicator SHALL be shown.
   * Validates: Requirements 5.4
   */
  it('Property 9: Sandbox status indicator should NOT be shown for users who completed sandbox', () => {
    // Generate platform users that have completed sandbox
    const completedUserArbitrary = fc.record({
      id: fc.uuid(),
      username: fc.string({ minLength: 3, maxLength: 30 }),
      reputationScore: fc.integer({ min: -1000, max: 1000 }),
      sandboxCompleted: fc.constant(true), // Completed sandbox
      debatesParticipated: fc.integer({ min: 5, max: 100 }), // 5 or more
    });

    fc.assert(
      fc.property(userArbitrary, completedUserArbitrary, (user, platformUser) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            platformUser={platformUser}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        
        // Open the dropdown
        fireEvent.click(trigger);
        
        // Verify sandbox status indicator is NOT shown
        expect(screen.queryByTestId('profile-dropdown-sandbox-status')).not.toBeInTheDocument();
        expect(screen.queryByTestId('profile-dropdown-sandbox-progress')).not.toBeInTheDocument();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9: Sandbox Status Display - No indicator without platform user
   * When no platform user data is provided, no sandbox indicator should be shown.
   * Validates: Requirements 5.4
   */
  it('Property 9: Sandbox status indicator should NOT be shown without platform user data', () => {
    fc.assert(
      fc.property(userArbitrary, (user) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            platformUser={undefined}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        
        // Open the dropdown
        fireEvent.click(trigger);
        
        // Verify sandbox status indicator is NOT shown
        expect(screen.queryByTestId('profile-dropdown-sandbox-status')).not.toBeInTheDocument();
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: auth-profile-enhancements, Property 10: Reputation Score Display
 * Validates: Requirements 5.5
 * 
 * For any user with a reputation score, the profile dropdown SHALL display the score value.
 */
describe('ProfileDropdown Property Tests - Reputation Score Display', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 10: Reputation Score Display
   * For any user with a reputation score, the dropdown SHALL display the score value.
   * Validates: Requirements 5.5
   */
  it('Property 10: Reputation score should be displayed for platform users', () => {
    fc.assert(
      fc.property(userArbitrary, platformUserArbitrary, (user, platformUser) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            platformUser={platformUser}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        
        // Open the dropdown
        fireEvent.click(trigger);
        
        // Verify reputation section is shown
        const reputationSection = screen.getByTestId('profile-dropdown-reputation');
        expect(reputationSection).toBeInTheDocument();
        expect(reputationSection.textContent).toContain('Reputation:');
        
        // Verify reputation score is displayed
        const reputationScore = screen.getByTestId('profile-dropdown-reputation-score');
        expect(reputationScore).toBeInTheDocument();
        
        // Verify the score is formatted correctly
        const rounded = Math.round(platformUser.reputationScore);
        const expectedScore = rounded > 0 ? `+${rounded}` : String(rounded);
        expect(reputationScore.textContent).toBe(expectedScore);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10: Reputation Score Display - Positive scores have + prefix
   * For any positive reputation score, the display SHALL include a + prefix.
   * Validates: Requirements 5.5
   */
  it('Property 10: Positive reputation scores should have + prefix', () => {
    // Generate platform users with positive reputation
    const positiveReputationUserArbitrary = fc.record({
      id: fc.uuid(),
      username: fc.string({ minLength: 3, maxLength: 30 }),
      reputationScore: fc.integer({ min: 1, max: 1000 }), // Always positive
      sandboxCompleted: fc.boolean(),
      debatesParticipated: fc.integer({ min: 0, max: 100 }),
    });

    fc.assert(
      fc.property(userArbitrary, positiveReputationUserArbitrary, (user, platformUser) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            platformUser={platformUser}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        
        // Open the dropdown
        fireEvent.click(trigger);
        
        // Verify reputation score starts with +
        const reputationScore = screen.getByTestId('profile-dropdown-reputation-score');
        expect(reputationScore.textContent).toMatch(/^\+\d+$/);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10: Reputation Score Display - Negative scores have no prefix
   * For any negative reputation score, the display SHALL show the negative sign.
   * Validates: Requirements 5.5
   */
  it('Property 10: Negative reputation scores should show negative sign', () => {
    // Generate platform users with negative reputation
    const negativeReputationUserArbitrary = fc.record({
      id: fc.uuid(),
      username: fc.string({ minLength: 3, maxLength: 30 }),
      reputationScore: fc.integer({ min: -1000, max: -1 }), // Always negative
      sandboxCompleted: fc.boolean(),
      debatesParticipated: fc.integer({ min: 0, max: 100 }),
    });

    fc.assert(
      fc.property(userArbitrary, negativeReputationUserArbitrary, (user, platformUser) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            platformUser={platformUser}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        
        // Open the dropdown
        fireEvent.click(trigger);
        
        // Verify reputation score starts with -
        const reputationScore = screen.getByTestId('profile-dropdown-reputation-score');
        expect(reputationScore.textContent).toMatch(/^-\d+$/);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10: Reputation Score Display - Zero score
   * For a zero reputation score, the display SHALL show "0".
   * Validates: Requirements 5.5
   */
  it('Property 10: Zero reputation score should display as 0', () => {
    // Generate platform users with zero reputation
    const zeroReputationUserArbitrary = fc.record({
      id: fc.uuid(),
      username: fc.string({ minLength: 3, maxLength: 30 }),
      reputationScore: fc.constant(0), // Always zero
      sandboxCompleted: fc.boolean(),
      debatesParticipated: fc.integer({ min: 0, max: 100 }),
    });

    fc.assert(
      fc.property(userArbitrary, zeroReputationUserArbitrary, (user, platformUser) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            platformUser={platformUser}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        
        // Open the dropdown
        fireEvent.click(trigger);
        
        // Verify reputation score is "0"
        const reputationScore = screen.getByTestId('profile-dropdown-reputation-score');
        expect(reputationScore.textContent).toBe('0');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10: Reputation Score Display - No display without platform user
   * When no platform user data is provided, no reputation should be shown.
   * Validates: Requirements 5.5
   */
  it('Property 10: Reputation score should NOT be shown without platform user data', () => {
    fc.assert(
      fc.property(userArbitrary, (user) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            platformUser={undefined}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        
        // Open the dropdown
        fireEvent.click(trigger);
        
        // Verify reputation section is NOT shown
        expect(screen.queryByTestId('profile-dropdown-reputation')).not.toBeInTheDocument();
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: auth-profile-enhancements, Property 5: Responsive Trigger Display
 * Validates: Requirements 1.9, 4.1, 4.2
 * 
 * For any viewport width:
 * - Below 640px (mobile): trigger SHALL show only avatar
 * - 640px and above (tablet/desktop): trigger SHALL show avatar AND user name (when showName=true)
 */
describe('ProfileDropdown Property Tests - Responsive Trigger Display', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 5: Responsive Trigger Display - Name hidden on mobile
   * For any user with showName=true, the name element should have 'hidden sm:inline' classes
   * which hides it on mobile (<640px) and shows it on tablet/desktop (≥640px).
   * Validates: Requirements 1.9, 4.1, 4.2
   */
  it('Property 5: Trigger name element should have responsive classes (hidden sm:inline)', () => {
    // Generate users that always have a non-whitespace name (so the name element is rendered)
    const userWithNameArbitrary = fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // Non-whitespace name
      email: fc.emailAddress(),
      image: fc.option(fc.webUrl(), { nil: null }),
    });

    fc.assert(
      fc.property(userWithNameArbitrary, (user) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            showName={true}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        // Find the name element in the trigger (testid is ${testId}-name)
        const nameElement = screen.getByTestId('profile-dropdown-name');
        expect(nameElement).toBeInTheDocument();
        
        // Verify it has the responsive classes
        expect(nameElement).toHaveClass('hidden');
        expect(nameElement).toHaveClass('sm:inline');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Responsive Trigger Display - Name not rendered when showName=false
   * For any user with showName=false, the name element should not be rendered at all.
   * Validates: Requirements 1.9, 4.1, 4.2
   */
  it('Property 5: Trigger should not show name element when showName=false', () => {
    // Generate users that always have a non-whitespace name
    const userWithNameArbitrary = fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // Non-whitespace name
      email: fc.emailAddress(),
      image: fc.option(fc.webUrl(), { nil: null }),
    });

    fc.assert(
      fc.property(userWithNameArbitrary, (user) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            showName={false}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        // Name element should not be rendered
        expect(screen.queryByTestId('profile-dropdown-name')).not.toBeInTheDocument();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Responsive Trigger Display - Name not rendered when user has no name
   * For any user without a name, the name element should not be rendered even with showName=true.
   * Validates: Requirements 1.9, 4.1, 4.2
   */
  it('Property 5: Trigger should not show name element when user has no name', () => {
    // Generate users that never have a name
    const userWithoutNameArbitrary = fc.record({
      id: fc.uuid(),
      name: fc.constant(null), // Never has name
      email: fc.emailAddress(),
      image: fc.option(fc.webUrl(), { nil: null }),
    });

    fc.assert(
      fc.property(userWithoutNameArbitrary, (user) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            showName={true}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        // Name element should not be rendered
        expect(screen.queryByTestId('profile-dropdown-name')).not.toBeInTheDocument();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Responsive Trigger Display - Avatar always visible
   * For any user and any showName setting, the avatar should always be visible in the trigger.
   * Validates: Requirements 1.9, 4.1, 4.2
   */
  it('Property 5: Avatar should always be visible in trigger regardless of showName', () => {
    fc.assert(
      fc.property(userArbitrary, fc.boolean(), (user, showName) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            showName={showName}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        // Trigger should always contain an avatar
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        expect(trigger).toBeInTheDocument();
        
        // Avatar should be visible (either img or div with initial)
        const avatar = trigger.querySelector('[data-testid]') || trigger.querySelector('img') || trigger.querySelector('div');
        expect(avatar).toBeInTheDocument();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Responsive Trigger Display - Name displays correct text
   * For any user with a non-whitespace name and showName=true, the name element should display the user's name.
   * Validates: Requirements 1.9, 4.1, 4.2
   */
  it('Property 5: Name element should display the correct user name', () => {
    // Generate users that always have a non-whitespace name
    const userWithNameArbitrary = fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // Non-whitespace name
      email: fc.emailAddress(),
      image: fc.option(fc.webUrl(), { nil: null }),
    });

    fc.assert(
      fc.property(userWithNameArbitrary, (user) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            showName={true}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        // Find the name element (testid is ${testId}-name)
        const nameElement = screen.getByTestId('profile-dropdown-name');
        expect(nameElement).toBeInTheDocument();
        
        // Verify it displays the correct name
        expect(nameElement.textContent).toBe(user.name);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: auth-profile-enhancements, Property 4: Touch Target Minimum Size
 * Validates: Requirements 1.8, 4.4
 * 
 * For any interactive element in the profile dropdown (trigger, menu items, sign out button),
 * the element SHALL have a minimum height of 44px for accessibility.
 */
describe('ProfileDropdown Property Tests - Touch Target Minimum Size', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 4: Touch Target Minimum Size - Trigger button
   * For any user, the trigger button SHALL have min-h-[44px] and min-w-[44px] classes.
   * Validates: Requirements 1.8, 4.4
   */
  it('Property 4: Trigger button should have minimum 44px height and width classes', () => {
    fc.assert(
      fc.property(userArbitrary, (user) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        expect(trigger).toBeInTheDocument();
        
        // Verify trigger has minimum height and width classes
        expect(trigger).toHaveClass('min-h-[44px]');
        expect(trigger).toHaveClass('min-w-[44px]');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Touch Target Minimum Size - View Profile menu item
   * For any user, the View Profile menu item SHALL have min-h-[44px] class.
   * Validates: Requirements 1.8, 4.4
   */
  it('Property 4: View Profile menu item should have minimum 44px height class', () => {
    fc.assert(
      fc.property(userArbitrary, (user) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        // Open the dropdown
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        fireEvent.click(trigger);
        
        // Verify View Profile menu item has minimum height class
        const viewProfileItem = screen.getByTestId('profile-dropdown-view-profile');
        expect(viewProfileItem).toBeInTheDocument();
        expect(viewProfileItem).toHaveClass('min-h-[44px]');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Touch Target Minimum Size - My Debates menu item
   * For any user, the My Debates menu item SHALL have min-h-[44px] class.
   * Validates: Requirements 1.8, 4.4
   */
  it('Property 4: My Debates menu item should have minimum 44px height class', () => {
    fc.assert(
      fc.property(userArbitrary, (user) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        // Open the dropdown
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        fireEvent.click(trigger);
        
        // Verify My Debates menu item has minimum height class
        const myDebatesItem = screen.getByTestId('profile-dropdown-my-debates');
        expect(myDebatesItem).toBeInTheDocument();
        expect(myDebatesItem).toHaveClass('min-h-[44px]');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Touch Target Minimum Size - Sign Out button
   * For any user, the Sign Out button SHALL have min-h-[44px] class.
   * Validates: Requirements 1.8, 4.4
   */
  it('Property 4: Sign Out button should have minimum 44px height class', () => {
    fc.assert(
      fc.property(userArbitrary, (user) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        // Open the dropdown
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        fireEvent.click(trigger);
        
        // Verify Sign Out button has minimum height class
        const signOutButton = screen.getByTestId('profile-dropdown-sign-out');
        expect(signOutButton).toBeInTheDocument();
        expect(signOutButton).toHaveClass('min-h-[44px]');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Touch Target Minimum Size - All interactive elements
   * For any user, all interactive elements in the dropdown SHALL have min-h-[44px] class.
   * Validates: Requirements 1.8, 4.4
   */
  it('Property 4: All interactive elements should have minimum 44px height class', () => {
    fc.assert(
      fc.property(userArbitrary, (user) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        // Verify trigger
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        expect(trigger).toHaveClass('min-h-[44px]');
        
        // Open the dropdown
        fireEvent.click(trigger);
        
        // Verify all menu items
        const viewProfileItem = screen.getByTestId('profile-dropdown-view-profile');
        const myDebatesItem = screen.getByTestId('profile-dropdown-my-debates');
        const signOutButton = screen.getByTestId('profile-dropdown-sign-out');
        
        expect(viewProfileItem).toHaveClass('min-h-[44px]');
        expect(myDebatesItem).toHaveClass('min-h-[44px]');
        expect(signOutButton).toHaveClass('min-h-[44px]');
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: auth-profile-enhancements, Property 8: Dropdown Menu Viewport Bounds
 * Validates: Requirements 4.3
 * 
 * For any dropdown menu position, the menu SHALL remain fully visible within the viewport bounds
 * (no overflow outside visible area).
 * 
 * Note: In JSDOM, we cannot fully test viewport positioning since there's no real viewport.
 * These tests verify that the menu has the necessary positioning styles applied.
 */
describe('ProfileDropdown Property Tests - Viewport Bounds', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 8: Dropdown Menu Viewport Bounds - Menu has position absolute
   * For any user, the dropdown menu SHALL have position: absolute for proper positioning.
   * Validates: Requirements 4.3
   */
  it('Property 8: Dropdown menu should have absolute positioning', () => {
    fc.assert(
      fc.property(userArbitrary, (user) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        // Open the dropdown
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        fireEvent.click(trigger);
        
        // Verify menu has position absolute
        const menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();
        
        // Check that the menu has position: absolute in its style
        const computedStyle = window.getComputedStyle(menu);
        expect(computedStyle.position).toBe('absolute');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8: Dropdown Menu Viewport Bounds - Menu has z-index for layering
   * For any user, the dropdown menu SHALL have a z-index to ensure it appears above other content.
   * Validates: Requirements 4.3
   */
  it('Property 8: Dropdown menu should have z-index for proper layering', () => {
    fc.assert(
      fc.property(userArbitrary, (user) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        // Open the dropdown
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        fireEvent.click(trigger);
        
        // Verify menu has z-index class
        const menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();
        expect(menu).toHaveClass('z-dropdown');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8: Dropdown Menu Viewport Bounds - Container has relative positioning
   * For any user, the dropdown container SHALL have position: relative for proper menu positioning.
   * Validates: Requirements 4.3
   */
  it('Property 8: Dropdown container should have relative positioning', () => {
    fc.assert(
      fc.property(userArbitrary, (user) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        // Verify container has relative class
        const container = screen.getByTestId('profile-dropdown');
        expect(container).toBeInTheDocument();
        expect(container).toHaveClass('relative');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8: Dropdown Menu Viewport Bounds - Menu has minimum width
   * For any user, the dropdown menu SHALL have a minimum width for proper content display.
   * Validates: Requirements 4.3
   */
  it('Property 8: Dropdown menu should have minimum width', () => {
    fc.assert(
      fc.property(userArbitrary, (user) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        // Open the dropdown
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        fireEvent.click(trigger);
        
        // Verify menu has minimum width class
        const menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();
        expect(menu).toHaveClass('min-w-[240px]');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8: Dropdown Menu Viewport Bounds - Menu is rendered within container
   * For any user, the dropdown menu SHALL be rendered as a child of the container.
   * Validates: Requirements 4.3
   */
  it('Property 8: Dropdown menu should be rendered within container', () => {
    fc.assert(
      fc.property(userArbitrary, (user) => {
        cleanup();
        
        render(
          <ProfileDropdown
            user={user}
            data-testid="profile-dropdown"
          />,
          { wrapper: createWrapper() }
        );
        
        // Open the dropdown
        const trigger = screen.getByTestId('profile-dropdown-trigger');
        fireEvent.click(trigger);
        
        // Verify menu is within container
        const container = screen.getByTestId('profile-dropdown');
        const menu = screen.getByRole('menu');
        expect(container.contains(menu)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
