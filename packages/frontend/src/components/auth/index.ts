// Auth Components - Barrel Export
// Provides authentication-related components and hooks

// AuthProvider - Wraps app with Neon Auth context
export { AuthProvider, validateUsername } from './AuthProvider';

// AuthModal - Modal for sign-in/sign-up flows
export { 
  AuthModalProvider, 
  useAuthModal, 
  useRequireAuth,
  AuthModalContext,
} from './AuthModal';

// ProfileDropdown - User profile dropdown menu
export { ProfileDropdown } from './ProfileDropdown';
export type { 
  ProfileDropdownProps, 
  ProfileDropdownUser,
  PlatformUser,
} from './ProfileDropdown';

// UserAvatar - User avatar with image or initial fallback
export { UserAvatar } from './UserAvatar';
export type { UserAvatarProps } from './UserAvatar';

// OnboardingToast - Welcome toast for new users
export { 
  OnboardingToast, 
  useOnboardingToast, 
  useAutoOnboarding,
} from './OnboardingToast';
