/**
 * Auth Hooks Index
 * 
 * Authentication-related hooks including session management,
 * sign-up callbacks, and username checking.
 */

// Session management
export {
  useSession,
  useUser,
  useSignOut,
  useSessionWatcher,
  hadActiveSession,
} from './useSession';

// Sign-up callback
export { useSignUpCallback } from './useSignUpCallback';

// Username availability check
export { useUsernameCheck } from './useUsernameCheck';
