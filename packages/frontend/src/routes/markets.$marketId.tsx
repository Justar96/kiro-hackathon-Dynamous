import { createFileRoute } from '@tanstack/react-router';
import { useSession } from '../lib';
import { OrderBook, TradingPanel, MarketChart } from '../components/market';
import { useMarket, usePlaceOrder } from '../lib/hooks/data/useMarkets';
import { useToast, useAuthModal } from '../components';

export const Route = createFileRoute('/markets/$marketId')({
  component: MarketDetailPage,
});

function MarketDetailPage() {
  const { marketId } = Route.useParams();
  const { user } = useSession();
  const { showToast } = useToast();
  const { openSignIn } = useAuthModal();

  const { data: market, isLoading } = useMarket(marketId);
  const placeOrderMutation = usePlaceOrder();

  const handleTrade = (side: 'yes' | 'no', amount: number) => {
    if (!user) {
      openSignIn();
      return;
    }

    placeOrderMutation.mutate(
      { marketId, side, amount },
      {
        onSuccess: () => {
          showToast({ type: 'success', message: 'Order placed!' });
        },
        onError: (error: Error) => {
          showToast({ type: 'error', message: error.message });
        },
      }
    );
  };

  if (isLoading) {
    return <div className="max-w-7xl mx-auto px-4 py-8">Loading...</div>;
  }

  if (!market) {
    return <div className="max-w-7xl mx-auto px-4 py-8">Market not found</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <span className="text-sm text-gray-500 uppercase">{market.category}</span>
        <h1 className="text-3xl font-bold mt-2">{market.question}</h1>
        <div className="flex gap-4 mt-4 text-sm text-gray-600">
          <span>Volume: ${market.volume}</span>
          <span>Liquidity: ${market.liquidity}</span>
          <span>Ends: {market.endDate}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <MarketChart marketId={marketId} />
          <OrderBook
            marketId={marketId}
            yesOrders={[
              { price: 0.65, amount: 100 },
              { price: 0.64, amount: 250 },
              { price: 0.63, amount: 150 },
            ]}
            noOrders={[
              { price: 0.35, amount: 120 },
              { price: 0.36, amount: 200 },
              { price: 0.37, amount: 180 },
            ]}
          />
        </div>

        <div>
          <TradingPanel
            marketId={marketId}
            yesPrice={market.yesPrice}
            noPrice={market.noPrice}
            onTrade={handleTrade}
          />
        </div>
      </div>
    </div>
  );
}
