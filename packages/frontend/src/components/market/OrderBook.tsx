/**
 * OrderBook Component
 *
 * Displays the order book for a market with real-time updates.
 * Uses useOrderBook hook for on-chain data fetching.
 *
 * Requirements: 8.3, 8.6
 */

import { useState, useMemo } from 'react';
import { useOrderBook, type OrderBookLevel } from '../../lib/hooks/web3/useOrderBook';
import { formatPriceAsCents, fromUsdcUnits } from '../../lib/utils/price';
import { SpinnerIcon } from '../icons';

interface OrderBookProps {
  /** Market question ID (bytes32) */
  marketId?: `0x${string}`;
  /** YES token ID */
  yesTokenId?: bigint;
  /** NO token ID */
  noTokenId?: bigint;
  /** Order book depth to display */
  depth?: number;
  /** Legacy props for backward compatibility */
  yesOrders?: Array<{ price: number; amount: number }>;
  noOrders?: Array<{ price: number; amount: number }>;
}

/**
 * Format quantity for display
 */
function formatQuantity(quantity: bigint): string {
  const amount = fromUsdcUnits(quantity);
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`;
  }
  return amount.toFixed(0);
}

/**
 * Calculate the max quantity for bar width scaling
 */
function getMaxQuantity(levels: OrderBookLevel[]): bigint {
  if (levels.length === 0) return 1n;
  return levels.reduce((max, level) => 
    level.quantity > max ? level.quantity : max, 
    0n
  );
}

/**
 * Order book level row component - dossier style
 */
function OrderBookRow({
  level,
  maxQuantity,
  side,
}: {
  level: OrderBookLevel;
  maxQuantity: bigint;
  side: 'bid' | 'ask';
}) {
  const widthPercent = maxQuantity > 0n
    ? Math.min(100, Number((level.quantity * 100n) / maxQuantity))
    : 0;

  const bgColor = side === 'bid' ? 'bg-support/20' : 'bg-oppose/20';
  const textColor = side === 'bid' ? 'text-support' : 'text-oppose';

  return (
    <div className="relative flex justify-between text-body-small py-1.5 hover:bg-paper-aged cursor-pointer transition-colors">
      {/* Background bar */}
      <div
        className={`absolute inset-y-0 ${side === 'bid' ? 'right-0' : 'left-0'} ${bgColor}`}
        style={{ width: `${widthPercent}%` }}
      />
      {/* Content */}
      <span className={`relative font-medium typewriter ${textColor}`}>
        {formatPriceAsCents(level.price)}
      </span>
      <span className="relative text-text-secondary typewriter">
        {formatQuantity(level.quantity)}
        {level.orderCount > 1 && (
          <span className="text-caption text-text-tertiary ml-1">({level.orderCount})</span>
        )}
      </span>
    </div>
  );
}

export function OrderBook({
  marketId,
  yesTokenId,
  noTokenId,
  depth = 10,
  yesOrders,
  noOrders,
}: OrderBookProps) {
  const [activeTab, setActiveTab] = useState<'yes' | 'no'>('yes');

  // Determine which token ID to use based on active tab
  const activeTokenId = activeTab === 'yes' ? yesTokenId : noTokenId;

  // Use on-chain order book hook
  const { data: orderBookData, isLoading, isError, refetch } = useOrderBook(
    marketId,
    activeTokenId,
    { depth, watchEvents: true }
  );

  // Convert legacy props to OrderBookLevel format if provided
  const legacyLevels = useMemo(() => {
    const orders = activeTab === 'yes' ? yesOrders : noOrders;
    if (!orders) return null;
    
    return orders.map((order) => ({
      price: order.price,
      quantity: BigInt(Math.round(order.amount * 1e6)), // Convert to USDC units
      orderCount: 1,
    }));
  }, [activeTab, yesOrders, noOrders]);

  // Use on-chain data if available, otherwise fall back to legacy props
  const bids = orderBookData?.bids ?? legacyLevels ?? [];
  const asks = orderBookData?.asks ?? [];
  const midPrice = orderBookData?.midPrice;
  const spread = orderBookData?.spread;

  // Calculate max quantities for bar scaling
  const maxBidQuantity = getMaxQuantity(bids);
  const maxAskQuantity = getMaxQuantity(asks);

  // Check if we have on-chain data
  const hasOnChainData = !!marketId && !!activeTokenId;

  return (
    <div className="dossier-card rounded-subtle p-4">
      {/* Tab Selector */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('yes')}
          className={`flex-1 py-2 rounded-subtle font-medium transition-colors ${
            activeTab === 'yes'
              ? 'bg-support text-white'
              : 'bg-paper-aged text-text-secondary hover:bg-divider'
          }`}
        >
          Yes
        </button>
        <button
          onClick={() => setActiveTab('no')}
          className={`flex-1 py-2 rounded-subtle font-medium transition-colors ${
            activeTab === 'no'
              ? 'bg-oppose text-white'
              : 'bg-paper-aged text-text-secondary hover:bg-divider'
          }`}
        >
          No
        </button>
      </div>

      {/* Mid Price and Spread */}
      {midPrice !== null && midPrice !== undefined && (
        <div className="flex justify-between monospace-label text-text-tertiary mb-3 px-1">
          <span>Mid: {formatPriceAsCents(midPrice)}</span>
          {spread !== null && spread !== undefined && (
            <span>Spread: {formatPriceAsCents(spread)}</span>
          )}
        </div>
      )}

      {/* Loading State */}
      {hasOnChainData && isLoading && (
        <div className="flex items-center justify-center py-8">
          <SpinnerIcon className="w-6 h-6 animate-spin text-text-tertiary" />
        </div>
      )}

      {/* Error State */}
      {hasOnChainData && isError && (
        <div className="text-center py-4">
          <p className="text-body-small text-oppose mb-2">Failed to load order book</p>
          <button
            onClick={() => refetch()}
            className="text-body-small text-accent hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Order Book Content */}
      {(!hasOnChainData || (!isLoading && !isError)) && (
        <div className="space-y-1">
          {/* Header */}
          <div className="flex justify-between monospace-label text-text-tertiary pb-2 border-b border-divider">
            <span>Price</span>
            <span>Amount</span>
          </div>

          {/* Asks (Sell Orders) - Displayed in reverse order (highest first) */}
          {asks.length > 0 && (
            <div className="space-y-0.5 pb-2 border-b border-dashed border-divider">
              {[...asks].reverse().slice(0, depth).map((level, idx) => (
                <OrderBookRow
                  key={`ask-${idx}`}
                  level={level}
                  maxQuantity={maxAskQuantity}
                  side="ask"
                />
              ))}
            </div>
          )}

          {/* Spread Indicator */}
          {bids.length > 0 && asks.length > 0 && spread !== null && spread !== undefined && (
            <div className="text-center monospace-label text-text-tertiary py-1">
              Spread: {formatPriceAsCents(spread)}
            </div>
          )}

          {/* Bids (Buy Orders) */}
          {bids.length > 0 && (
            <div className="space-y-0.5 pt-2">
              {bids.slice(0, depth).map((level, idx) => (
                <OrderBookRow
                  key={`bid-${idx}`}
                  level={level}
                  maxQuantity={maxBidQuantity}
                  side="bid"
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {bids.length === 0 && asks.length === 0 && (
            <div className="text-center py-8 text-text-tertiary text-body-small italic">
              No orders yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}
