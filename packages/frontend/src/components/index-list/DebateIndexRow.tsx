import { Link } from '@tanstack/react-router';
import type { Debate, MarketPrice } from '@thesis/shared';
import { useDebateLinkPrefetch } from '../../lib';
import { InlineQuickStance } from './InlineQuickStance';

interface DebateIndexRowProps {
  debate: Debate;
  marketPrice?: MarketPrice | null;
  userStance?: number | null;
  onQuickStance?: (debateId: string, side: 'support' | 'oppose') => void;
  isAuthenticated?: boolean;
}

/**
 * DebateIndexRow - Polymarket-style debate listing with inline quick stance.
 * Paper-clean aesthetic with market sentiment display.
 */
export function DebateIndexRow({ 
  debate, 
  marketPrice, 
  userStance,
  onQuickStance,
  isAuthenticated = false,
}: DebateIndexRowProps) {
  const supportPercent = marketPrice?.supportPrice ?? 50;
  const mindChangeCount = marketPrice?.mindChangeCount ?? 0;
  const needsOpponent = debate.status === 'active' && !debate.opposeDebaterId;
  
  const prefetchProps = useDebateLinkPrefetch(debate.id);

  // Status badge - refined small-caps styling for paper aesthetic
  const statusBadge = needsOpponent 
    ? { text: 'Open', class: 'text-accent bg-accent/10' }
    : debate.status === 'concluded'
      ? { text: 'Resolved', class: 'text-text-tertiary bg-page-bg' }
      : { text: `Round ${debate.currentRound}`, class: 'text-text-secondary bg-page-bg' };

  const resolutionId = `resolution-${debate.id}`;
  
  return (
    <Link
      to="/debates/$debateId"
      params={{ debateId: debate.id }}
      className="group block"
      {...prefetchProps}
    >
      <article 
        className="flex items-center gap-3 py-3.5 px-3 border-b border-divider hover:bg-page-bg/50 transition-colors"
        aria-labelledby={resolutionId}
      >
        {/* Market sentiment indicator - refined paper aesthetic */}
        <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-page-bg flex items-center justify-center border border-divider/50">
          <span 
            className={`text-sm font-semibold tabular-nums ${supportPercent > 55 ? 'text-support' : supportPercent < 45 ? 'text-oppose' : 'text-text-secondary'}`}
            aria-label={`${supportPercent.toFixed(0)}% support`}
          >
            {supportPercent.toFixed(0)}
          </span>
        </div>

        {/* Resolution - serif typography for paper aesthetic */}
        <div className="flex-1 min-w-0">
          <h3 
            id={resolutionId}
            className="font-heading text-body text-text-primary leading-snug line-clamp-2 group-hover:text-accent transition-colors"
          >
            {debate.resolution}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`small-caps text-[11px] font-medium px-1.5 py-0.5 rounded ${statusBadge.class}`}>
              {statusBadge.text}
            </span>
            {mindChangeCount > 0 && (
              <span className="text-caption text-text-tertiary">
                {mindChangeCount} Δ
              </span>
            )}
          </div>
        </div>

        {/* Mini sparkline - hidden on mobile */}
        <div className="w-12 h-6 flex-shrink-0 hidden md:block">
          <MiniSparkline supportPercent={supportPercent} />
        </div>

        {/* Market bar + Quick stance - refined colors */}
        {/* Using onKeyDown to prevent keyboard events from propagating while still allowing click isolation */}
        <div 
          className="flex-shrink-0 flex flex-col items-end gap-1.5" 
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="group"
          aria-label="Market position and quick stance"
        >
          {/* Market bar - muted support/oppose colors */}
          <div className="w-16">
            <div className="h-1.5 bg-divider rounded-full overflow-hidden flex">
              <div className="bg-support/80" style={{ width: `${supportPercent}%` }} />
              <div className="bg-oppose/80" style={{ width: `${100 - supportPercent}%` }} />
            </div>
          </div>
          
          {/* Quick stance buttons - for authenticated users */}
          {isAuthenticated && onQuickStance && (
            <InlineQuickStance
              debateId={debate.id}
              marketPrice={marketPrice}
              userStance={userStance}
              onStance={onQuickStance}
            />
          )}
        </div>

        {/* Arrow */}
        <span className="text-text-tertiary group-hover:text-accent transition-colors">→</span>
      </article>
    </Link>
  );
}

export default DebateIndexRow;

/**
 * MiniSparkline - A tiny sparkline visualization for the index row.
 * Uses refined muted teal/coral colors for paper aesthetic.
 */
function MiniSparkline({ supportPercent }: { supportPercent: number }) {
  const height = 24;
  const width = 48;
  const padding = 2;
  
  const y = padding + ((100 - supportPercent) / 100) * (height - padding * 2);
  const midY = height / 2;
  
  const path = `M ${padding} ${midY} Q ${width / 3} ${midY + 4} ${width / 2} ${midY} T ${width - padding} ${y}`;
  
  // Muted teal (#2D8A6E) for support, muted coral (#C75B5B) for oppose
  const lineColor = supportPercent >= 50 ? '#2D8A6E' : '#C75B5B';
  const trendDirection = supportPercent >= 50 ? 'upward' : 'downward';
  
  return (
    <svg 
      viewBox={`0 0 ${width} ${height}`} 
      className="w-full h-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Market trend sparkline showing ${trendDirection} movement at ${supportPercent}%`}
    >
      <line 
        x1={padding} 
        y1={midY} 
        x2={width - padding} 
        y2={midY} 
        stroke="#E5E5E0" 
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <path 
        d={path} 
        fill="none" 
        stroke={lineColor} 
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle 
        cx={width - padding} 
        cy={y} 
        r="2" 
        fill={lineColor}
      />
    </svg>
  );
}
