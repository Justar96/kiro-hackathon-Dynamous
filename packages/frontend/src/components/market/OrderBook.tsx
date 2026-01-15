import { useState } from 'react';

interface OrderBookProps {
  marketId: string;
  yesOrders: Array<{ price: number; amount: number }>;
  noOrders: Array<{ price: number; amount: number }>;
}

export function OrderBook({ yesOrders, noOrders }: OrderBookProps) {
  const [activeTab, setActiveTab] = useState<'yes' | 'no'>('yes');
  const orders = activeTab === 'yes' ? yesOrders : noOrders;

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('yes')}
          className={`flex-1 py-2 rounded ${
            activeTab === 'yes'
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          Yes
        </button>
        <button
          onClick={() => setActiveTab('no')}
          className={`flex-1 py-2 rounded ${
            activeTab === 'no'
              ? 'bg-red-500 text-white'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          No
        </button>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500 font-medium pb-2 border-b">
          <span>Price</span>
          <span>Amount</span>
        </div>
        {orders.map((order, idx) => (
          <div
            key={idx}
            className="flex justify-between text-sm py-1 hover:bg-gray-50 cursor-pointer"
          >
            <span className="font-medium">{order.price}¢</span>
            <span className="text-gray-600">${order.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
