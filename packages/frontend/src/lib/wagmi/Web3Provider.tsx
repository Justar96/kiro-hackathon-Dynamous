/**
 * Web3Provider component
 * Wraps the application with WagmiProvider for blockchain interactions
 */

import { WagmiProvider } from 'wagmi';
import type { ReactNode } from 'react';
import { wagmiConfig } from './config';

interface Web3ProviderProps {
  children: ReactNode;
}

/**
 * Provider component that enables wagmi hooks throughout the app
 */
export function Web3Provider({ children }: Web3ProviderProps) {
  return <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>;
}
