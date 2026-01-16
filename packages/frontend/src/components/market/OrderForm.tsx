/**
 * OrderForm Component
 *
 * Buy/sell order form with price and quantity inputs for hybrid CLOB trading.
 * Integrates with useOrders hook for off-chain order submission.
 * Shows estimated fees before order placement.
 *
 * Requirements: 12.3
 */

import { useState, useCallback, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { type Hex } from 'viem';
import { useOrders, type SubmitOrderParams } from '../../lib/hooks/trading/useOrders';
import { useBalances } from '../../lib/hooks/trading/useBalances';
import { Side } from '../../lib/trading/orderSigner';
import { SpinnerIcon, CheckCircleIcon, WarningIcon } from '../icons';

// ============================================
// Types
// ============================================

interface OrderFormProps {
  /** Market ID (bytes32) */
  marketId: Hex;
  /** Token ID for the outcome being traded */
  tokenId: bigint;
  /** Token label (e.g., "YES" or "NO") */
  tokenLabel?: string;
  /** Current best bid price (for reference) */
  bestBid?: string | null;
  /** Current best ask price (for reference) */
  bestAsk?: string | null;
  /** Fee rate in basis points (default: 0) */
  feeRateBps?: bigint;
  /** Callback when order is successfully submitted */
  onOrderSubmitted?: () => void;
}

type OrderSide = 'buy' | 'sell';

// ============================================
// Constants
// ============================================

const BPS_DIVISOR = 10000n;
const USDC_DECIMALS = 6;
const TOKEN_DECIMALS = 18;

// ============================================
// Helper Functions
// ============================================

/**
 * Format price from basis points to display string (e.g., "0.50" or "50¢")
 */
function formatPrice(priceBps: bigint | string | null): string {
  if (priceBps === null) return '-';
  const bps = typeof priceBps === 'string' ? BigInt(priceBps) : priceBps;
  const cents = Number(bps) / 100;
  return `${cents.toFixed(0)}¢`;
}

/**
 * Parse user price input to basis points
 * Accepts: "0.50", "50", "50%", "50¢"
 */
function parsePriceToBps(input: string): bigint | null {
  const cleaned = input.trim().replace(/[%¢$]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  
  // If input looks like a decimal (0.xx), treat as fraction
  if (num > 0 && num < 1) {
    return BigInt(Math.round(num * 10000));
  }
  // Otherwise treat as cents (0-100)
  if (num >= 0 && num <= 100) {
    return BigInt(Math.round(num * 100));
  }
  return null;
}

/**
 * Parse quantity input to token units (18 decimals)
 */
function parseQuantity(input: string): bigint | null {
  const num = parseFloat(input);
  if (isNaN(num) || num <= 0) return null;
  return BigInt(Math.round(num * 10 ** TOKEN_DECIMALS));
}

/**
 * Calculate estimated fee using Polymarket formula:
 * fee = feeRateBps × min(price, 1-price) × outcomeTokens / BPS_DIVISOR
 */
function calculateFee(
  priceBps: bigint,
  quantity: bigint,
  feeRateBps: bigint
): bigint {
  if (feeRateBps === 0n) return 0n;
  
  const complementPrice = BPS_DIVISOR - priceBps;
  const minPrice = priceBps < complementPrice ? priceBps : complementPrice;
  
  // fee = feeRateBps × minPrice × quantity / BPS_DIVISOR / BPS_DIVISOR
  return (feeRateBps * minPrice * quantity) / BPS_DIVISOR / BPS_DIVISOR;
}

/**
 * Format token amount for display
 */
function formatTokenAmount(amount: bigint): string {
  const num = Number(amount) / 10 ** TOKEN_DECIMALS;
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toFixed(2);
}

/**
 * Format USDC amount for display
 */
function formatUsdcAmount(amount: bigint): string {
  const num = Number(amount) / 10 ** USDC_DECIMALS;
  return `$${num.toFixed(2)}`;
}

// ============================================
// Component
// ============================================

export function OrderForm({
  marketId,
  tokenId,
  tokenLabel = 'Token',
  bestBid,
  bestAsk,
  feeRateBps = 0n,
  onOrderSubmitted,
}: OrderFormProps) {
  const { isConnected } = useAccount();
  const { submitOrder, isSubmitting, submitError } = useOrders(marketId);
  const { balances } = useBalances();

  // Form state
  const [side, setSide] = useState<OrderSide>('buy');
  const [priceInput, setPriceInput] = useState('');
  const [quantityInput, setQuantityInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Parse inputs
  const priceBps = useMemo(() => parsePriceToBps(priceInput), [priceInput]);
  const quantity = useMemo(() => parseQuantity(quantityInput), [quantityInput]);

  // Get user's USDC balance (token ID 0 is typically USDC)
  const usdcBalance = useMemo(() => {
    const balance = balances.get('0');
    return balance ? BigInt(balance.available) : 0n;
  }, [balances]);

  // Calculate order cost and fee
  const orderDetails = useMemo(() => {
    if (!priceBps || !quantity || priceBps <= 0n || priceBps >= BPS_DIVISOR) {
      return null;
    }

    const fee = calculateFee(priceBps, quantity, feeRateBps);
    
    if (side === 'buy') {
      // BUY: cost = price × quantity (in USDC)
      // Adjust for decimal differences
      const cost = (priceBps * quantity) / BPS_DIVISOR / (10n ** BigInt(TOKEN_DECIMALS - USDC_DECIMALS));
      const totalCost = cost + fee;
      return {
        cost,
        fee,
        totalCost,
        receive: quantity,
        canAfford: usdcBalance >= totalCost,
      };
    } else {
      // SELL: receive = price × quantity (in USDC)
      const receive = (priceBps * quantity) / BPS_DIVISOR / (10n ** BigInt(TOKEN_DECIMALS - USDC_DECIMALS));
      const netReceive = receive - fee;
      // For sell, check token balance (would need to track per-token balances)
      return {
        cost: quantity,
        fee,
        totalCost: quantity,
        receive: netReceive,
        canAfford: true, // Simplified - would check token balance
      };
    }
  }, [priceBps, quantity, side, feeRateBps, usdcBalance]);

  // Validate form
  const validateForm = useCallback((): string | null => {
    if (!priceInput.trim()) {
      return 'Please enter a price';
    }
    if (!priceBps) {
      return 'Invalid price format';
    }
    if (priceBps <= 0n || priceBps >= BPS_DIVISOR) {
      return 'Price must be between 0.01 and 0.99';
    }
    if (!quantityInput.trim()) {
      return 'Please enter a quantity';
    }
    if (!quantity || quantity <= 0n) {
      return 'Invalid quantity';
    }
    if (orderDetails && !orderDetails.canAfford) {
      return 'Insufficient balance';
    }
    return null;
  }, [priceInput, priceBps, quantityInput, quantity, orderDetails]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!isConnected) {
      setError('Please connect your wallet');
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!priceBps || !quantity) {
      setError('Invalid order parameters');
      return;
    }

    try {
      const params: SubmitOrderParams = {
        marketId,
        tokenId,
        side: side === 'buy' ? Side.BUY : Side.SELL,
        price: priceBps,
        quantity,
        feeRateBps,
      };

      const result = await submitOrder(params);

      if (result.status === 'accepted') {
        setSuccess(true);
        setPriceInput('');
        setQuantityInput('');
        onOrderSubmitted?.();
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || 'Order rejected');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit order');
    }
  };

  // Set price from order book
  const handleSetBestBid = () => {
    if (bestBid) {
      const cents = Number(BigInt(bestBid)) / 100;
      setPriceInput(cents.toString());
    }
  };

  const handleSetBestAsk = () => {
    if (bestAsk) {
      const cents = Number(BigInt(bestAsk)) / 100;
      setPriceInput(cents.toString());
    }
  };

  return (
    <div className="dossier-card rounded-subtle p-5 pt-8 relative">
      <span className="folder-tab">Order</span>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Side Selector */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSide('buy')}
            className={`flex-1 py-2 rounded-subtle font-medium transition-colors ${
              side === 'buy'
                ? 'bg-support text-white'
                : 'bg-paper-aged text-text-secondary hover:bg-divider'
            }`}
            disabled={isSubmitting}
          >
            Buy
          </button>
          <button
            type="button"
            onClick={() => setSide('sell')}
            className={`flex-1 py-2 rounded-subtle font-medium transition-colors ${
              side === 'sell'
                ? 'bg-oppose text-white'
                : 'bg-paper-aged text-text-secondary hover:bg-divider'
            }`}
            disabled={isSubmitting}
          >
            Sell
          </button>
        </div>

        {/* Token Label */}
        <div className="text-center text-body-small text-text-secondary">
          {side === 'buy' ? 'Buying' : 'Selling'} <span className="font-medium">{tokenLabel}</span>
        </div>

        {/* Price Input */}
        <div>
          <label className="block text-body-small font-medium text-text-primary mb-1">
            Price (¢)
          </label>
          <input
            type="text"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            placeholder="50"
            className="w-full px-3 py-2 bg-paper border border-divider rounded-subtle focus:outline-none focus:ring-2 focus:ring-accent text-text-primary typewriter"
            disabled={isSubmitting}
          />
          <div className="mt-1 flex justify-between text-caption text-text-tertiary">
            <span>0.01 - 0.99</span>
            <div className="flex gap-2">
              {bestBid && (
                <button
                  type="button"
                  onClick={handleSetBestBid}
                  className="text-accent hover:underline"
                  disabled={isSubmitting}
                >
                  Bid {formatPrice(bestBid)}
                </button>
              )}
              {bestAsk && (
                <button
                  type="button"
                  onClick={handleSetBestAsk}
                  className="text-accent hover:underline"
                  disabled={isSubmitting}
                >
                  Ask {formatPrice(bestAsk)}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quantity Input */}
        <div>
          <label className="block text-body-small font-medium text-text-primary mb-1">
            Quantity
          </label>
          <input
            type="number"
            value={quantityInput}
            onChange={(e) => setQuantityInput(e.target.value)}
            placeholder="100"
            min="0"
            step="1"
            className="w-full px-3 py-2 bg-paper border border-divider rounded-subtle focus:outline-none focus:ring-2 focus:ring-accent text-text-primary typewriter"
            disabled={isSubmitting}
          />
        </div>

        {/* Order Summary */}
        {orderDetails && (
          <div className="bg-paper-aged p-3 rounded-subtle space-y-1 text-body-small border border-divider">
            <div className="flex justify-between">
              <span className="text-text-secondary">Price</span>
              <span className="font-medium typewriter">{formatPrice(priceBps)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Quantity</span>
              <span className="font-medium typewriter">{formatTokenAmount(quantity!)}</span>
            </div>
            {side === 'buy' ? (
              <>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Cost</span>
                  <span className="font-medium typewriter">{formatUsdcAmount(orderDetails.cost)}</span>
                </div>
                {orderDetails.fee > 0n && (
                  <div className="flex justify-between text-text-tertiary">
                    <span>Est. Fee</span>
                    <span className="typewriter">{formatUsdcAmount(orderDetails.fee)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-divider">
                  <span className="font-medium text-text-primary">Total</span>
                  <span className="font-bold typewriter">{formatUsdcAmount(orderDetails.totalCost)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Gross</span>
                  <span className="font-medium typewriter">{formatUsdcAmount(orderDetails.cost)}</span>
                </div>
                {orderDetails.fee > 0n && (
                  <div className="flex justify-between text-text-tertiary">
                    <span>Est. Fee</span>
                    <span className="typewriter">-{formatUsdcAmount(orderDetails.fee)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-divider">
                  <span className="font-medium text-text-primary">You Receive</span>
                  <span className="font-bold typewriter text-support">{formatUsdcAmount(orderDetails.receive)}</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="p-3 bg-support/10 border border-support/30 rounded-subtle flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 text-support" />
            <span className="text-body-small text-support">Order submitted successfully!</span>
          </div>
        )}

        {/* Error Message */}
        {(error || submitError) && (
          <div className="p-3 bg-oppose/10 border border-oppose/30 rounded-subtle flex items-start gap-2">
            <WarningIcon className="w-5 h-5 text-oppose flex-shrink-0 mt-0.5" />
            <span className="text-body-small text-oppose">{error || submitError?.message}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !isConnected}
          className={`w-full py-3 rounded-subtle font-medium flex items-center justify-center gap-2 transition-colors ${
            side === 'buy'
              ? 'bg-support text-white hover:bg-support/90 disabled:bg-text-tertiary'
              : 'bg-oppose text-white hover:bg-oppose/90 disabled:bg-text-tertiary'
          } disabled:cursor-not-allowed`}
        >
          {isSubmitting && <SpinnerIcon className="w-4 h-4 animate-spin" />}
          {!isConnected
            ? 'Connect Wallet'
            : isSubmitting
            ? 'Submitting...'
            : `${side === 'buy' ? 'Buy' : 'Sell'} ${tokenLabel}`}
        </button>

        {/* Wallet Connection Warning */}
        {!isConnected && (
          <p className="text-center text-caption text-text-tertiary italic">
            Connect your wallet to place orders
          </p>
        )}
      </form>
    </div>
  );
}
