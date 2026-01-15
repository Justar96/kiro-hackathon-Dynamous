import { useState } from 'react';

interface CreateMarketFormProps {
  onSubmit: (data: MarketFormData) => void;
  onCancel: () => void;
}

export interface MarketFormData {
  question: string;
  category: string;
  endDate: string;
  initialLiquidity: number;
}

const CATEGORIES = [
  'Politics',
  'Crypto',
  'Sports',
  'Entertainment',
  'Science',
  'Business',
  'Other',
];

export function CreateMarketForm({ onSubmit, onCancel }: CreateMarketFormProps) {
  const [formData, setFormData] = useState<MarketFormData>({
    question: '',
    category: '',
    endDate: '',
    initialLiquidity: 100,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Market Question
        </label>
        <input
          type="text"
          value={formData.question}
          onChange={(e) => setFormData({ ...formData, question: e.target.value })}
          placeholder="Will Bitcoin reach $100k by end of 2026?"
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Category
        </label>
        <select
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="">Select category</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          End Date
        </label>
        <input
          type="datetime-local"
          value={formData.endDate}
          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Initial Liquidity (USDC)
        </label>
        <input
          type="number"
          value={formData.initialLiquidity}
          onChange={(e) =>
            setFormData({ ...formData, initialLiquidity: Number(e.target.value) })
          }
          min="10"
          step="10"
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 px-4 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Create Market
        </button>
      </div>
    </form>
  );
}
