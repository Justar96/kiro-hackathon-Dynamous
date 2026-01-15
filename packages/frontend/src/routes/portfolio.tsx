/**
 * Portfolio Page
 *
 * Displays user's positions and open orders with on-chain integration.
 * Uses usePositions and useOpenOrders hooks for data fetching.
 *
 * Requirements: 7.1, 7.4, 7.5
 */

import { createFileRoute } from '@tanstack/react-router';
import { useAccount } from 'wagmi';
import { PortfolioView } from '../components/market';
import { useWalletConnection } from '../lib/hooks/web3/useWalletConnection';
import { SpinnerIcon } from '../components';

export const Route = createFileRoute('/portfolio')({
  component: PortfolioPage,
});

function PortfolioPage() {
  const { isConnected, isConnecting } = useAccount();
  const { connect, connectors } = useWalletConnection();

  // Handle wallet connection
  const handleConnect = async () => {
    const injectedConnector = connectors.find(c => c.id === 'injected');
    if (injectedConnector) {
      try {
        await connect(injectedConnector);
      } catch (error) {
        console.error('Failed to connect wallet:', error);
      }
    }
  };

  // Connecting state
  if (isConnecting) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <SpinnerIcon className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Connecting wallet...</span>
        </div>
      </div>
    );
  }

  // Not connected state
  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">My Portfolio</h1>
        <div className="text-center py-12 border border-gray-200 rounded-lg">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect Your Wallet</h2>
          <p className="text-gray-500 mb-6">Connect your wallet to view your positions and open orders</p>
          <button
            onClick={handleConnect}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">My Portfolio</h1>
      <PortfolioView />
    </div>
  );
}
