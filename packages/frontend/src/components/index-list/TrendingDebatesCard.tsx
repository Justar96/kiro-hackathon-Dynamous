import { Link } from '@tanstack/react-router';
import type { Debate, MarketPrice } from '@thesis/shared';
import { useDebateLinkPrefetch } from '../../lib';
import { TrendingUpIcon } from '../icons';

interface DebateWithMarket {
  debate: Debate;
  marketPrice?: MarketPrice | null;
}

interface TrendingDebatesCardProps {
  debates: DebateWithMarket[];
  maxCount?: number;
}

/**
 * TrendingDebatesCard - Featured section displaying most active/trending debates
 * Requirements: Index Page Improvement 2 - Trending Debates Card
 */
export function TrendingDebatesCard({ debates, maxCount = 3 }: TrendingDebatesCardProps) {
  // Filter and sort for trending debates
  const trendingDebates = [...debates]
    .filter(d => d.debate.status === 'active')
    .sort((a, b) => {
      const aCount = a.marketPrice?.mindChangeCount ?? 0;
      const bCount = b.marketPrice?.mindChangeCount ?? 0;
      return bCount - aCount;
    })
    .slice(0, maxCount);

  if (trendingDebates.length === 0) {
    return null;
  }

  return (
    <section className="mb-6" aria-labelledby="trending-heading">
      <div className="flex items-center justify-between mb-4">
        <h2 
          id="trending-heading" 
          className="text-sm font-semibold text-text-primary uppercase tracking-wide flex items-center gap-2"
        >
          <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" aria-hidden="true" />
          Trending Now
        </h2>
        <span className="text-xs text-text-tertiary">
          {trendingDebates.length} active
        </span>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {trendingDebates.map((item, index) => (
          <TrendingDebateCard 
            key={item.debate.id} 
            item={item} 
            rank={index + 1}
          />
        ))}
      </div>
    </section>
  );
}

interface TrendingDebateCardInnerProps {
  item: DebateWithMarket;
  rank: number;
}

function TrendingDebateCard({ item, rank }: TrendingDebateCardInnerProps) {
  const { debate, marketPrice } = item;
  const prefetchProps = useDebateLinkPrefetch(debate.id);
  
  const rawSupport = marketPrice?.supportPrice ?? 50;
  const rawOppose = marketPrice?.opposePrice ?? 50;
  const total = rawSupport + rawOppose;
  const supportPercent = total > 0 ? (rawSupport / total) * 100 : 50;
  const opposePercent = total > 0 ? (rawOppose / total) * 100 : 50;
  const mindChangeCount = marketPrice?.mindChangeCount ?? 0;
  const isLive = debate.status === 'active';
  
  // Determine which side is winning
  const supportWinning = supportPercent > 50;
  
  return (
    <Link
      to="/debates/$debateId"
      params={{ debateId: debate.id }}
      className="group block"
      {...prefetchProps}
    >
      <article className="relative h-full p-5 bg-paper rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200">
        {/* Top row: Status and Round */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isLive && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                Live
              </span>
            )}
            <span className="text-xs text-text-tertiary font-medium">
              Round {debate.currentRound}/3
            </span>
          </div>
          <span className="text-xs font-medium text-text-tertiary">
            #{rank}
          </span>
        </div>
        
        {/* Resolution title */}
        <h3 className="font-medium text-text-primary text-sm leading-snug line-clamp-2 group-hover:text-accent transition-colors mb-4 min-h-[2.5rem]">
          {debate.resolution}
        </h3>
        
        {/* Market visualization */}
        <div className="space-y-2">
          {/* Support/Oppose bar */}
          <div className="relative">
            <div className="flex h-2 rounded-full overflow-hidden bg-divider">
              <div 
                className="bg-support transition-all duration-500 ease-out"
                style={{ width: `${supportPercent}%` }}
              />
              <div 
                className="bg-oppose transition-all duration-500 ease-out"
                style={{ width: `${opposePercent}%` }}
              />
            </div>
            {/* Divider at boundary between support/oppose */}
            <div 
              className="absolute top-0 w-0.5 h-2 bg-white/80 transition-all duration-500 ease-out"
              style={{ left: `${supportPercent}%`, transform: 'translateX(-50%)' }}
            />
          </div>
          
          {/* Labels */}
          <div className="flex justify-between items-center text-xs">
            <span className={`font-medium ${supportWinning ? 'text-support' : 'text-text-tertiary'}`}>
              {supportPercent.toFixed(0)}% Support
            </span>
            <span className={`font-medium ${!supportWinning ? 'text-oppose' : 'text-text-tertiary'}`}>
              {opposePercent.toFixed(0)}% Oppose
            </span>
          </div>
        </div>
        
        {/* Bottom row: Mind changes */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <TrendingUpIcon size="sm" className="text-accent" decorative />
            <span className="text-sm font-semibold text-accent">
              {mindChangeCount}
            </span>
            <span className="text-xs text-text-tertiary">
              minds changed
            </span>
          </div>
          <span className="text-xs text-text-tertiary">
            {debate.currentTurn === 'support' ? 'Support turn' : 'Oppose turn'}
          </span>
        </div>
      </article>
    </Link>
  );
}

export default TrendingDebatesCard;
