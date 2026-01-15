import { useState } from 'react';

interface TradingPanelProps {
  marketId: string;
  yesPrice: number;
  noPrice: number;
  onTrade: (side: 'yes' | 'no', amount: number) => void;
}

export function TradingPanel({ yesPrice, noPrice, onTrade }: TradingPanelProps) {
  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const [amount, setAmount] = useState('');

  const currentPrice = side === 'yes' ? yesPrice : noPrice;
  const shares = amount ? Math.floor(Number(amount) / currentPrice) : 0;

  const handleTrade = () => {
    if (amount && Number(amount) > 0) {
      onTrade(side, Number(amount));
      setAmount('');
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">Place Order</h3>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSide('yes')}
          className={`flex-1 py-2 rounded font-medium ${
            side === 'yes'
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          Buy Yes
        </button>
        <button
          onClick={() => setSide('no')}
          className={`flex-1 py-2 rounded font-medium ${
            side === 'no'
              ? 'bg-red-500 text-white'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          Buy No
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount (USDC)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="bg-gray-50 p-3 rounded space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Price per share</span>
            <span className="font-medium">{Math.round(currentPrice * 100)}¢</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Shares</span>
            <span className="font-medium">{shares}</span>
          </div>
          <div className="flex justify-between pt-2 border-t">
            <span className="text-gray-600">Potential return</span>
            <span className="font-medium text-green-600">
              ${shares > 0 ? (shares - Number(amount)).toFixed(2) : '0.00'}
            </span>
          </div>
        </div>

        <button
          onClick={handleTrade}
          disabled={!amount || Number(amount) <= 0}
          className="w-full py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Place Order
        </button>
      </div>
    </div>
  );
}
