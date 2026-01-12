import { Link } from '@tanstack/react-router';
import type { Debate, MarketPrice } from '@debate-platform/shared';
import { useDebateLinkPrefetch } from '../../lib/usePrefetch';
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

  // Status badge
  const statusBadge = needsOpponent 
    ? { text: 'Open', class: 'text-accent bg-accent/10' }
    : debate.status === 'concluded'
      ? { text: 'Resolved', class: 'text-text-tertiary bg-page-bg' }
      : { text: `R${debate.currentRound}`, class: 'text-text-secondary bg-page-bg' };

  return (
    <Link
      to="/debates/$debateId"
      params={{ debateId: debate.id }}
      className="group block"
      {...prefetchProps}
    >
      <article className="flex items-center gap-3 py-3.5 px-3 border-b border-gray-100 hover:bg-page-bg/50 transition-colors">
        {/* Market sentiment indicator */}
        <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-page-bg flex items-center justify-center">
          <span className={`text-sm font-semibold ${supportPercent > 55 ? 'text-support' : supportPercent < 45 ? 'text-oppose' : 'text-text-secondary'}`}>
            {supportPercent.toFixed(0)}
          </span>
        </div>

        {/* Resolution */}
        <div className="flex-1 min-w-0">
          <h3 className="text-body text-text-primary leading-snug line-clamp-2 group-hover:text-accent transition-colors">
            {debate.resolution}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusBadge.class}`}>
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

        {/* Market bar + Quick stance */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {/* Market bar - always visible */}
          <div className="w-16">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
              <div className="bg-support" style={{ width: `${supportPercent}%` }} />
              <div className="bg-oppose" style={{ width: `${100 - supportPercent}%` }} />
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
 */
function MiniSparkline({ supportPercent }: { supportPercent: number }) {
  const height = 24;
  const width = 48;
  const padding = 2;
  
  const y = padding + ((100 - supportPercent) / 100) * (height - padding * 2);
  const midY = height / 2;
  
  const path = `M ${padding} ${midY} Q ${width / 3} ${midY + 4} ${width / 2} ${midY} T ${width - padding} ${y}`;
  
  return (
    <svg 
      viewBox={`0 0 ${width} ${height}`} 
      className="w-full h-full"
      preserveAspectRatio="none"
    >
      <line 
        x1={padding} 
        y1={midY} 
        x2={width - padding} 
        y2={midY} 
        stroke="#E5E7EB" 
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <path 
        d={path} 
        fill="none" 
        stroke={supportPercent >= 50 ? '#059669' : '#DC2626'} 
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle 
        cx={width - padding} 
        cy={y} 
        r="2" 
        fill={supportPercent >= 50 ? '#059669' : '#DC2626'}
      />
    </svg>
  );
}
