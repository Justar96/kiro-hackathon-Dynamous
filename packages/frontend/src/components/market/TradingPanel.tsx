/**
 * TradingPanel Component
 *
 * Trading interface for placing buy/sell orders on prediction markets.
 * Uses useOrderBookActions hook for on-chain order placement.
 * Handles token approval flow before sell orders.
 *
 * Requirements: 3.1, 3.2
 */

import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useOrderBookActions } from '../../lib/hooks/web3/useOrderBookActions';
import { useTokenBalances } from '../../lib/hooks/web3/useTokenBalances';
import { useWalletConnection } from '../../lib/hooks/web3/useWalletConnection';
import {
  toUsdcUnits,
  fromUsdcUnits,
  priceToBasisPoints,
  formatPriceAsCents,
  parseUserPrice,
  isValidPrice,
} from '../../lib/utils/price';
import { parseContractError, getSuggestedAction } from '../../lib/errors';
import { SpinnerIcon, CheckCircleIcon, WarningIcon } from '../icons';

interface TradingPanelProps {
  /** Market ID for display purposes */
  marketId: string;
  /** Market contract address */
  marketAddress?: `0x${string}`;
  /** Market question ID (bytes32) for order book */
  questionId?: `0x${string}`;
  /** YES token ID */
  yesTokenId?: bigint;
  /** NO token ID */
  noTokenId?: bigint;
  /** Current YES price (0-1) */
  yesPrice: number;
  /** Current NO price (0-1) */
  noPrice: number;
  /** Legacy callback for backward compatibility */
  onTrade?: (side: 'yes' | 'no', amount: number) => void;
}

type OrderType = 'buy' | 'sell';
type TokenSide = 'yes' | 'no';

export function TradingPanel({
  questionId,
  yesTokenId,
  noTokenId,
  yesPrice,
  noPrice,
  onTrade,
}: TradingPanelProps) {
  const { isConnected } = useAccount();
  const { connect, connectors } = useWalletConnection();
  const orderBookActions = useOrderBookActions();

  // Get user's token balances
  const { usdcBalance, yesBalance, noBalance } = useTokenBalances({
    yesTokenId,
    noTokenId,
  });

  // Form state
  const [orderType, setOrderType] = useState<OrderType>('buy');
  const [tokenSide, setTokenSide] = useState<TokenSide>('yes');
  const [amount, setAmount] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [useMarketPrice, setUseMarketPrice] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine current price based on token side
  const currentPrice = tokenSide === 'yes' ? yesPrice : noPrice;
  const effectivePrice = useMarketPrice ? currentPrice : (parseUserPrice(priceInput) ?? currentPrice);

  // Calculate order details
  const amountNum = parseFloat(amount) || 0;

  // For buy orders: amount is USDC spent, shares = amount / price
  // For sell orders: amount is shares to sell, proceeds = amount * price
  const shares = orderType === 'buy'
    ? amountNum > 0 && effectivePrice > 0 ? Math.floor(amountNum / effectivePrice) : 0
    : amountNum;

  const cost = orderType === 'buy'
    ? amountNum
    : amountNum * effectivePrice;

  const potentialReturn = orderType === 'buy'
    ? shares - amountNum // Profit if market resolves in your favor
    : amountNum * effectivePrice; // Proceeds from selling

  // Check if user has sufficient balance
  const userUsdcBalance = fromUsdcUnits(usdcBalance);
  const userTokenBalance = tokenSide === 'yes' ? fromUsdcUnits(yesBalance) : fromUsdcUnits(noBalance);

  const hasEnoughBalance = orderType === 'buy'
    ? userUsdcBalance >= amountNum
    : userTokenBalance >= amountNum;

  // Check if we have on-chain integration
  const hasOnChainIntegration = !!questionId && (
    (tokenSide === 'yes' && yesTokenId !== undefined) ||
    (tokenSide === 'no' && noTokenId !== undefined)
  );

  // Validate order
  const validateOrder = useCallback((): string | null => {
    if (!amountNum || amountNum <= 0) {
      return 'Please enter an amount';
    }
    if (!useMarketPrice && !isValidPrice(effectivePrice)) {
      return 'Price must be between $0.01 and $0.99';
    }
    if (!hasEnoughBalance) {
      return orderType === 'buy'
        ? `Insufficient USDC balance. You have ${userUsdcBalance.toFixed(2)} USDC`
        : `Insufficient ${tokenSide.toUpperCase()} tokens. You have ${userTokenBalance.toFixed(2)}`;
    }
    return null;
  }, [amountNum, useMarketPrice, effectivePrice, hasEnoughBalance, orderType, userUsdcBalance, userTokenBalance, tokenSide]);

  // Handle order submission
  const handleSubmit = async () => {
    setError(null);

    if (!isConnected) {
      // Try to connect wallet
      const injectedConnector = connectors.find(c => c.id === 'injected');
      if (injectedConnector) {
        try {
          await connect(injectedConnector);
        } catch {
          setError('Please connect your wallet to trade');
        }
      }
      return;
    }

    const validationError = validateOrder();
    if (validationError) {
      setError(validationError);
      return;
    }

    // Use legacy callback if no on-chain integration
    if (!hasOnChainIntegration && onTrade) {
      onTrade(tokenSide, amountNum);
      setAmount('');
      return;
    }

    if (!questionId) {
      setError('Market data not available');
      return;
    }

    const tokenId = tokenSide === 'yes' ? yesTokenId : noTokenId;
    if (tokenId === undefined) {
      setError('Token ID not available');
      return;
    }

    try {
      const priceBps = priceToBasisPoints(effectivePrice);
      const quantity = toUsdcUnits(orderType === 'buy' ? shares : amountNum);

      if (orderType === 'buy') {
        await orderBookActions.placeBuyOrder(questionId, tokenId, priceBps, quantity);
      } else {
        await orderBookActions.placeSellOrder(questionId, tokenId, priceBps, quantity);
      }

      // Clear form on success
      setAmount('');
      setPriceInput('');
    } catch (err) {
      const parsed = parseContractError(err);
      const suggestion = getSuggestedAction(parsed);
      setError(suggestion ? `${parsed.message}. ${suggestion}` : parsed.message);
    }
  };

  // Get transaction status message
  const getStatusMessage = () => {
    switch (orderBookActions.transactionState.status) {
      case 'pending_signature':
        return 'Please confirm the transaction in your wallet...';
      case 'pending_confirmation':
        return 'Order submitted. Waiting for confirmation...';
      case 'confirmed':
        return 'Order placed successfully!';
      default:
        return null;
    }
  };

  const statusMessage = getStatusMessage();
  const isSubmitting = orderBookActions.isLoading;

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">Place Order</h3>

      {/* Order Type Selector */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setOrderType('buy')}
          className={`flex-1 py-2 rounded font-medium transition-colors ${
            orderType === 'buy'
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          disabled={isSubmitting}
        >
          Buy
        </button>
        <button
          onClick={() => setOrderType('sell')}
          className={`flex-1 py-2 rounded font-medium transition-colors ${
            orderType === 'sell'
              ? 'bg-red-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          disabled={isSubmitting}
        >
          Sell
        </button>
      </div>

      {/* Token Side Selector */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTokenSide('yes')}
          className={`flex-1 py-2 rounded font-medium transition-colors ${
            tokenSide === 'yes'
              ? 'bg-green-100 text-green-700 border-2 border-green-500'
              : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
          }`}
          disabled={isSubmitting}
        >
          Yes {formatPriceAsCents(yesPrice)}
        </button>
        <button
          onClick={() => setTokenSide('no')}
          className={`flex-1 py-2 rounded font-medium transition-colors ${
            tokenSide === 'no'
              ? 'bg-red-100 text-red-700 border-2 border-red-500'
              : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
          }`}
          disabled={isSubmitting}
        >
          No {formatPriceAsCents(noPrice)}
        </button>
      </div>

      <div className="space-y-4">
        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {orderType === 'buy' ? 'Amount (USDC)' : 'Shares to Sell'}
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSubmitting}
          />
          <div className="mt-1 text-xs text-gray-500 flex justify-between">
            <span>
              {orderType === 'buy' ? 'Available:' : 'You have:'}{' '}
              {orderType === 'buy'
                ? `${userUsdcBalance.toFixed(2)} USDC`
                : `${userTokenBalance.toFixed(2)} ${tokenSide.toUpperCase()}`}
            </span>
            <button
              type="button"
              onClick={() => setAmount(
                orderType === 'buy'
                  ? userUsdcBalance.toFixed(2)
                  : userTokenBalance.toFixed(2)
              )}
              className="text-blue-600 hover:underline"
              disabled={isSubmitting}
            >
              Max
            </button>
          </div>
        </div>

        {/* Price Input (for limit orders) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">Price</label>
            <label className="flex items-center gap-1 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={useMarketPrice}
                onChange={(e) => setUseMarketPrice(e.target.checked)}
                className="rounded"
                disabled={isSubmitting}
              />
              Use market price
            </label>
          </div>
          {useMarketPrice ? (
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-700">
              {formatPriceAsCents(currentPrice)} (market)
            </div>
          ) : (
            <input
              type="text"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="0.50 or 50%"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSubmitting}
            />
          )}
        </div>

        {/* Order Summary */}
        <div className="bg-gray-50 p-3 rounded space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Price per share</span>
            <span className="font-medium">{formatPriceAsCents(effectivePrice)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">
              {orderType === 'buy' ? 'Shares to receive' : 'Proceeds'}
            </span>
            <span className="font-medium">
              {orderType === 'buy' ? shares.toFixed(0) : `$${cost.toFixed(2)}`}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t">
            <span className="text-gray-600">
              {orderType === 'buy' ? 'Potential profit' : 'You receive'}
            </span>
            <span className={`font-medium ${potentialReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {orderType === 'buy'
                ? `$${potentialReturn.toFixed(2)}`
                : `$${potentialReturn.toFixed(2)}`}
            </span>
          </div>
        </div>

        {/* Transaction Status */}
        {statusMessage && (
          <div className={`p-3 rounded-lg flex items-center gap-2 ${
            orderBookActions.transactionState.status === 'confirmed'
              ? 'bg-green-50 text-green-700'
              : 'bg-blue-50 text-blue-700'
          }`}>
            {orderBookActions.transactionState.status === 'confirmed' ? (
              <CheckCircleIcon className="w-5 h-5" />
            ) : (
              <SpinnerIcon className="w-5 h-5 animate-spin" />
            )}
            <span className="text-sm">{statusMessage}</span>
          </div>
        )}

        {/* Transaction Hash Link */}
        {orderBookActions.transactionState.status === 'pending_confirmation' && (
          <div className="text-xs text-gray-500">
            Transaction:{' '}
            <a
              href={`https://amoy.polygonscan.com/tx/${orderBookActions.transactionState.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-mono"
            >
              {orderBookActions.transactionState.hash.slice(0, 10)}...
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

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || (!isConnected && !connectors.length)}
          className={`w-full py-3 rounded font-medium flex items-center justify-center gap-2 transition-colors ${
            orderType === 'buy'
              ? 'bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400'
              : 'bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-400'
          } disabled:cursor-not-allowed`}
        >
          {isSubmitting && <SpinnerIcon className="w-4 h-4 animate-spin" />}
          {!isConnected
            ? 'Connect Wallet'
            : isSubmitting
            ? 'Processing...'
            : `${orderType === 'buy' ? 'Buy' : 'Sell'} ${tokenSide.toUpperCase()}`}
        </button>

        {/* Wallet Connection Warning */}
        {!isConnected && (
          <p className="text-center text-xs text-gray-500">
            Connect your wallet to start trading
          </p>
        )}
      </div>
    </div>
  );
}
