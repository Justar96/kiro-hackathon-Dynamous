/**
 * DebateResultsSummary displays the final results of a concluded debate.
 * Shows final prices, mind changes, persuasion delta, and winner side.
 * 
 * Requirements: 5.4 - Comprehensive results summary with persuasion metrics
 */

import type { Debate, MarketPrice, Side } from '@thesis/shared';

export interface DebateResultsSummaryProps {
  /** The concluded debate */
  debate: Debate;
  /** Final market price data */
  marketPrice: MarketPrice | null;
  /** Optional callback when user clicks to view detailed stats */
  onViewDetails?: () => void;
}

export interface DebateResultsData {
  finalSupportPrice: number;
  finalOpposePrice: number;
  totalMindChanges: number;
  netPersuasionDelta: number;
  winnerSide: Side | 'tie';
}

/**
 * Derives the winner side from market prices.
 * Support wins if supportPrice > 50, Oppose wins if < 50, tie if exactly 50.
 */
export function deriveWinnerSide(supportPrice: number): Side | 'tie' {
  if (supportPrice > 50) return 'support';
  if (supportPrice < 50) return 'oppose';
  return 'tie';
}

/**
 * Calculates the net persuasion delta (how much the market moved from 50/50).
 */
export function calculateNetPersuasionDelta(supportPrice: number): number {
  return Math.abs(supportPrice - 50);
}

/**
 * Extracts results data from market price for display.
 */
export function extractResultsData(marketPrice: MarketPrice | null): DebateResultsData {
  const supportPrice = marketPrice?.supportPrice ?? 50;
  const opposePrice = marketPrice?.opposePrice ?? 50;
  const mindChanges = marketPrice?.mindChangeCount ?? 0;
  
  return {
    finalSupportPrice: supportPrice,
    finalOpposePrice: opposePrice,
    totalMindChanges: mindChanges,
    netPersuasionDelta: calculateNetPersuasionDelta(supportPrice),
    winnerSide: deriveWinnerSide(supportPrice),
  };
}

/**
 * Validates that results data contains all required fields.
 */
export function isResultsComplete(results: DebateResultsData): boolean {
  return (
    typeof results.finalSupportPrice === 'number' &&
    typeof results.finalOpposePrice === 'number' &&
    typeof results.totalMindChanges === 'number' &&
    typeof results.netPersuasionDelta === 'number' &&
    (results.winnerSide === 'support' || results.winnerSide === 'oppose' || results.winnerSide === 'tie')
  );
}

export function DebateResultsSummary({
  debate,
  marketPrice,
  onViewDetails,
}: DebateResultsSummaryProps) {
  // Only show for concluded debates
  if (debate.status !== 'concluded') {
    return null;
  }
  
  const results = extractResultsData(marketPrice);
  const { finalSupportPrice, finalOpposePrice, totalMindChanges, netPersuasionDelta, winnerSide } = results;
  
  return (
    <div 
      className="debate-results-summary bg-gradient-to-br from-gray-50 to-white border border-divider rounded-lg p-6 shadow-sm"
      data-testid="debate-results-summary"
      role="region"
      aria-label="Debate results summary"
    >
      {/* Winner Banner */}
      <WinnerBanner winnerSide={winnerSide} />
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <StatCard
          label="Support"
          value={`${Math.round(finalSupportPrice)}%`}
          color="support"
          testId="final-support-price"
        />
        <StatCard
          label="Oppose"
          value={`${Math.round(finalOpposePrice)}%`}
          color="oppose"
          testId="final-oppose-price"
        />
        <StatCard
          label="Mind Changes"
          value={totalMindChanges.toString()}
          color="neutral"
          testId="total-mind-changes"
        />
        <StatCard
          label="Persuasion Δ"
          value={`${netPersuasionDelta.toFixed(1)}%`}
          color="accent"
          testId="net-persuasion-delta"
        />
      </div>
      
      {/* Persuasion Bar */}
      <div className="mt-6">
        <PersuasionBar supportPrice={finalSupportPrice} />
      </div>
      
      {/* View Details Button */}
      {onViewDetails && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onViewDetails}
            className="text-sm text-accent hover:text-accent-hover underline underline-offset-2"
          >
            View detailed statistics
          </button>
        </div>
      )}
    </div>
  );
}

interface WinnerBannerProps {
  winnerSide: Side | 'tie';
}

function WinnerBanner({ winnerSide }: WinnerBannerProps) {
  const config = getWinnerConfig(winnerSide);
  
  return (
    <div 
      className={`text-center py-4 px-6 rounded-lg ${config.bgClass}`}
      data-testid="winner-banner"
      data-winner={winnerSide}
    >
      <div className="flex items-center justify-center gap-2">
        {config.icon}
        <h3 className={`text-lg font-bold ${config.textClass}`}>
          {config.title}
        </h3>
      </div>
      <p className={`text-sm mt-1 ${config.subtextClass}`}>
        {config.subtitle}
      </p>
    </div>
  );
}

function getWinnerConfig(winnerSide: Side | 'tie') {
  switch (winnerSide) {
    case 'support':
      return {
        title: 'Support Wins!',
        subtitle: 'The audience was persuaded to support the resolution',
        bgClass: 'bg-green-50 border border-green-200',
        textClass: 'text-green-700',
        subtextClass: 'text-green-600',
        icon: <TrophyIcon className="w-6 h-6 text-green-500" />,
      };
    case 'oppose':
      return {
        title: 'Oppose Wins!',
        subtitle: 'The audience was persuaded to oppose the resolution',
        bgClass: 'bg-red-50 border border-red-200',
        textClass: 'text-red-700',
        subtextClass: 'text-red-600',
        icon: <TrophyIcon className="w-6 h-6 text-red-500" />,
      };
    case 'tie':
    default:
      return {
        title: 'Tie!',
        subtitle: 'The audience remained evenly split',
        bgClass: 'bg-gray-50 border border-gray-200',
        textClass: 'text-gray-700',
        subtextClass: 'text-gray-600',
        icon: <BalanceIcon className="w-6 h-6 text-gray-500" />,
      };
  }
}

interface StatCardProps {
  label: string;
  value: string;
  color: 'support' | 'oppose' | 'neutral' | 'accent';
  testId: string;
}

function StatCard({ label, value, color, testId }: StatCardProps) {
  const colorClasses = {
    support: 'text-green-600',
    oppose: 'text-red-600',
    neutral: 'text-text-primary',
    accent: 'text-accent',
  };
  
  return (
    <div 
      className="text-center p-3 bg-white rounded-lg border border-gray-100"
      data-testid={testId}
    >
      <p className="text-xs text-text-tertiary uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={`text-2xl font-bold ${colorClasses[color]}`}>
        {value}
      </p>
    </div>
  );
}

interface PersuasionBarProps {
  supportPrice: number;
}

function PersuasionBar({ supportPrice }: PersuasionBarProps) {
  const opposePrice = 100 - supportPrice;
  
  return (
    <div className="space-y-2" data-testid="persuasion-bar">
      <div className="flex justify-between text-xs text-text-tertiary">
        <span>Support</span>
        <span>Oppose</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
        <div 
          className="bg-green-500 transition-all duration-500"
          style={{ width: `${supportPrice}%` }}
          aria-label={`Support: ${Math.round(supportPrice)}%`}
        />
        <div 
          className="bg-red-500 transition-all duration-500"
          style={{ width: `${opposePrice}%` }}
          aria-label={`Oppose: ${Math.round(opposePrice)}%`}
        />
      </div>
      <div className="flex justify-between text-sm font-medium">
        <span className="text-green-600">{Math.round(supportPrice)}%</span>
        <span className="text-red-600">{Math.round(opposePrice)}%</span>
      </div>
    </div>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" 
      />
    </svg>
  );
}

function BalanceIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" 
      />
    </svg>
  );
}

export default DebateResultsSummary;
