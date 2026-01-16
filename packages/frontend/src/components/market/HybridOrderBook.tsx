/**
 * HybridOrderBook Component
 *
 * Displays the order book for hybrid CLOB trading with real-time SSE updates.
 * Shows bid/ask levels with depth and spread information.
 * Integrates with useOrderBook hook from trading hooks.
 *
 * Requirements: 9.5
 */

import { useMemo } from 'react';
import { type Hex } from 'viem';
import {
  useOrderBook,
  type PriceLevel,
  type ConnectionStatus,
} from '../../lib/hooks/trading/useOrderBook';
import { SpinnerIcon, WarningIcon } from '../icons';

// ============================================
// Types
// ============================================

interface HybridOrderBookProps {
  /** Market ID (bytes32) */
  marketId: Hex;
  /** Token ID for the outcome */
  tokenId: bigint;
  /** Token label (e.g., "YES" or "NO") */
  tokenLabel?: string;
  /** Order book depth to display (default: 10) */
  depth?: number;
  /** Enable SSE subscription (default: true) */
  enableSSE?: boolean;
  /** Callback when a price level is clicked */
  onPriceClick?: (price: string, side: 'bid' | 'ask') => void;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format price from basis points to display string
 */
function formatPrice(priceBps: string): string {
  const cents = Number(BigInt(priceBps)) / 100;
  return `${cents.toFixed(0)}¢`;
}

/**
 * Format quantity for display
 */
function formatQuantity(quantity: string): string {
  const num = Number(BigInt(quantity)) / 1e18; // Assuming 18 decimals for tokens
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toFixed(0);
}

/**
 * Calculate the max quantity for bar width scaling
 */
function getMaxQuantity(levels: PriceLevel[]): bigint {
  if (levels.length === 0) return 1n;
  return levels.reduce((max, level) => {
    const qty = BigInt(level.quantity);
    return qty > max ? qty : max;
  }, 0n);
}

/**
 * Get connection status display info
 */
function getConnectionStatusInfo(status: ConnectionStatus): {
  color: string;
  label: string;
} {
  switch (status) {
    case 'connected':
      return { color: 'bg-support', label: 'Live' };
    case 'connecting':
      return { color: 'bg-accent', label: 'Connecting' };
    case 'disconnected':
      return { color: 'bg-text-tertiary', label: 'Offline' };
    case 'error':
      return { color: 'bg-oppose', label: 'Error' };
  }
}

// ============================================
// Sub-Components
// ============================================

/**
 * Order book level row component
 */
function OrderBookRow({
  level,
  maxQuantity,
  side,
  onClick,
}: {
  level: PriceLevel;
  maxQuantity: bigint;
  side: 'bid' | 'ask';
  onClick?: () => void;
}) {
  const quantity = BigInt(level.quantity);
  const widthPercent = maxQuantity > 0n
    ? Math.min(100, Number((quantity * 100n) / maxQuantity))
    : 0;

  const bgColor = side === 'bid' ? 'bg-support/20' : 'bg-oppose/20';
  const textColor = side === 'bid' ? 'text-support' : 'text-oppose';

  return (
    <div
      className={`relative flex justify-between text-body-small py-1.5 hover:bg-paper-aged transition-colors ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {/* Background bar */}
      <div
        className={`absolute inset-y-0 ${side === 'bid' ? 'right-0' : 'left-0'} ${bgColor}`}
        style={{ width: `${widthPercent}%` }}
      />
      {/* Content */}
      <span className={`relative font-medium typewriter ${textColor}`}>
        {formatPrice(level.price)}
      </span>
      <span className="relative text-text-secondary typewriter">
        {formatQuantity(level.quantity)}
        {level.orderCount && level.orderCount > 1 && (
          <span className="text-caption text-text-tertiary ml-1">
            ({level.orderCount})
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * Connection status indicator
 */
function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  const { color, label } = getConnectionStatusInfo(status);

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-caption text-text-tertiary">{label}</span>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function HybridOrderBook({
  marketId,
  tokenId,
  tokenLabel = 'Token',
  depth = 10,
  enableSSE = true,
  onPriceClick,
}: HybridOrderBookProps) {
  const {
    bids,
    asks,
    spread,
    bestBid,
    bestAsk,
    isConnected,
    connectionStatus,
    isLoading,
    error,
    reconnect,
  } = useOrderBook(marketId, tokenId, { depth, enableSSE });

  // Calculate max quantities for bar scaling
  const maxBidQuantity = useMemo(() => getMaxQuantity(bids), [bids]);
  const maxAskQuantity = useMemo(() => getMaxQuantity(asks), [asks]);

  // Limit displayed levels to depth
  const displayedBids = useMemo(() => bids.slice(0, depth), [bids, depth]);
  const displayedAsks = useMemo(() => asks.slice(0, depth), [asks, depth]);

  // Calculate mid price
  const midPrice = useMemo(() => {
    if (!bestBid || !bestAsk) return null;
    const bid = BigInt(bestBid);
    const ask = BigInt(bestAsk);
    return ((bid + ask) / 2n).toString();
  }, [bestBid, bestAsk]);

  return (
    <div className="dossier-card rounded-subtle p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-body font-medium text-text-primary">
          {tokenLabel} Order Book
        </h3>
        <ConnectionIndicator status={connectionStatus} />
      </div>

      {/* Mid Price and Spread */}
      {(midPrice || spread) && (
        <div className="flex justify-between monospace-label text-text-tertiary mb-3 px-1">
          {midPrice && <span>Mid: {formatPrice(midPrice)}</span>}
          {spread && <span>Spread: {formatPrice(spread)}</span>}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <SpinnerIcon className="w-6 h-6 animate-spin text-text-tertiary" />
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="text-center py-4">
          <div className="flex items-center justify-center gap-2 text-oppose mb-2">
            <WarningIcon className="w-5 h-5" />
            <span className="text-body-small">Failed to load order book</span>
          </div>
          <button
            onClick={reconnect}
            className="text-body-small text-accent hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Order Book Content */}
      {!isLoading && !error && (
        <div className="space-y-1">
          {/* Header */}
          <div className="flex justify-between monospace-label text-text-tertiary pb-2 border-b border-divider">
            <span>Price</span>
            <span>Quantity</span>
          </div>

          {/* Asks (Sell Orders) - Displayed in reverse order (highest first) */}
          {displayedAsks.length > 0 && (
            <div className="space-y-0.5 pb-2 border-b border-dashed border-divider">
              {[...displayedAsks].reverse().map((level, idx) => (
                <OrderBookRow
                  key={`ask-${level.price}-${idx}`}
                  level={level}
                  maxQuantity={maxAskQuantity}
                  side="ask"
                  onClick={onPriceClick ? () => onPriceClick(level.price, 'ask') : undefined}
                />
              ))}
            </div>
          )}

          {/* Spread Indicator */}
          {displayedBids.length > 0 && displayedAsks.length > 0 && spread && (
            <div className="text-center monospace-label text-text-tertiary py-1">
              Spread: {formatPrice(spread)}
            </div>
          )}

          {/* Bids (Buy Orders) */}
          {displayedBids.length > 0 && (
            <div className="space-y-0.5 pt-2">
              {displayedBids.map((level, idx) => (
                <OrderBookRow
                  key={`bid-${level.price}-${idx}`}
                  level={level}
                  maxQuantity={maxBidQuantity}
                  side="bid"
                  onClick={onPriceClick ? () => onPriceClick(level.price, 'bid') : undefined}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {displayedBids.length === 0 && displayedAsks.length === 0 && (
            <div className="text-center py-8 text-text-tertiary text-body-small italic">
              No orders yet
            </div>
          )}
        </div>
      )}

      {/* Reconnect Button (when disconnected) */}
      {!isConnected && connectionStatus !== 'connecting' && !isLoading && (
        <div className="mt-3 pt-3 border-t border-divider">
          <button
            onClick={reconnect}
            className="w-full py-2 text-body-small text-accent hover:bg-paper-aged rounded-subtle transition-colors"
          >
            Reconnect to live updates
          </button>
        </div>
      )}
    </div>
  );
}
