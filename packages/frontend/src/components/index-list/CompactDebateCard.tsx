import { Link } from '@tanstack/react-router';
import type { Debate, MarketPrice } from '@debate-platform/shared';
import { useDebateLinkPrefetch } from '../../lib/usePrefetch';
import { InlineQuickStance } from './InlineQuickStance';

/**
 * Card configuration for consistent feed density
 * Requirements: 2.7 - Maximum height constraint for feed density
 */
export const CARD_CONFIG = {
  minHeight: 88,
  maxHeight: 140,
  padding: 12,
  gap: 8,
} as const;

export interface CompactDebateCardProps {
  debate: Debate;
  marketPrice?: MarketPrice | null;
  userStance?: number | null;
  onQuickStance?: (debateId: string, side: 'support' | 'oppose') => void;
  isAuthenticated?: boolean;
  isPrefetching?: boolean;
}

/**
 * CompactDebateCard - A compact, Reddit-style card for the debate feed.
 * Shows resolution, status, stance bar, mind changes, and time info.
 * 
 * Requirements: 2.1-2.8 - Compact Debate Card Design
 */
export function CompactDebateCard({
  debate,
  marketPrice,
  userStance,
  onQuickStance,
  isAuthenticated = false,
  isPrefetching = false,
}: CompactDebateCardProps) {
  const supportPercent = marketPrice?.supportPrice ?? 50;
  const opposePercent = marketPrice?.opposePrice ?? 50;
  const mindChangeCount = marketPrice?.mindChangeCount ?? 0;
  const needsOpponent = debate.status === 'active' && !debate.opposeDebaterId;
  const isLive = debate.status === 'active' && debate.opposeDebaterId !== null;
  const isConcluded = debate.status === 'concluded';

  const prefetchProps = useDebateLinkPrefetch(debate.id);
  const timeAgo = formatTimeAgo(debate.createdAt);

  const resolutionId = `compact-resolution-${debate.id}`;

  return (
    <Link
      to="/debates/$debateId"
      params={{ debateId: debate.id }}
      className="group block"
      {...prefetchProps}
    >
      <article
        className="relative bg-paper border-b border-divider hover:bg-page-bg/50 active:bg-page-bg transition-colors duration-150"
        style={{
          padding: `${CARD_CONFIG.padding}px ${CARD_CONFIG.padding + 4}px`,
        }}
        aria-labelledby={resolutionId}
        data-testid="compact-debate-card"
      >
        <div className="flex gap-3">
          {/* Left: Stance indicator bar (vertical) */}
          <div className="flex-shrink-0 w-1 rounded-full overflow-hidden bg-divider self-stretch min-h-[48px]">
            <div 
              className="w-full bg-support transition-all duration-300"
              style={{ height: `${supportPercent}%` }}
            />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Top meta row */}
            <div className="flex items-center gap-2 mb-1.5 text-xs">
              {/* Status */}
              <StatusBadge 
                needsOpponent={needsOpponent} 
                isLive={isLive} 
                isConcluded={isConcluded}
                currentRound={debate.currentRound}
              />
              <span className="text-text-tertiary">•</span>
              <span className="text-text-tertiary">{timeAgo}</span>
              {mindChangeCount > 0 && (
                <>
                  <span className="text-text-tertiary">•</span>
                  <span className="text-accent font-medium">
                    {mindChangeCount} Δ
                  </span>
                </>
              )}
            </div>

            {/* Resolution */}
            <h3
              id={resolutionId}
              className="text-sm text-text-primary leading-snug line-clamp-2 group-hover:text-accent transition-colors"
              data-testid="resolution-text"
            >
              {debate.resolution}
            </h3>

            {/* Bottom row: Stats */}
            <div className="flex items-center gap-4 mt-2">
              {/* Stance percentages */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-support font-medium tabular-nums">{supportPercent}%</span>
                <span className="text-text-tertiary">/</span>
                <span className="text-oppose font-medium tabular-nums">{opposePercent}%</span>
              </div>

              {/* Round progress for active debates */}
              {!isConcluded && !needsOpponent && (
                <span className="text-xs text-text-tertiary">
                  R{debate.currentRound}/3
                </span>
              )}

              {/* Quick stance buttons */}
              {isAuthenticated && onQuickStance && (
                <div
                  className="ml-auto flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  role="group"
                  aria-label="Quick stance buttons"
                >
                  <InlineQuickStance
                    debateId={debate.id}
                    marketPrice={marketPrice}
                    userStance={userStance}
                    onStance={onQuickStance}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Prefetching indicator */}
        {isPrefetching && (
          <div className="absolute top-3 right-3 w-1.5 h-1.5 bg-accent/40 rounded-full animate-pulse" />
        )}
      </article>
    </Link>
  );
}

/**
 * Status badge component
 */
function StatusBadge({ 
  needsOpponent, 
  isLive, 
  isConcluded,
  currentRound 
}: { 
  needsOpponent: boolean; 
  isLive: boolean; 
  isConcluded: boolean;
  currentRound: number;
}) {
  if (needsOpponent) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
        Seeking opponent
      </span>
    );
  }
  
  if (isConcluded) {
    return <span className="text-text-tertiary">Resolved</span>;
  }
  
  if (isLive) {
    return (
      <span className="inline-flex items-center gap-1 text-green-600 font-medium">
        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
        Live
      </span>
    );
  }
  
  return <span className="text-text-secondary">Active</span>;
}

/**
 * Format time ago string
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const created = new Date(date);
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return created.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Get status badge configuration based on debate state
 * Requirements: 2.4 - Display debate status
 */
function getStatusBadge(
  debate: Debate,
  needsOpponent: boolean,
  isLive: boolean,
  isConcluded: boolean
): { text: string; class: string } {
  if (needsOpponent) {
    return { text: 'Open', class: 'text-accent bg-accent/10' };
  }
  if (isConcluded) {
    return { text: 'Resolved', class: 'text-text-tertiary bg-page-bg' };
  }
  if (isLive) {
    return { text: `Round ${debate.currentRound}`, class: 'text-text-secondary bg-page-bg' };
  }
  return { text: 'Active', class: 'text-text-secondary bg-page-bg' };
}

/**
 * Support/Oppose percentage bar
 * Requirements: 2.2 - Display support/oppose percentage as visual bar
 */
interface SupportOpposeBarProps {
  supportPercent: number;
  opposePercent: number;
}

function SupportOpposeBar({ supportPercent, opposePercent }: SupportOpposeBarProps) {
  return (
    <div className="space-y-1" data-testid="support-oppose-bar">
      <div className="flex h-1.5 rounded-full overflow-hidden bg-divider">
        <div
          className="bg-support transition-all duration-300"
          style={{ width: `${supportPercent}%` }}
          data-testid="support-bar"
        />
        <div
          className="bg-oppose transition-all duration-300"
          style={{ width: `${opposePercent}%` }}
          data-testid="oppose-bar"
        />
      </div>
      <div className="flex justify-between text-[10px] text-text-tertiary">
        <span>{supportPercent.toFixed(0)}%</span>
        <span>{opposePercent.toFixed(0)}%</span>
      </div>
    </div>
  );
}

/**
 * Mind change delta indicator
 * Requirements: 2.3 - Display mind change count with delta indicator
 */
interface MindChangeDeltaProps {
  count: number;
}

function MindChangeDelta({ count }: MindChangeDeltaProps) {
  return (
    <div 
      className="flex items-center gap-1 text-accent animate-delta"
      data-testid="mind-change-delta"
    >
      <span className="text-sm font-semibold tabular-nums">{count}</span>
      <span className="text-xs font-medium">Δ</span>
    </div>
  );
}

/**
 * Mini sparkline showing stance trend over time
 * Requirements: 2.8 - Display mini sparkline showing stance trend
 */
interface MiniSparklineProps {
  supportPercent: number;
}

function MiniSparkline({ supportPercent }: MiniSparklineProps) {
  const height = 24;
  const width = 48;
  const padding = 2;

  // Calculate Y position based on support percentage
  const y = padding + ((100 - supportPercent) / 100) * (height - padding * 2);
  const midY = height / 2;

  // Create a simple curved path from center to current position
  const path = `M ${padding} ${midY} Q ${width / 3} ${midY + 4} ${width / 2} ${midY} T ${width - padding} ${y}`;

  // Color based on support percentage
  const lineColor = supportPercent >= 50 ? '#2D8A6E' : '#C75B5B';
  const trendDirection = supportPercent >= 50 ? 'upward' : 'downward';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Stance trend sparkline showing ${trendDirection} movement at ${supportPercent}%`}
      data-testid="mini-sparkline"
    >
      {/* Center reference line */}
      <line
        x1={padding}
        y1={midY}
        x2={width - padding}
        y2={midY}
        stroke="#E5E5E0"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      {/* Trend line */}
      <path
        d={path}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Current position dot */}
      <circle cx={width - padding} cy={y} r="2" fill={lineColor} />
    </svg>
  );
}

export default CompactDebateCard;
