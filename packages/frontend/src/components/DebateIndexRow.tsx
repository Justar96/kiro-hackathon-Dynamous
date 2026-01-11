import { Link } from '@tanstack/react-router';
import type { Debate, MarketPrice } from '@debate-platform/shared';
import { useDebateLinkPrefetch } from '../lib/usePrefetch';

interface DebateIndexRowProps {
  debate: Debate;
  marketPrice?: MarketPrice | null;
}

/**
 * DebateIndexRow displays a debate as a compact row in the index-style list.
 * Library catalog aesthetic: resolution title, muted tags, tiny support/oppose bar, sparkline, mind-changes.
 * Includes prefetching on hover for faster navigation.
 * Requirements: 12.1, 12.2, 12.3, 12.4, 10.3
 */
export function DebateIndexRow({ debate, marketPrice }: DebateIndexRowProps) {
  const supportPercent = marketPrice?.supportPrice ?? 50;
  const opposePercent = marketPrice?.opposePrice ?? 50;
  const mindChangeCount = marketPrice?.mindChangeCount ?? 0;

  const statusLabel = debate.status === 'concluded' ? 'Resolved' : `R${debate.currentRound}`;
  
  // Prefetch debate data on hover for faster navigation
  const prefetchProps = useDebateLinkPrefetch(debate.id);

  return (
    <Link
      to="/debates/$debateId"
      params={{ debateId: debate.id }}
      className="group block"
      {...prefetchProps}
    >
      <article className="flex items-center gap-2 sm:gap-4 py-4 px-2 sm:px-3 border-b border-gray-100 hover:bg-page-bg/50 transition-colors active:bg-page-bg/70">
        {/* Resolution title - main content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-heading text-text-primary text-body-small sm:text-body leading-snug line-clamp-2 sm:truncate group-hover:text-accent transition-colors">
            {debate.resolution}
          </h3>
          {/* Muted tags row */}
          <div className="flex items-center gap-2 sm:gap-3 mt-1">
            <span className="text-caption text-text-tertiary uppercase tracking-wide">
              {statusLabel}
            </span>
            <span className="text-caption text-text-tertiary hidden sm:inline">
              {debate.currentTurn === 'support' ? 'Support turn' : 'Oppose turn'}
            </span>
          </div>
        </div>

        {/* Tiny support/oppose bar */}
        <div className="w-12 sm:w-16 flex-shrink-0">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
            <div 
              className="bg-support transition-all duration-300"
              style={{ width: `${supportPercent}%` }}
            />
            <div 
              className="bg-oppose transition-all duration-300"
              style={{ width: `${opposePercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[10px] text-text-tertiary">{supportPercent.toFixed(0)}</span>
            <span className="text-[10px] text-text-tertiary">{opposePercent.toFixed(0)}</span>
          </div>
        </div>

        {/* Sparkline placeholder - tiny chart - hidden on mobile */}
        <div className="w-12 h-6 flex-shrink-0 hidden md:block">
          <MiniSparkline supportPercent={supportPercent} />
        </div>

        {/* Mind-changes count */}
        <div className="w-10 sm:w-16 flex-shrink-0 text-right">
          <span className="text-body-small text-text-secondary tabular-nums">
            {mindChangeCount}
          </span>
          <span className="text-caption text-text-tertiary ml-0.5 sm:ml-1">
            Δ
          </span>
        </div>
      </article>
    </Link>
  );
}

/**
 * MiniSparkline - A tiny sparkline visualization for the index row.
 * Shows a simple representation of market movement.
 */
function MiniSparkline({ supportPercent }: { supportPercent: number }) {
  // Generate a simple sparkline path based on support percent
  // In a real implementation, this would use actual historical data
  const height = 24;
  const width = 48;
  const padding = 2;
  
  // Create a simple line that ends at the current support percent
  const y = padding + ((100 - supportPercent) / 100) * (height - padding * 2);
  const midY = height / 2;
  
  // Simple path: start at middle, slight variation, end at current
  const path = `M ${padding} ${midY} Q ${width / 3} ${midY + 4} ${width / 2} ${midY} T ${width - padding} ${y}`;
  
  return (
    <svg 
      viewBox={`0 0 ${width} ${height}`} 
      className="w-full h-full"
      preserveAspectRatio="none"
    >
      {/* Reference line at 50% */}
      <line 
        x1={padding} 
        y1={midY} 
        x2={width - padding} 
        y2={midY} 
        stroke="#E5E7EB" 
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      {/* Sparkline */}
      <path 
        d={path} 
        fill="none" 
        stroke={supportPercent >= 50 ? '#059669' : '#DC2626'} 
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* End dot */}
      <circle 
        cx={width - padding} 
        cy={y} 
        r="2" 
        fill={supportPercent >= 50 ? '#059669' : '#DC2626'}
      />
    </svg>
  );
}

export default DebateIndexRow;
