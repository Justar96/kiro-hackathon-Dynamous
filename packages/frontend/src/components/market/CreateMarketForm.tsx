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
        <label className="block text-body-small font-medium text-text-primary mb-1">
          Market Question
        </label>
        <input
          type="text"
          value={formData.question}
          onChange={(e) => setFormData({ ...formData, question: e.target.value })}
          placeholder="Will Bitcoin reach $100k by end of 2026?"
          className="w-full px-3 py-2 bg-paper border border-divider rounded-subtle focus:outline-none focus:ring-2 focus:ring-accent text-text-primary"
          disabled={isSubmitting}
          required
        />
        <p className="mt-1 text-caption text-text-tertiary">
          Ask a clear yes/no question about a future event
        </p>
      </div>

      {/* Resolution Criteria */}
      <div>
        <label className="block text-body-small font-medium text-text-primary mb-1">
          Resolution Criteria
        </label>
        <textarea
          value={formData.resolutionCriteria}
          onChange={(e) => setFormData({ ...formData, resolutionCriteria: e.target.value })}
          placeholder="This market resolves YES if Bitcoin's price on CoinGecko exceeds $100,000 USD at any point before the end date. Otherwise, it resolves NO."
          className="w-full px-3 py-2 bg-paper border border-divider rounded-subtle focus:outline-none focus:ring-2 focus:ring-accent text-text-primary min-h-[80px]"
          disabled={isSubmitting}
          required
        />
        <p className="mt-1 text-caption text-text-tertiary">
          Describe exactly how this market will be resolved
        </p>
      </div>

      {/* Category */}
      <div>
        <label className="block text-body-small font-medium text-text-primary mb-1">
          Category
        </label>
        <select
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          className="w-full px-3 py-2 bg-paper border border-divider rounded-subtle focus:outline-none focus:ring-2 focus:ring-accent text-text-primary"
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
        <label className="block text-body-small font-medium text-text-primary mb-1">
          End Date
        </label>
        <input
          type="datetime-local"
          value={formData.endDate}
          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
          min={new Date().toISOString().slice(0, 16)}
          className="w-full px-3 py-2 bg-paper border border-divider rounded-subtle focus:outline-none focus:ring-2 focus:ring-accent text-text-primary"
          disabled={isSubmitting}
          required
        />
        <p className="mt-1 text-caption text-text-tertiary">
          When should this market close for trading?
        </p>
      </div>

      {/* Initial Liquidity */}
      <div>
        <label className="block text-body-small font-medium text-text-primary mb-1">
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
          className="w-full px-3 py-2 bg-paper border border-divider rounded-subtle focus:outline-none focus:ring-2 focus:ring-accent text-text-primary typewriter"
          disabled={isSubmitting}
          required
        />
        <div className="mt-1 flex justify-between text-caption">
          <span className="text-text-tertiary">
            Minimum: {MIN_LIQUIDITY_USDC} USDC
          </span>
          <span className={hasEnoughBalance ? 'text-text-tertiary' : 'text-oppose'}>
            Your balance: {userUsdcBalance.toFixed(2)} USDC
          </span>
        </div>
      </div>

      {/* Transaction Status */}
      {statusMessage && (
        <div className={`p-3 rounded-subtle flex items-center gap-2 ${
          actions.transactionState.status === 'confirmed'
            ? 'bg-support/10 text-support border border-support/30'
            : 'bg-accent/10 text-accent border border-accent/30'
        }`}>
          {actions.transactionState.status === 'confirmed' ? (
            <CheckCircleIcon className="w-5 h-5" />
          ) : (
            <SpinnerIcon className="w-5 h-5 animate-spin" />
          )}
          <span className="text-body-small">{statusMessage}</span>
        </div>
      )}

      {/* Transaction Hash Link */}
      {actions.transactionState.status === 'pending_confirmation' && (
        <div className="text-caption text-text-tertiary">
          Transaction hash:{' '}
          <a
            href={`https://amoy.polygonscan.com/tx/${actions.transactionState.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline typewriter"
          >
            {actions.transactionState.hash.slice(0, 10)}...
          </a>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-oppose/10 border border-oppose/30 rounded-subtle flex items-start gap-2">
          <WarningIcon className="w-5 h-5 text-oppose flex-shrink-0 mt-0.5" />
          <span className="text-body-small text-oppose">{error}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 px-4 border border-divider rounded-subtle text-text-secondary hover:bg-paper-aged disabled:opacity-50 transition-colors"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 py-2 px-4 bg-accent text-white rounded-subtle hover:bg-accent-hover disabled:bg-text-tertiary disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          disabled={isSubmitting || !isConnected}
        >
          {isSubmitting && <SpinnerIcon className="w-4 h-4 animate-spin" />}
          {isSubmitting ? 'Creating...' : 'Create Market'}
        </button>
      </div>

      {/* Wallet Connection Warning */}
      {!isConnected && (
        <p className="text-center text-body-small text-stamp-red italic">
          Please connect your wallet to create a market
        </p>
      )}
    </form>
  );
}
