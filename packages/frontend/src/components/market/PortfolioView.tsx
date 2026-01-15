interface Position {
  marketId: string;
  question: string;
  side: 'yes' | 'no';
  shares: number;
  avgPrice: number;
  currentPrice: number;
}

interface PortfolioViewProps {
  positions: Position[];
  totalValue: number;
}

export function PortfolioView({ positions, totalValue }: PortfolioViewProps) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="text-sm text-gray-600">Total Portfolio Value</div>
        <div className="text-3xl font-bold text-gray-900">${totalValue.toFixed(2)}</div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Active Positions</h3>
        {positions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No active positions
          </div>
        ) : (
          positions.map((position) => {
            const value = position.shares * position.currentPrice;
            const cost = position.shares * position.avgPrice;
            const pnl = value - cost;
            const pnlPercent = ((pnl / cost) * 100).toFixed(2);

            return (
              <div
                key={position.marketId}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{position.question}</h4>
                    <span
                      className={`inline-block mt-1 px-2 py-0.5 text-xs rounded ${
                        position.side === 'yes'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {position.side.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">${value.toFixed(2)}</div>
                    <div
                      className={`text-sm ${
                        pnl >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pnlPercent}%)
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 text-sm text-gray-600">
                  <span>{position.shares} shares</span>
                  <span>Avg: {Math.round(position.avgPrice * 100)}¢</span>
                  <span>Current: {Math.round(position.currentPrice * 100)}¢</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
