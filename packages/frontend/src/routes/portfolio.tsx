import { createFileRoute } from '@tanstack/react-router';
import { PortfolioView } from '../components/market';
import { usePositions } from '../lib/hooks/data/useMarkets';

export const Route = createFileRoute('/portfolio')({
  component: PortfolioPage,
});

interface Position {
  marketId: string;
  question: string;
  side: 'yes' | 'no';
  shares: number;
  avgPrice: number;
  currentPrice: number;
}

function PortfolioPage() {
  const { data, isLoading } = usePositions();
  const positions = (data ?? []) as Position[];

  const totalValue = positions.reduce(
    (sum, pos) => sum + pos.shares * pos.currentPrice,
    0
  );

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">Loading portfolio...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">My Portfolio</h1>
      <PortfolioView positions={positions} totalValue={totalValue} />
    </div>
  );
}
