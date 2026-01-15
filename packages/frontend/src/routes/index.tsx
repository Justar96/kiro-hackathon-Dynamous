/**
 * Home Page - Market Listing
 *
 * Displays all prediction markets with on-chain integration.
 * Uses useMarketFactory hook for market list and creation.
 *
 * Requirements: 1.1, 6.4, 10.1
 */

import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useAccount } from 'wagmi';
import { MarketCard, CreateMarketForm } from '../components/market';
import { useMarketFactory } from '../lib/hooks/web3/useMarketFactory';
import { useMarket } from '../lib/hooks/web3/useMarket';
import { useOrderBook } from '../lib/hooks/web3/useOrderBook';
import { Modal, useToast, PlusIcon, SpinnerIcon } from '../components';
import { useWalletConnection } from '../lib/hooks/web3/useWalletConnection';

export const Route = createFileRoute('/')({
  component: HomePage,
});

/**
 * Market card wrapper that fetches on-chain data for a single market
 */
function OnChainMarketCard({ marketAddress }: { marketAddress: `0x${string}` }) {
  const { data: market, isLoading } = useMarket(marketAddress);
  const { data: orderBook } = useOrderBook(
    market?.questionId,
    market?.yesTokenId,
    { depth: 1 }
  );

  if (isLoading || !market) {
    return (
      <div className="p-4 border border-gray-200 rounded-lg animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-4" />
        <div className="flex gap-2">
          <div className="flex-1 h-10 bg-gray-200 rounded" />
          <div className="flex-1 h-10 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  // Calculate prices from order book or use defaults
  const yesPrice = orderBook?.midPrice ?? 0.5;
  const noPrice = 1 - yesPrice;

  // Format end date
  const endDate = market.endTime.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <MarketCard
      marketId={marketAddress}
      question={market.question}
      yesPrice={yesPrice}
      noPrice={noPrice}
      volume="0" // Would need to track from events
      liquidity="0" // Would need to calculate from order book
      endDate={endDate}
      category={undefined} // Category stored off-chain
    />
  );
}

function HomePage() {
  const { isConnected } = useAccount();
  const { showToast } = useToast();
  const { connect, connectors } = useWalletConnection();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Use on-chain market factory hook
  const { marketList } = useMarketFactory();
  const { markets, isLoading, isError, refetch } = marketList;

  // Handle market creation success
  const handleCreateSuccess = (_marketAddress: `0x${string}`) => {
    showToast({ type: 'success', message: 'Market created successfully!' });
    setShowCreateModal(false);
    refetch();
  };

  // Handle create market button click
  const handleCreateClick = () => {
    if (!isConnected) {
      // Try to connect with first available connector
      const injectedConnector = connectors.find(c => c.id === 'injected');
      if (injectedConnector) {
        connect(injectedConnector);
      } else {
        showToast({ type: 'error', message: 'Please connect your wallet first' });
      }
      return;
    }
    setShowCreateModal(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Prediction Markets</h1>
        <button
          onClick={handleCreateClick}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="w-5 h-5" />
          Create Market
        </button>
      </div>

      {/* Category Filter - Note: Categories are stored off-chain, so this is placeholder */}
      <div className="flex gap-2 mb-6">
        {['all', 'Politics', 'Crypto', 'Sports', 'Entertainment'].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-4 py-2 rounded-lg ${
              categoryFilter === cat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <SpinnerIcon className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading markets...</span>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">Failed to load markets</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && markets.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No markets yet. Be the first to create one!</p>
          <button
            onClick={handleCreateClick}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Market
          </button>
        </div>
      )}

      {/* Market Grid */}
      {!isLoading && !isError && markets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {markets.map((marketAddress) => (
            <OnChainMarketCard key={marketAddress} marketAddress={marketAddress} />
          ))}
        </div>
      )}

      {/* Create Market Modal */}
      {showCreateModal && (
        <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Create New Market</h2>
            <CreateMarketForm
              onSuccess={handleCreateSuccess}
              onCancel={() => setShowCreateModal(false)}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
