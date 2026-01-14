/**
 * ProfileDropdown component - custom dropdown menu for user profile
 * Replaces the default Neon Auth UserButton with platform-styled dropdown
 * 
 * Requirements: 1.1 - Display dropdown menu when clicking avatar
 * Requirements: 1.2 - Display user's avatar, display name, and email
 * Requirements: 1.3 - Include "View Profile" link
 * Requirements: 1.4 - Include "My Debates" link
 * Requirements: 1.5 - Include "Sign Out" action
 * Requirements: 1.7 - Close dropdown on click outside or Escape key
 * Requirements: 5.1, 5.2, 5.3 - Display user info in header
 * Requirements: 5.4 - Show sandbox status indicator
 * Requirements: 5.5 - Show reputation score
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { UserAvatar } from './UserAvatar';
import { useSignOut } from '../../lib/useSession';
import { useToast } from '../common/Toast';
import { ChevronDownIcon, UserIcon, ChatIcon, SignOutIcon } from '../icons';

// ============================================================================
// Types
// ============================================================================

export interface ProfileDropdownUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export interface PlatformUser {
  id: string;
  username: string;
  reputationScore: number;
  sandboxCompleted: boolean;
  debatesParticipated: number;
}

export interface ProfileDropdownProps {
  /** User data from auth session */
  user: ProfileDropdownUser;
  /** Platform user data (optional, for additional info) */
  platformUser?: PlatformUser | null;
  /** Whether to show user name alongside avatar (desktop) */
  showName?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  'data-testid'?: string;
}

// ============================================================================
// ProfileDropdownTrigger
// ============================================================================

interface ProfileDropdownTriggerProps {
  user: ProfileDropdownUser;
  isOpen: boolean;
  onClick: () => void;
  /** 
   * Whether to show user name alongside avatar on larger screens
   * When true: shows avatar only on mobile (<640px), avatar + name on tablet/desktop (≥640px)
   * When false: always shows only avatar
   * Requirements: 1.9, 4.1, 4.2
   */
  showName?: boolean;
  /** Ref for the trigger button (used for viewport positioning) */
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
  'data-testid'?: string;
}

/**
 * ProfileDropdownTrigger - clickable trigger for the dropdown
 * 
 * Responsive behavior (Requirements: 1.9, 4.1, 4.2):
 * - Mobile (<640px): Shows only avatar
 * - Tablet/Desktop (≥640px): Shows avatar + user name (when showName=true)
 * 
 * Touch target (Requirements: 1.8, 4.4):
 * - Minimum 44px height for accessibility
 */
function ProfileDropdownTrigger({
  user,
  isOpen,
  onClick,
  showName = false,
  triggerRef,
  'data-testid': testId,
}: ProfileDropdownTriggerProps) {
  return (
    <button
      ref={triggerRef as React.RefObject<HTMLButtonElement>}
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 min-h-[44px] min-w-[44px] px-2 py-1 rounded-small border border-hairline bg-paper hover:bg-page-bg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      aria-expanded={isOpen}
      aria-haspopup="menu"
      data-testid={testId ? `${testId}-trigger` : undefined}
    >
      <UserAvatar
        src={user.image}
        name={user.name}
        email={user.email}
        size="sm"
      />
      {/* 
        Responsive name display - Requirements: 1.9, 4.1, 4.2
        - Hidden on mobile (<640px) via 'hidden sm:inline'
        - Visible on tablet/desktop (≥640px) when showName is true
      */}
      {showName && user.name && (
        <span 
          className="text-body-small text-text-primary font-medium hidden sm:inline"
          data-testid={testId ? `${testId}-name` : undefined}
        >
          {user.name}
        </span>
      )}
      <ChevronDownIcon
        size="sm"
        className={`text-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        decorative
      />
    </button>
  );
}

// ============================================================================
// ProfileDropdownMenu
// ============================================================================

interface ProfileDropdownMenuProps {
  user: ProfileDropdownUser;
  platformUser?: PlatformUser | null;
  onClose: () => void;
  onSignOut: () => void;
  /** Reference to the trigger element for positioning calculations */
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
  'data-testid'?: string;
}

/**
 * Format reputation score for display
 * Shows whole numbers, with + prefix for positive scores
 */
function formatReputationScore(score: number): string {
  const rounded = Math.round(score);
  if (rounded > 0) return `+${rounded}`;
  return String(rounded);
}

/**
 * Calculate menu position to stay within viewport bounds
 * Requirements: 4.3 - Dropdown menu SHALL remain fully visible within viewport bounds
 */
interface MenuPosition {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
}

function useViewportAwarePosition(
  menuRef: React.RefObject<HTMLDivElement | null>,
  triggerRef: React.RefObject<HTMLButtonElement | null> | undefined,
  isOpen: boolean
): MenuPosition {
  const [position, setPosition] = useState<MenuPosition>({ right: '0', top: '100%' });

  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const calculatePosition = () => {
      const menu = menuRef.current;
      if (!menu) return;

      const menuRect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      const newPosition: MenuPosition = { right: '0' };
      
      // Check if menu overflows bottom of viewport
      if (menuRect.bottom > viewportHeight) {
        // Position above the trigger instead
        newPosition.bottom = '100%';
        newPosition.top = undefined;
      } else {
        newPosition.top = '100%';
        newPosition.bottom = undefined;
      }
      
      // Check if menu overflows right side of viewport
      if (menuRect.right > viewportWidth) {
        newPosition.right = '0';
        newPosition.left = undefined;
      }
      
      // Check if menu overflows left side of viewport
      if (menuRect.left < 0) {
        newPosition.left = '0';
        newPosition.right = undefined;
      }
      
      setPosition(newPosition);
    };

    // Calculate position after render
    requestAnimationFrame(calculatePosition);
    
    // Recalculate on resize
    window.addEventListener('resize', calculatePosition);
    
    return () => {
      window.removeEventListener('resize', calculatePosition);
    };
  }, [isOpen, menuRef, triggerRef]);

  return position;
}

function ProfileDropdownMenu({
  user,
  platformUser,
  onClose,
  onSignOut,
  triggerRef,
  'data-testid': testId,
}: ProfileDropdownMenuProps) {
  // Get display name - prefer platform username, fall back to auth name
  const displayName = platformUser?.username || user.name || 'User';
  const menuRef = useRef<HTMLDivElement>(null);
  const position = useViewportAwarePosition(menuRef, triggerRef, true);
  
  // Build position style
  const positionStyle: React.CSSProperties = {
    position: 'absolute',
    marginTop: position.top ? '0.25rem' : undefined,
    marginBottom: position.bottom ? '0.25rem' : undefined,
  };
  
  if (position.top) positionStyle.top = position.top;
  if (position.bottom) positionStyle.bottom = position.bottom;
  if (position.left !== undefined) positionStyle.left = position.left;
  if (position.right !== undefined) positionStyle.right = position.right;
  
  return (
    <div
      ref={menuRef}
      role="menu"
      className="min-w-[240px] bg-paper rounded-small border border-hairline shadow-elevated py-2 z-dropdown"
      style={positionStyle}
      data-testid={testId ? `${testId}-menu` : undefined}
    >
      {/* User Header - Requirements: 1.2, 5.1, 5.2, 5.3 */}
      <div 
        className="px-4 py-3 border-b border-hairline"
        data-testid={testId ? `${testId}-header` : undefined}
      >
        <div className="flex items-center gap-3">
          <UserAvatar
            src={user.image}
            name={user.name}
            email={user.email}
            size="md"
            data-testid={testId ? `${testId}-avatar` : undefined}
          />
          <div className="min-w-0 flex-1">
            <p 
              className="text-body-small font-medium text-text-primary truncate"
              data-testid={testId ? `${testId}-display-name` : undefined}
            >
              {displayName}
            </p>
            <p 
              className="text-caption text-text-secondary truncate"
              data-testid={testId ? `${testId}-email` : undefined}
            >
              {user.email}
            </p>
          </div>
        </div>
        
        {/* Reputation Score - Requirements: 5.5 */}
        {platformUser && (
          <div 
            className="mt-2 flex items-center gap-2"
            data-testid={testId ? `${testId}-reputation` : undefined}
          >
            <span className="text-caption text-text-secondary">Reputation:</span>
            <span 
              className={`text-caption font-medium ${
                platformUser.reputationScore >= 0 ? 'text-support' : 'text-oppose'
              }`}
              data-testid={testId ? `${testId}-reputation-score` : undefined}
            >
              {formatReputationScore(platformUser.reputationScore)}
            </span>
          </div>
        )}
        
        {/* Sandbox Status - Requirements: 5.4 */}
        {platformUser && !platformUser.sandboxCompleted && (
          <div 
            className="mt-2 flex items-center gap-2"
            data-testid={testId ? `${testId}-sandbox-status` : undefined}
          >
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
              Sandbox Mode
            </span>
            <span 
              className="text-caption text-text-secondary"
              data-testid={testId ? `${testId}-sandbox-progress` : undefined}
            >
              {platformUser.debatesParticipated}/5 debates
            </span>
          </div>
        )}
      </div>

      {/* Navigation Menu Items - Requirements: 1.3, 1.4 */}
      <div className="py-1">
        <Link
          to="/users/$userId"
          params={{ userId: platformUser?.id || user.id }}
          onClick={onClose}
          role="menuitem"
          className="flex items-center gap-3 px-4 py-2.5 text-body-small text-text-primary hover:bg-page-bg transition-colors min-h-[44px]"
          data-testid={testId ? `${testId}-view-profile` : undefined}
        >
          <UserIcon size="md" className="text-text-secondary" decorative />
          View Profile
        </Link>
        
        <Link
          to="/"
          search={{ filter: 'my-debates' }}
          onClick={onClose}
          role="menuitem"
          className="flex items-center gap-3 px-4 py-2.5 text-body-small text-text-primary hover:bg-page-bg transition-colors min-h-[44px]"
          data-testid={testId ? `${testId}-my-debates` : undefined}
        >
          <ChatIcon size="md" className="text-text-secondary" decorative />
          My Debates
        </Link>
      </div>

      {/* Sign Out - Requirements: 1.5 */}
      <div className="border-t border-hairline pt-1">
        <button
          type="button"
          onClick={onSignOut}
          role="menuitem"
          className="flex items-center gap-3 w-full px-4 py-2.5 text-body-small text-oppose hover:bg-oppose/5 transition-colors min-h-[44px]"
          data-testid={testId ? `${testId}-sign-out` : undefined}
        >
          <SignOutIcon size="md" decorative />
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// ProfileDropdown
// ============================================================================

/**
 * ProfileDropdown displays a clickable avatar that opens a dropdown menu
 * with user information and navigation options
 * 
 * Requirements: 1.7 - Close on click outside or Escape key
 */
export function ProfileDropdown({
  user,
  platformUser,
  showName = true,
  className = '',
  'data-testid': testId,
}: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { signOut } = useSignOut();
  const { showToast } = useToast();

  const toggleDropdown = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Handle sign out with toast confirmation - Requirements: 1.5
  const handleSignOut = useCallback(async () => {
    closeDropdown();
    try {
      await signOut();
      showToast({
        type: 'success',
        message: 'You have been signed out successfully.',
      });
    } catch {
      showToast({
        type: 'error',
        message: 'Failed to sign out. Please try again.',
      });
    }
  }, [signOut, showToast, closeDropdown]);

  // Handle click outside to close dropdown
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closeDropdown();
      }
    }

    // Use mousedown for immediate response
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, closeDropdown]);

  // Handle Escape key to close dropdown
  useEffect(() => {
    if (!isOpen) return;

    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeDropdown();
      }
    }

    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, closeDropdown]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      data-testid={testId}
    >
      <ProfileDropdownTrigger
        user={user}
        isOpen={isOpen}
        onClick={toggleDropdown}
        showName={showName}
        triggerRef={triggerRef}
        data-testid={testId}
      />

      {isOpen && (
        <ProfileDropdownMenu
          user={user}
          platformUser={platformUser}
          onClose={closeDropdown}
          onSignOut={handleSignOut}
          triggerRef={triggerRef}
          data-testid={testId}
        />
      )}
    </div>
  );
}

export default ProfileDropdown;
