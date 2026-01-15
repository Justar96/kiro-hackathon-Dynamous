/**
 * Market Detail Page
 *
 * Displays a single market with order book, trading interface, and real-time updates.
 * Uses on-chain hooks for all contract interactions.
 *
 * Requirements: 8.3, 8.6, 10.1, 10.4, 10.5
 */

import { createFileRoute } from '@tanstack/react-router';
import { useAccount } from 'wagmi';
import { OrderBook, TradingPanel, MarketChart, SettlementPanel } from '../components/market';
import { useMarket } from '../lib/hooks/web3/useMarket';
import { useOrderBook } from '../lib/hooks/web3/useOrderBook';
import { useTokenBalances } from '../lib/hooks/web3/useTokenBalances';
import { SpinnerIcon, WarningIcon, ClockIcon } from '../components';
import { formatPriceAsPercentage, fromUsdcUnits } from '../lib/utils/price';

export const Route = createFileRoute('/markets/$marketId')({
  component: MarketDetailPage,
});

/**
 * Market state badge component
 */
function MarketStateBadge({ state }: { state: string }) {
  const config = {
    ACTIVE: { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' },
    PENDING_RESOLUTION: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending Resolution' },
    DISPUTED: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Disputed' },
    RESOLVED: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Resolved' },
  }[state] ?? { bg: 'bg-gray-100', text: 'text-gray-700', label: state };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

/**
 * Market outcome badge component
 */
function MarketOutcomeBadge({ outcome }: { outcome: string }) {
  if (outcome === 'UNRESOLVED') return null;

  const config = {
    YES: { bg: 'bg-green-500', text: 'text-white', label: 'Resolved: YES' },
    NO: { bg: 'bg-red-500', text: 'text-white', label: 'Resolved: NO' },
    INVALID: { bg: 'bg-gray-500', text: 'text-white', label: 'Resolved: INVALID' },
  }[outcome] ?? { bg: 'bg-gray-500', text: 'text-white', label: outcome };

  return (
    <span className={`px-3 py-1 rounded text-sm font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

/**
 * User position display component
 */
function UserPositionCard({
  yesBalance,
  noBalance,
  currentPrice,
}: {
  yesBalance: bigint;
  noBalance: bigint;
  currentPrice: number;
}) {
  const hasPosition = yesBalance > 0n || noBalance > 0n;

  if (!hasPosition) return null;

  const yesValue = Number(yesBalance) * currentPrice;
  const noValue = Number(noBalance) * (1 - currentPrice);
  const totalValue = yesValue + noValue;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <h3 className="text-sm font-medium text-blue-800 mb-2">Your Position</h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        {yesBalance > 0n && (
          <div>
            <span className="text-gray-600">YES tokens:</span>
            <span className="ml-2 font-medium text-green-700">
              {fromUsdcUnits(yesBalance).toFixed(2)}
            </span>
          </div>
        )}
        {noBalance > 0n && (
          <div>
            <span className="text-gray-600">NO tokens:</span>
            <span className="ml-2 font-medium text-red-700">
              {fromUsdcUnits(noBalance).toFixed(2)}
            </span>
          </div>
        )}
      </div>
      <div className="mt-2 pt-2 border-t border-blue-200">
        <span className="text-gray-600 text-sm">Est. Value:</span>
        <span className="ml-2 font-medium">${(totalValue / 1e6).toFixed(2)}</span>
      </div>
    </div>
  );
}

function MarketDetailPage() {
  const { marketId } = Route.useParams();
  const { isConnected } = useAccount();

  // Treat marketId as the market contract address
  const marketAddress = marketId as `0x${string}`;

  // Fetch market data from chain
  const { data: market, isLoading: isMarketLoading, isError: isMarketError } = useMarket(marketAddress);

  // Fetch order book data for YES token
  const { data: yesOrderBook } = useOrderBook(
    market?.questionId,
    market?.yesTokenId,
    { depth: 10, watchEvents: true }
  );

  // Fetch order book data for NO token
  const { data: noOrderBook } = useOrderBook(
    market?.questionId,
    market?.noTokenId,
    { depth: 10, watchEvents: true }
  );

  // Fetch user's token balances
  const { yesBalance, noBalance } = useTokenBalances({
    yesTokenId: market?.yesTokenId,
    noTokenId: market?.noTokenId,
  });

  // Calculate prices from order book
  const yesPrice = yesOrderBook?.midPrice ?? 0.5;
  const noPrice = noOrderBook?.midPrice ?? (1 - yesPrice);

  // Format dates
  const endDate = market?.endTime
    ? market.endTime.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const isExpired = market?.endTime ? market.endTime < new Date() : false;
  const isResolved = market?.state === 'RESOLVED';
  const canTrade = market?.state === 'ACTIVE' && !isExpired;

  // Loading state
  if (isMarketLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <SpinnerIcon className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading market...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (isMarketError || !market) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <WarningIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Market Not Found</h2>
          <p className="text-gray-600">
            The market you're looking for doesn't exist or couldn't be loaded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Market Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <MarketStateBadge state={market.state} />
          <MarketOutcomeBadge outcome={market.outcome} />
        </div>
        <h1 className="text-3xl font-bold mt-2">{market.question}</h1>
        
        {/* Market Metadata */}
        <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <ClockIcon className="w-4 h-4" />
            <span>Ends: {endDate}</span>
            {isExpired && !isResolved && (
              <span className="text-amber-600 font-medium">(Expired)</span>
            )}
          </div>
          <div>
            <span>YES: </span>
            <span className="font-medium text-green-600">{formatPriceAsPercentage(yesPrice)}</span>
          </div>
          <div>
            <span>NO: </span>
            <span className="font-medium text-red-600">{formatPriceAsPercentage(noPrice)}</span>
          </div>
        </div>

        {/* Resolution Criteria */}
        {market.resolutionCriteria && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-1">Resolution Criteria</h3>
            <p className="text-sm text-gray-600">{market.resolutionCriteria}</p>
          </div>
        )}
      </div>

      {/* User Position */}
      {isConnected && (
        <UserPositionCard
          yesBalance={yesBalance}
          noBalance={noBalance}
          currentPrice={yesPrice}
        />
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Chart and Order Book */}
        <div className="lg:col-span-2 space-y-6">
          {/* Price Chart */}
          <MarketChart marketId={marketId} />

          {/* Order Book */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Order Book</h2>
            <OrderBook
              marketId={market.questionId}
              yesTokenId={market.yesTokenId}
              noTokenId={market.noTokenId}
              depth={10}
            />
          </div>
        </div>

        {/* Right Column - Trading Panel or Settlement */}
        <div>
          {canTrade ? (
            <TradingPanel
              marketId={marketId}
              marketAddress={marketAddress}
              questionId={market.questionId}
              yesTokenId={market.yesTokenId}
              noTokenId={market.noTokenId}
              yesPrice={yesPrice}
              noPrice={noPrice}
            />
          ) : isResolved ? (
            <SettlementPanel
              marketAddress={marketAddress}
              marketState={market.state}
              outcome={market.outcome}
              yesTokenId={market.yesTokenId}
              noTokenId={market.noTokenId}
              resolutionTime={market.resolutionTime}
              disputeEndTime={market.disputeEndTime}
            />
          ) : (
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Trading</h3>
              {isExpired ? (
                <div className="text-center py-8">
                  <ClockIcon className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                  <p className="text-gray-600 mb-2">This market has expired.</p>
                  <p className="text-sm text-gray-500">Awaiting resolution.</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <WarningIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">Trading is not available.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
