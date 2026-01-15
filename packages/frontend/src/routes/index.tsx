import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useSession } from '../lib';
import { MarketCard, CreateMarketForm } from '../components/market';
import { useMarkets, useCreateMarket } from '../lib/hooks/data/useMarkets';
import { Modal, useToast, useAuthModal, PlusIcon } from '../components';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const { user } = useSession();
  const { showToast } = useToast();
  const { openSignIn } = useAuthModal();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data: markets = [], isLoading } = useMarkets();
  const createMarketMutation = useCreateMarket();

  const filteredMarkets = categoryFilter === 'all'
    ? markets
    : markets.filter(m => m.category === categoryFilter);

  const handleCreateMarket = (data: any) => {
    if (!user) {
      openSignIn();
      return;
    }

    createMarketMutation.mutate(data, {
      onSuccess: () => {
        showToast({ type: 'success', message: 'Market created!' });
        setShowCreateModal(false);
      },
      onError: (error: Error) => {
        showToast({ type: 'error', message: error.message });
      },
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Prediction Markets</h1>
        <button
          onClick={() => user ? setShowCreateModal(true) : openSignIn()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="w-5 h-5" />
          Create Market
        </button>
      </div>

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

      {isLoading ? (
        <div className="text-center py-12">Loading markets...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMarkets.map((market) => (
            <MarketCard
              key={market.id}
              marketId={market.id}
              question={market.question}
              yesPrice={market.yesPrice}
              noPrice={market.noPrice}
              volume={market.volume}
              liquidity={market.liquidity}
              endDate={market.endDate}
              category={market.category}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Create New Market</h2>
            <CreateMarketForm
              onSubmit={handleCreateMarket}
              onCancel={() => setShowCreateModal(false)}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
