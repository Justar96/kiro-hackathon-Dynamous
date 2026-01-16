/**
 * Portfolio Page
 *
 * Displays user's positions and trading history.
 * Paper dossier aesthetic with consistent styling.
 */

import { createFileRoute, Link } from '@tanstack/react-router';
import { useAccount } from 'wagmi';
import { motion } from 'motion/react';
import { useWalletConnection } from '../lib/hooks/web3/useWalletConnection';
import { SpinnerIcon } from '../components';

export const Route = createFileRoute('/portfolio')({
  component: PortfolioPage,
});

// Mock positions data
const MOCK_POSITIONS = [
  { id: '1', question: 'Will Bitcoin exceed $100,000 by end of 2026?', outcome: 'Yes', shares: 150, avgPrice: 0.68, currentPrice: 0.72, marketId: 'mock-1' },
  { id: '2', question: 'Will AI replace 50% of coding jobs within 5 years?', outcome: 'No', shares: 200, avgPrice: 0.62, currentPrice: 0.66, marketId: 'mock-2' },
  { id: '3', question: 'Will SpaceX land humans on Mars before 2030?', outcome: 'Yes', shares: 75, avgPrice: 0.25, currentPrice: 0.28, marketId: 'mock-4' },
];

const MOCK_HISTORY = [
  { id: '1', action: 'Buy', question: 'Will Bitcoin exceed $100,000?', outcome: 'Yes', shares: 50, price: 0.70, time: '2 hours ago' },
  { id: '2', action: 'Sell', question: 'Will the US enter a recession?', outcome: 'No', shares: 100, price: 0.58, time: '1 day ago' },
  { id: '3', action: 'Buy', question: 'Will AI replace 50% of coding jobs?', outcome: 'No', shares: 200, price: 0.62, time: '3 days ago' },
];

function PortfolioPage() {
  const { isConnected, isConnecting } = useAccount();
  const { connect, connectors } = useWalletConnection();

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
      <div className="min-h-screen bg-page-bg flex items-center justify-center">
        <SpinnerIcon className="w-8 h-8 animate-spin text-accent" />
        <span className="ml-2 text-text-secondary">Connecting wallet...</span>
      </div>
    );
  }

  // Not connected state
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-page-bg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <header className="mb-6">
            <h1 className="font-heading text-heading-1 text-text-primary">Portfolio</h1>
            <p className="mt-1 text-body-small text-text-secondary">Track your positions and trading history</p>
          </header>

          <motion.div 
            className="dossier-card rounded-subtle p-8 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="w-16 h-16 bg-divider rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h2 className="font-heading text-heading-2 text-text-primary mb-2">Connect Your Wallet</h2>
            <p className="text-body-small text-text-secondary mb-6">Connect your wallet to view your positions and trading history</p>
            <button
              onClick={handleConnect}
              className="px-6 py-3 bg-accent text-white rounded-subtle hover:bg-accent-hover font-medium transition-colors"
            >
              Connect Wallet
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Calculate totals
  const totalValue = MOCK_POSITIONS.reduce((sum, p) => sum + p.shares * p.currentPrice, 0);
  const totalCost = MOCK_POSITIONS.reduce((sum, p) => sum + p.shares * p.avgPrice, 0);
  const totalPnL = totalValue - totalCost;
  const pnlPercent = ((totalPnL / totalCost) * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <header className="mb-6">
          <h1 className="font-heading text-heading-1 text-text-primary">Portfolio</h1>
          <p className="mt-1 text-body-small text-text-secondary">Track your positions and trading history</p>
        </header>

        {/* Stats Cards */}
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="dossier-card rounded-subtle p-4">
            <span className="small-caps text-label text-text-tertiary">Total Value</span>
            <p className="font-heading text-heading-2 text-text-primary mt-1 typewriter">${totalValue.toFixed(2)}</p>
          </div>
          <div className="dossier-card rounded-subtle p-4">
            <span className="small-caps text-label text-text-tertiary">Total P&L</span>
            <p className={`font-heading text-heading-2 mt-1 typewriter ${totalPnL >= 0 ? 'text-support' : 'text-oppose'}`}>
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
            </p>
          </div>
          <div className="dossier-card rounded-subtle p-4">
            <span className="small-caps text-label text-text-tertiary">Return</span>
            <p className={`font-heading text-heading-2 mt-1 typewriter ${totalPnL >= 0 ? 'text-support' : 'text-oppose'}`}>
              {totalPnL >= 0 ? '+' : ''}{pnlPercent}%
            </p>
          </div>
        </motion.div>

        {/* Positions */}
        <motion.div 
          className="dossier-card rounded-subtle overflow-hidden mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="px-4 py-3 border-b border-divider bg-paper-aged">
            <h2 className="small-caps text-label text-text-secondary">Open Positions</h2>
          </div>
          <div className="divide-y divide-divider">
            {MOCK_POSITIONS.map((position) => {
              const value = position.shares * position.currentPrice;
              const cost = position.shares * position.avgPrice;
              const pnl = value - cost;
              return (
                <Link
                  key={position.id}
                  to="/markets/$marketId"
                  params={{ marketId: position.marketId }}
                  className="block p-4 hover:bg-page-bg/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-body text-text-primary line-clamp-1">{position.question}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-caption font-medium ${position.outcome === 'Yes' ? 'text-support' : 'text-oppose'}`}>
                          {position.outcome}
                        </span>
                        <span className="text-caption text-text-tertiary">{position.shares} shares</span>
                        <span className="text-caption text-text-tertiary">@ {(position.avgPrice * 100).toFixed(0)}¢</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-body font-medium text-text-primary typewriter">${value.toFixed(2)}</p>
                      <p className={`text-caption typewriter ${pnl >= 0 ? 'text-support' : 'text-oppose'}`}>
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </motion.div>

        {/* History */}
        <motion.div 
          className="dossier-card rounded-subtle overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="px-4 py-3 border-b border-divider bg-paper-aged">
            <h2 className="small-caps text-label text-text-secondary">Recent Activity</h2>
          </div>
          <div className="divide-y divide-divider">
            {MOCK_HISTORY.map((item) => (
              <div key={item.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-caption font-medium px-2 py-0.5 rounded-full ${
                        item.action === 'Buy' ? 'bg-support/10 text-support' : 'bg-oppose/10 text-oppose'
                      }`}>
                        {item.action}
                      </span>
                      <span className={`text-caption font-medium ${item.outcome === 'Yes' ? 'text-support' : 'text-oppose'}`}>
                        {item.outcome}
                      </span>
                    </div>
                    <p className="text-body-small text-text-primary mt-1 line-clamp-1">{item.question}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-body-small text-text-primary typewriter">{item.shares} @ {(item.price * 100).toFixed(0)}¢</p>
                    <p className="text-caption text-text-tertiary">{item.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
