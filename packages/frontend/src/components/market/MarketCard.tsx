import { Link } from '@tanstack/react-router';
import { ChartIcon } from '../icons';

interface MarketCardProps {
  marketId: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  volume: string;
  liquidity: string;
  endDate: string;
  category?: string;
}

export function MarketCard({
  marketId,
  question,
  yesPrice,
  noPrice,
  volume,
  liquidity,
  endDate,
  category,
}: MarketCardProps) {
  const yesPercent = Math.round(yesPrice * 100);
  const noPercent = Math.round(noPrice * 100);

  return (
    <Link
      to="/markets/$marketId"
      params={{ marketId }}
      className="block p-4 border border-gray-200 rounded-lg hover:border-blue-500 transition-colors"
    >
      {category && (
        <span className="text-xs text-gray-500 uppercase">{category}</span>
      )}
      <h3 className="mt-2 text-lg font-semibold text-gray-900">{question}</h3>
      
      <div className="mt-4 flex gap-2">
        <button className="flex-1 py-2 px-4 bg-green-50 border border-green-200 rounded text-green-700 font-medium hover:bg-green-100">
          Yes {yesPercent}¢
        </button>
        <button className="flex-1 py-2 px-4 bg-red-50 border border-red-200 rounded text-red-700 font-medium hover:bg-red-100">
          No {noPercent}¢
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <ChartIcon className="w-4 h-4" />
            ${volume}
          </span>
          <span>Liquidity: ${liquidity}</span>
        </div>
        <span>{endDate}</span>
      </div>
    </Link>
  );
}
