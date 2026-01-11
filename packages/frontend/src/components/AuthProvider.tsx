import React from 'react';
import { NeonAuthUIProvider } from '@neondatabase/neon-js/auth/react/ui';
import { authClient } from '../auth';

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Username validation function
 * Requirements: 2.2 - Validate minimum 3 characters, alphanumeric + underscore only
 * 
 * @param value - The username to validate
 * @returns string error message if invalid, true if valid
 */
export function validateUsername(value: string): string | true {
  if (!value || value.length < 3) {
    return 'Username must be at least 3 characters';
  }
  if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    return 'Username can only contain letters, numbers, and underscores';
  }
  return true;
}

/**
 * Async username validation for the auth provider
 * Wraps validateUsername to match the expected Promise<boolean> signature
 */
async function validateUsernameAsync(value: string): Promise<boolean> {
  const result = validateUsername(value);
  return result === true;
}

/**
 * Additional fields configuration for sign-up
 * Requirements: 2.1 - Collect username during sign-up
 * Requirements: 2.2 - Validate username format
 */
const additionalFields = {
  username: {
    label: 'Username',
    placeholder: 'Choose a username',
    type: 'string' as const,
    required: true,
    validate: validateUsernameAsync,
  },
};

/**
 * AuthProvider wraps the application with Neon Auth context
 * Provides authentication state and methods to all child components
 * 
 * Enables Google OAuth for social sign-in
 * Configures username field for sign-up (Requirements: 2.1)
 */
export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <NeonAuthUIProvider 
      authClient={authClient}
      social={{
        providers: ['google'],
      }}
      localization={{
        SIGN_IN: 'Sign in',
        SIGN_UP: 'Create account',
      }}
      additionalFields={additionalFields}
      signUp={{
        fields: ['name', 'username'],
      }}
    >
      {children}
    </NeonAuthUIProvider>
  );
}

export default AuthProvider;
