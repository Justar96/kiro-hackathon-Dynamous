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
 * Order book level row component
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

  const bgColor = side === 'bid' ? 'bg-green-100' : 'bg-red-100';
  const textColor = side === 'bid' ? 'text-green-700' : 'text-red-700';

  return (
    <div className="relative flex justify-between text-sm py-1 hover:bg-gray-50 cursor-pointer">
      {/* Background bar */}
      <div
        className={`absolute inset-y-0 ${side === 'bid' ? 'right-0' : 'left-0'} ${bgColor} opacity-30`}
        style={{ width: `${widthPercent}%` }}
      />
      {/* Content */}
      <span className={`relative font-medium ${textColor}`}>
        {formatPriceAsCents(level.price)}
      </span>
      <span className="relative text-gray-600">
        {formatQuantity(level.quantity)}
        {level.orderCount > 1 && (
          <span className="text-xs text-gray-400 ml-1">({level.orderCount})</span>
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
    <div className="border border-gray-200 rounded-lg p-4">
      {/* Tab Selector */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('yes')}
          className={`flex-1 py-2 rounded font-medium transition-colors ${
            activeTab === 'yes'
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Yes
        </button>
        <button
          onClick={() => setActiveTab('no')}
          className={`flex-1 py-2 rounded font-medium transition-colors ${
            activeTab === 'no'
              ? 'bg-red-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          No
        </button>
      </div>

      {/* Mid Price and Spread */}
      {midPrice !== null && midPrice !== undefined && (
        <div className="flex justify-between text-xs text-gray-500 mb-2 px-1">
          <span>Mid: {formatPriceAsCents(midPrice)}</span>
          {spread !== null && spread !== undefined && (
            <span>Spread: {formatPriceAsCents(spread)}</span>
          )}
        </div>
      )}

      {/* Loading State */}
      {hasOnChainData && isLoading && (
        <div className="flex items-center justify-center py-8">
          <SpinnerIcon className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Error State */}
      {hasOnChainData && isError && (
        <div className="text-center py-4">
          <p className="text-sm text-red-500 mb-2">Failed to load order book</p>
          <button
            onClick={() => refetch()}
            className="text-sm text-blue-600 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Order Book Content */}
      {(!hasOnChainData || (!isLoading && !isError)) && (
        <div className="space-y-1">
          {/* Header */}
          <div className="flex justify-between text-xs text-gray-500 font-medium pb-2 border-b">
            <span>Price</span>
            <span>Amount</span>
          </div>

          {/* Asks (Sell Orders) - Displayed in reverse order (highest first) */}
          {asks.length > 0 && (
            <div className="space-y-0.5 pb-2 border-b border-dashed">
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
            <div className="text-center text-xs text-gray-400 py-1">
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
            <div className="text-center py-8 text-gray-400 text-sm">
              No orders yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}
