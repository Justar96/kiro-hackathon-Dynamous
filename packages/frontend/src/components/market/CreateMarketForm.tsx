/**
 * CreateMarketForm Component
 *
 * Form for creating new prediction markets with on-chain integration.
 * Uses useMarketFactory hook for contract interactions.
 * Handles USDC approval flow before market creation.
 *
 * Requirements: 1.1, 6.4
 */

import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useMarketFactory, type CreateMarketParams } from '../../lib/hooks/web3/useMarketFactory';
import { useTokenBalances } from '../../lib/hooks/web3/useTokenBalances';
import { toUsdcUnits, fromUsdcUnits } from '../../lib/utils/price';
import { parseContractError, getSuggestedAction } from '../../lib/errors';
import { SpinnerIcon, CheckCircleIcon, WarningIcon } from '../icons';

interface CreateMarketFormProps {
  onSuccess?: (marketAddress: `0x${string}`) => void;
  onCancel: () => void;
}

export interface MarketFormData {
  question: string;
  resolutionCriteria: string;
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

const MIN_LIQUIDITY_USDC = 10;

export function CreateMarketForm({ onSuccess, onCancel }: CreateMarketFormProps) {
  const { address, isConnected } = useAccount();
  const { actions } = useMarketFactory();
  const { usdcBalance } = useTokenBalances();

  const [formData, setFormData] = useState<MarketFormData>({
    question: '',
    resolutionCriteria: '',
    category: '',
    endDate: '',
    initialLiquidity: MIN_LIQUIDITY_USDC,
  });

  const [error, setError] = useState<string | null>(null);

  // Calculate user's USDC balance in human-readable format
  const userUsdcBalance = usdcBalance ? fromUsdcUnits(usdcBalance) : 0;
  const hasEnoughBalance = userUsdcBalance >= formData.initialLiquidity;

  // Validate form data
  const validateForm = useCallback((): string | null => {
    if (!formData.question.trim()) {
      return 'Please enter a market question';
    }
    if (formData.question.length < 10) {
      return 'Question must be at least 10 characters';
    }
    if (!formData.resolutionCriteria.trim()) {
      return 'Please enter resolution criteria';
    }
    if (!formData.category) {
      return 'Please select a category';
    }
    if (!formData.endDate) {
      return 'Please select an end date';
    }
    const endTimestamp = new Date(formData.endDate).getTime();
    if (endTimestamp <= Date.now()) {
      return 'End date must be in the future';
    }
    if (formData.initialLiquidity < MIN_LIQUIDITY_USDC) {
      return `Initial liquidity must be at least ${MIN_LIQUIDITY_USDC} USDC`;
    }
    if (!hasEnoughBalance) {
      return `Insufficient USDC balance. You have ${userUsdcBalance.toFixed(2)} USDC`;
    }
    return null;
  }, [formData, hasEnoughBalance, userUsdcBalance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const params: CreateMarketParams = {
        question: formData.question.trim(),
        resolutionCriteria: formData.resolutionCriteria.trim(),
        endTime: Math.floor(new Date(formData.endDate).getTime() / 1000),
        initialLiquidity: toUsdcUnits(formData.initialLiquidity),
      };

      const hash = await actions.createMarket(params);
      
      // Wait for the transaction to be confirmed
      // The marketList will be updated via event subscription
      // For now, we'll just notify success
      if (hash) {
        // Notify success with the transaction hash
        onSuccess?.(hash as `0x${string}`);
      }
    } catch (err) {
      const parsed = parseContractError(err);
      const suggestion = getSuggestedAction(parsed);
      setError(suggestion ? `${parsed.message}. ${suggestion}` : parsed.message);
    }
  };

  // Get transaction status message
  const getStatusMessage = () => {
    switch (actions.transactionState.status) {
      case 'pending_signature':
        return 'Please confirm the transaction in your wallet...';
      case 'pending_confirmation':
        return 'Transaction submitted. Waiting for confirmation...';
      case 'confirmed':
        return 'Market created successfully!';
      default:
        return null;
    }
  };

  const statusMessage = getStatusMessage();
  const isSubmitting = actions.isLoading;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Market Question */}
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
          disabled={isSubmitting}
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          Ask a clear yes/no question about a future event
        </p>
      </div>

      {/* Resolution Criteria */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Resolution Criteria
        </label>
        <textarea
          value={formData.resolutionCriteria}
          onChange={(e) => setFormData({ ...formData, resolutionCriteria: e.target.value })}
          placeholder="This market resolves YES if Bitcoin's price on CoinGecko exceeds $100,000 USD at any point before the end date. Otherwise, it resolves NO."
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
          disabled={isSubmitting}
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          Describe exactly how this market will be resolved
        </p>
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Category
        </label>
        <select
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isSubmitting}
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

      {/* End Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          End Date
        </label>
        <input
          type="datetime-local"
          value={formData.endDate}
          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
          min={new Date().toISOString().slice(0, 16)}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isSubmitting}
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          When should this market close for trading?
        </p>
      </div>

      {/* Initial Liquidity */}
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
          min={MIN_LIQUIDITY_USDC}
          step="1"
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isSubmitting}
          required
        />
        <div className="mt-1 flex justify-between text-xs">
          <span className="text-gray-500">
            Minimum: {MIN_LIQUIDITY_USDC} USDC
          </span>
          <span className={hasEnoughBalance ? 'text-gray-500' : 'text-red-500'}>
            Your balance: {userUsdcBalance.toFixed(2)} USDC
          </span>
        </div>
      </div>

      {/* Transaction Status */}
      {statusMessage && (
        <div className={`p-3 rounded-lg flex items-center gap-2 ${
          actions.transactionState.status === 'confirmed'
            ? 'bg-green-50 text-green-700'
            : 'bg-blue-50 text-blue-700'
        }`}>
          {actions.transactionState.status === 'confirmed' ? (
            <CheckCircleIcon className="w-5 h-5" />
          ) : (
            <SpinnerIcon className="w-5 h-5 animate-spin" />
          )}
          <span className="text-sm">{statusMessage}</span>
        </div>
      )}

      {/* Transaction Hash Link */}
      {actions.transactionState.status === 'pending_confirmation' && (
        <div className="text-xs text-gray-500">
          Transaction hash:{' '}
          <a
            href={`https://amoy.polygonscan.com/tx/${actions.transactionState.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline font-mono"
          >
            {actions.transactionState.hash.slice(0, 10)}...
          </a>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <WarningIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 px-4 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          disabled={isSubmitting || !isConnected}
        >
          {isSubmitting && <SpinnerIcon className="w-4 h-4 animate-spin" />}
          {isSubmitting ? 'Creating...' : 'Create Market'}
        </button>
      </div>

      {/* Wallet Connection Warning */}
      {!isConnected && (
        <p className="text-center text-sm text-amber-600">
          Please connect your wallet to create a market
        </p>
      )}
    </form>
  );
}
