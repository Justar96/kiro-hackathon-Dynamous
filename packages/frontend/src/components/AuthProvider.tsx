import React from 'react';
import { NeonAuthUIProvider } from '@neondatabase/neon-js/auth/react/ui';
import { authClient } from '../auth';

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * AuthProvider wraps the application with Neon Auth context
 * Provides authentication state and methods to all child components
 */
export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <NeonAuthUIProvider authClient={authClient}>
      {children}
    </NeonAuthUIProvider>
  );
}

export default AuthProvider;
