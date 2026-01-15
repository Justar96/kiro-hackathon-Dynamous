/**
 * PortfolioView Component
 *
 * Displays user's positions across all markets with P&L calculations.
 * Uses on-chain hooks for position data and open orders.
 *
 * Requirements: 7.1, 7.4, 7.5
 */

import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useAccount } from 'wagmi';
import { useWeb3Positions, type Position } from '../../lib/hooks/web3/usePositions';
import { useOpenOrders, type OpenOrder } from '../../lib/hooks/web3/useOpenOrders';
import { useOrderBookActions } from '../../lib/hooks/web3/useOrderBookActions';
import { fromUsdcUnits, formatPriceAsCents } from '../../lib/utils/price';
import { parseContractError, getSuggestedAction } from '../../lib/errors';
import { SpinnerIcon, WarningIcon, XIcon, ChartIcon } from '../icons';

/**
 * Legacy position interface for backward compatibility
 */
interface LegacyPosition {
  marketId: string;
  question: string;
  side: 'yes' | 'no';
  shares: number;
  avgPrice: number;
  currentPrice: number;
}

interface PortfolioViewProps {
  /** Legacy positions for backward compatibility */
  positions?: LegacyPosition[];
  /** Legacy total value for backward compatibility */
  totalValue?: number;
}

/**
 * Position card component
 */
function PositionCard({ position }: { position: Position }) {
  const yesValue = Number(position.yesBalance) * position.currentPrice;
  const noValue = Number(position.noBalance) * (1 - position.currentPrice);
  const totalValue = yesValue + noValue;
  const pnl = position.unrealizedPnL;
  const pnlPercent = position.avgEntryPrice > 0
    ? ((position.currentPrice - position.avgEntryPrice) / position.avgEntryPrice * 100)
    : 0;

  return (
    <Link
      to="/markets/$marketId"
      params={{ marketId: position.marketAddress }}
      className="block border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-colors"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h4 className="font-medium text-gray-900 line-clamp-2">{position.marketQuestion}</h4>
          <div className="flex gap-2 mt-1">
            {position.yesBalance > 0n && (
              <span className="inline-block px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">
                YES: {fromUsdcUnits(position.yesBalance).toFixed(2)}
              </span>
            )}
            {position.noBalance > 0n && (
              <span className="inline-block px-2 py-0.5 text-xs rounded bg-red-100 text-red-700">
                NO: {fromUsdcUnits(position.noBalance).toFixed(2)}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold">${(totalValue / 1e6).toFixed(2)}</div>
          <div className={`text-sm ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pnlPercent.toFixed(1)}%)
          </div>
        </div>
      </div>
      <div className="flex gap-4 text-sm text-gray-600">
        <span>Avg: {formatPriceAsCents(position.avgEntryPrice)}</span>
        <span>Current: {formatPriceAsCents(position.currentPrice)}</span>
        <span className={`capitalize ${
          position.marketState === 'ACTIVE' ? 'text-green-600' :
          position.marketState === 'RESOLVED' ? 'text-gray-600' :
          'text-amber-600'
        }`}>
          {position.marketState.toLowerCase()}
        </span>
      </div>
    </Link>
  );
}

/**
 * Open order row component
 */
function OpenOrderRow({
  order,
  onCancel,
  isCancelling,
}: {
  order: OpenOrder;
  onCancel: (orderId: bigint) => void;
  isCancelling: boolean;
}) {
  const remaining = order.quantity - order.filled;
  const fillPercent = order.quantity > 0n
    ? Number((order.filled * 100n) / order.quantity)
    : 0;

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs rounded font-medium ${
            order.side === 'BUY'
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {order.side}
          </span>
          <span className={`px-2 py-0.5 text-xs rounded ${
            order.tokenType === 'YES'
              ? 'bg-green-50 text-green-600'
              : 'bg-red-50 text-red-600'
          }`}>
            {order.tokenType}
          </span>
          <span className="text-sm font-medium">{formatPriceAsCents(order.price)}</span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {fromUsdcUnits(remaining).toFixed(2)} remaining
          {fillPercent > 0 && ` (${fillPercent}% filled)`}
        </div>
      </div>
      <button
        onClick={() => onCancel(order.orderId)}
        disabled={isCancelling}
        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
        title="Cancel order"
      >
        {isCancelling ? (
          <SpinnerIcon className="w-4 h-4 animate-spin" />
        ) : (
          <XIcon className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}

export function PortfolioView({ positions: legacyPositions, totalValue: legacyTotalValue }: PortfolioViewProps) {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<'positions' | 'orders'>('positions');
  const [cancellingOrderId, setCancellingOrderId] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Use on-chain hooks
  const { positions, portfolio, isLoading: isPositionsLoading } = useWeb3Positions(address);
  const { orders, activeOrderCount, isLoading: isOrdersLoading } = useOpenOrders(address);
  const orderBookActions = useOrderBookActions();

  // Handle order cancellation
  const handleCancelOrder = async (orderId: bigint) => {
    setError(null);
    setCancellingOrderId(orderId);

    try {
      await orderBookActions.cancelOrder(orderId);
    } catch (err) {
      const parsed = parseContractError(err);
      const suggestion = getSuggestedAction(parsed);
      setError(suggestion ? `${parsed.message}. ${suggestion}` : parsed.message);
    } finally {
      setCancellingOrderId(null);
    }
  };

  // Use legacy data if provided and no on-chain data
  const displayPositions = positions.length > 0 ? positions : [];
  const displayTotalValue = portfolio.totalValue > 0n
    ? fromUsdcUnits(portfolio.totalValue)
    : (legacyTotalValue ?? 0);
  const displayTotalPnL = portfolio.totalPnL;

  // Filter active orders
  const activeOrders = orders.filter(o => o.active && o.remaining > 0n);

  // Not connected state
  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <ChartIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Connect Your Wallet</h3>
        <p className="text-gray-500">Connect your wallet to view your portfolio</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Portfolio Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="text-sm text-gray-600">Total Portfolio Value</div>
        <div className="text-3xl font-bold text-gray-900">${displayTotalValue.toFixed(2)}</div>
        {displayTotalPnL !== 0 && (
          <div className={`text-sm mt-1 ${displayTotalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {displayTotalPnL >= 0 ? '+' : ''}${displayTotalPnL.toFixed(2)} unrealized P&L
          </div>
        )}
      </div>

      {/* Tab Selector */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('positions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'positions'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Positions ({displayPositions.length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'orders'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Open Orders ({activeOrderCount})
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <WarningIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Positions Tab */}
      {activeTab === 'positions' && (
        <div className="space-y-2">
          {isPositionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <SpinnerIcon className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : displayPositions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ChartIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p>No active positions</p>
              <Link to="/" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
                Browse markets
              </Link>
            </div>
          ) : (
            displayPositions.map((position) => (
              <PositionCard key={position.marketAddress} position={position} />
            ))
          )}

          {/* Legacy positions fallback */}
          {displayPositions.length === 0 && legacyPositions && legacyPositions.length > 0 && (
            legacyPositions.map((position) => {
              const value = position.shares * position.currentPrice;
              const cost = position.shares * position.avgPrice;
              const pnl = value - cost;
              const pnlPercent = ((pnl / cost) * 100).toFixed(2);

              return (
                <Link
                  key={position.marketId}
                  to="/markets/$marketId"
                  params={{ marketId: position.marketId }}
                  className="block border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{position.question}</h4>
                      <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded ${
                        position.side === 'yes'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {position.side.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">${value.toFixed(2)}</div>
                      <div className={`text-sm ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pnlPercent}%)
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4 text-sm text-gray-600">
                    <span>{position.shares} shares</span>
                    <span>Avg: {Math.round(position.avgPrice * 100)}¢</span>
                    <span>Current: {Math.round(position.currentPrice * 100)}¢</span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      )}

      {/* Open Orders Tab */}
      {activeTab === 'orders' && (
        <div className="border border-gray-200 rounded-lg">
          {isOrdersLoading ? (
            <div className="flex items-center justify-center py-8">
              <SpinnerIcon className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : activeOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No open orders</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 px-4">
              {activeOrders.map((order) => (
                <OpenOrderRow
                  key={order.orderId.toString()}
                  order={order}
                  onCancel={handleCancelOrder}
                  isCancelling={cancellingOrderId === order.orderId}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
